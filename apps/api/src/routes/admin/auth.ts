import { Hono } from 'hono';
import { setCookie } from 'hono/cookie';
import { sign } from 'hono/jwt';
import { env } from '../../config/env';
import { getLogger } from '../../config/logger';
import { redis } from '../../config/redis';
import { errorResponse, successResponse } from '../../lib/response';
import { authAdmin } from '../../middleware/auth';
import { csrfProtection } from '../../middleware/csrf';
import { createRateLimit } from '../../middleware/rateLimit';
import type { AppEnv } from '../../types/index';

const logger = getLogger('auth');

type OutboundFailureType = 'timeout' | 'aborted' | 'network' | 'unknown';

interface LocalOauthStateEntry {
  expiresAt: number;
}

const localOauthStateStore = new Map<string, LocalOauthStateEntry>();

const CONSUME_STATE_LUA = `
local v = redis.call('GET', KEYS[1])
if v then
  redis.call('DEL', KEYS[1])
end
return v
`;

function classifyOutboundFailure(err: unknown): OutboundFailureType {
  if (!(err instanceof Error)) return 'unknown';
  if (err.name === 'TimeoutError') return 'timeout';
  if (err.name === 'AbortError') return 'aborted';
  if (err instanceof TypeError) return 'network';
  return 'unknown';
}

function pruneLocalOauthStateStore(): void {
  const now = Date.now();
  for (const [key, entry] of localOauthStateStore.entries()) {
    if (entry.expiresAt < now) {
      localOauthStateStore.delete(key);
    }
  }
}

function setLocalOauthState(state: string, ttlSeconds: number): void {
  // Best-effort periodic prune to keep memory bounded.
  if (Math.random() < 0.01) pruneLocalOauthStateStore();
  localOauthStateStore.set(state, { expiresAt: Date.now() + ttlSeconds * 1000 });
}

function consumeLocalOauthState(state: string): string | null {
  const entry = localOauthStateStore.get(state);
  if (!entry) return null;
  localOauthStateStore.delete(state);
  if (entry.expiresAt < Date.now()) {
    return null;
  }
  return '1';
}

/**
 * Atomically consume an OAuth state token from Redis.
 *
 * Primary path uses GETDEL (Redis >= 6.2). If unavailable, falls back to a
 * Lua script that performs GET+DEL atomically on the server.
 * Falls back to local memory only when OAUTH_STATE_LOCAL_FALLBACK is enabled.
 */
async function consumeOauthState(state: string): Promise<string | null> {
  const key = `oauth:state:${state}`;

  try {
    const consumed = await redis.getdel(key);
    if (typeof consumed === 'string') return consumed;
    return consumeLocalOauthState(state);
  } catch (err) {
    const message = err instanceof Error ? err.message.toLowerCase() : '';
    const getDelUnsupported = message.includes('unknown command') && message.includes('getdel');

    if (getDelUnsupported) {
      logger.warn('Redis GETDEL unavailable, using Lua fallback for OAuth state consume');
      try {
        const consumed = await redis.eval(CONSUME_STATE_LUA, 1, key);
        if (typeof consumed === 'string') return consumed;
        return consumeLocalOauthState(state);
      } catch (luaErr) {
        if (!env.OAUTH_STATE_LOCAL_FALLBACK) {
          logger.error('OAuth state Lua fallback failed and local fallback is disabled', {
            error: luaErr instanceof Error ? luaErr.message : String(luaErr),
          });
          return null;
        }
        logger.warn('OAuth state Lua fallback failed, trying local fallback', {
          error: luaErr instanceof Error ? luaErr.message : String(luaErr),
        });
        return consumeLocalOauthState(state);
      }
    }

    if (!env.OAUTH_STATE_LOCAL_FALLBACK) {
      logger.error('OAuth state Redis consume failed and local fallback is disabled', {
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }

    logger.warn('OAuth state Redis consume failed, trying local fallback', {
      error: err instanceof Error ? err.message : String(err),
    });
    return consumeLocalOauthState(state);
  }
}

const authRouter = new Hono<AppEnv>();

// ── Rate limit for OAuth start ─────────────────────────────────────────────────
const authRateLimit = createRateLimit({
  maxRequests: 10,
  windowMs: 60_000,
  keyPrefix: 'rl:auth',
});

/**
 * POST /auth/github/start
 * Initiates the GitHub OAuth flow.
 * Generates a CSRF-safe `state` token, persists it in Redis for 10 minutes,
 * and returns the GitHub authorization URL.
 */
authRouter.post('/github/start', authRateLimit, async (c) => {
  const state = crypto.randomUUID();

  // Store state in Redis with 10-minute TTL (single-use anti-CSRF token for OAuth)
  try {
    await redis.set(`oauth:state:${state}`, '1', 'EX', 600);
  } catch (err) {
    if (!env.OAUTH_STATE_LOCAL_FALLBACK) {
      logger.error('Redis unavailable for OAuth state and local fallback is disabled', {
        error: (err as Error).message,
      });
      return errorResponse(c, 503, 'SERVICE_UNAVAILABLE', 'Authentication service unavailable');
    }
    setLocalOauthState(state, 600);
    logger.warn('Redis unavailable for OAuth state, using local fallback (single-instance)', {
      error: (err as Error).message,
      localStateCount: localOauthStateStore.size,
    });
  }

  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: env.GITHUB_CALLBACK_URL,
    state,
    scope: 'read:user',
  });

  const authUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;

  logger.info('OAuth flow initiated', { state: `${state.slice(0, 8)}...` });

  return successResponse(c, { authUrl }, 200);
});

/**
 * GET /auth/github/callback
 * GitHub OAuth callback handler.
 * Validates state, exchanges code for access_token, verifies admin identity,
 * and issues JWT + CSRF cookies.
 */
authRouter.get('/github/callback', async (c) => {
  const requestId = c.get('requestId');
  const code = c.req.query('code');
  const state = c.req.query('state');

  if (!code || !state) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'Missing code or state parameter');
  }

  // Atomically read + delete state — GETDEL prevents TOCTOU race between
  // concurrent callback requests using the same state token (single-use guarantee).
  const storedState = await consumeOauthState(state);

  if (!storedState) {
    logger.warn('OAuth callback with invalid or expired state', {
      state: `${state.slice(0, 8)}...`,
    });
    return errorResponse(c, 403, 'FORBIDDEN', 'Invalid or expired state');
  }

  // Exchange code for GitHub access token
  let accessToken: string;
  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: env.GITHUB_CALLBACK_URL,
      }),
      signal: AbortSignal.timeout(8_000),
    });

    if (!tokenRes.ok) {
      throw new Error(`GitHub token exchange failed: ${tokenRes.status}`);
    }

    const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };

    if (tokenData.error || !tokenData.access_token) {
      throw new Error(tokenData.error ?? 'No access_token in response');
    }

    accessToken = tokenData.access_token;
  } catch (err) {
    const failureType = classifyOutboundFailure(err);
    logger.error('GitHub token exchange error', {
      requestId,
      failureType,
      error: err instanceof Error ? err.message : String(err),
    });
    return errorResponse(c, 503, 'SERVICE_UNAVAILABLE', 'Failed to exchange GitHub OAuth code');
  }

  // Fetch GitHub user profile
  let githubId: string;
  try {
    const profileRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'portfolio-api',
      },
      signal: AbortSignal.timeout(8_000),
    });

    if (!profileRes.ok) {
      throw new Error(`GitHub profile fetch failed: ${profileRes.status}`);
    }

    const profile = (await profileRes.json()) as { id?: number; login?: string };

    if (!profile.id) {
      throw new Error('No id in GitHub profile response');
    }

    githubId = String(profile.id);
    logger.info('GitHub profile fetched', { login: profile.login });
  } catch (err) {
    const failureType = classifyOutboundFailure(err);
    logger.error('GitHub profile fetch error', {
      requestId,
      failureType,
      error: err instanceof Error ? err.message : String(err),
    });
    return errorResponse(c, 503, 'SERVICE_UNAVAILABLE', 'Failed to fetch GitHub profile');
  }

  // Authorize: only the configured admin GitHub ID is allowed
  if (githubId !== String(env.ADMIN_GITHUB_ID)) {
    logger.warn('OAuth callback: unauthorized GitHub ID', {
      githubId,
      expected: env.ADMIN_GITHUB_ID,
    });
    return errorResponse(c, 403, 'FORBIDDEN', 'User not authorized');
  }

  // Issue JWT (24h expiry)
  const now = Math.floor(Date.now() / 1000);
  const jwt = await sign(
    {
      sub: githubId,
      role: 'admin',
      iat: now,
      exp: now + 86400,
    },
    env.JWT_SECRET,
    'HS256'
  );

  // CSRF token — readable by frontend JS (NOT httpOnly)
  const csrfToken = crypto.randomUUID();

  const isProduction = env.NODE_ENV === 'production';

  // Session cookie — HTTP-only, not readable by JS
  setCookie(c, 'admin_token', jwt, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'Strict',
    path: '/',
    maxAge: 86400,
  });

  // CSRF cookie — readable by frontend JS to send in X-CSRF-Token header
  setCookie(c, 'csrf_token', csrfToken, {
    httpOnly: false,
    secure: isProduction,
    sameSite: 'Strict',
    path: '/',
    maxAge: 86400,
  });

  logger.info('Admin session created', { githubId });

  // Redirect to admin panel
  return c.redirect(`${env.ALLOWED_ORIGIN}/admin`);
});

/**
 * POST /auth/logout
 * Clears session cookies and terminates the admin session.
 */
authRouter.post('/logout', authAdmin, csrfProtection, (c) => {
  const isProduction = env.NODE_ENV === 'production';

  setCookie(c, 'admin_token', '', {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'Strict',
    path: '/',
    maxAge: 0,
  });

  setCookie(c, 'csrf_token', '', {
    httpOnly: false,
    secure: isProduction,
    sameSite: 'Strict',
    path: '/',
    maxAge: 0,
  });

  logger.info('Admin session terminated');

  return successResponse(c, { message: 'Logged out' });
});

/**
 * GET /auth/session
 * Lightweight endpoint for server-side session validation.
 * Returns the authenticated admin's identity if the token is valid.
 * Used by the Next.js admin layout to gate render before the shell is shown.
 */
authRouter.get('/session', authAdmin, (c) => {
  return successResponse(c, { adminId: c.get('adminId') });
});

export { authRouter };
