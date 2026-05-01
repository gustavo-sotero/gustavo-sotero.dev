import { honoLogger } from '@logtape/hono';
import { CORS_ALLOW_METHODS, isMutatingHttpMethod } from '@portfolio/shared/constants/httpMethods';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { env } from './config/env';
import { iframeCspTokens } from './lib/iframe-policy';
import { analyticsMiddleware } from './middleware/analytics';
import { authAdmin } from './middleware/auth';
import { cacheControlMiddleware } from './middleware/cacheControl';
import { csrfProtection } from './middleware/csrf';
import { globalErrorHandler } from './middleware/errorHandler';
import { requestId } from './middleware/requestId';
import { adminAnalyticsRouter } from './routes/admin/analytics';
import { authRouter } from './routes/admin/auth';
import { adminCommentsRouter } from './routes/admin/comments';
import { adminContactsRouter } from './routes/admin/contacts';
import { adminEducationRouter } from './routes/admin/education';
import { adminExperienceRouter } from './routes/admin/experience';
import { adminJobsRouter } from './routes/admin/jobs';
import { adminPostGenerationRouter } from './routes/admin/post-generation';
import { adminPostsRouter } from './routes/admin/posts';
import { adminProjectsRouter } from './routes/admin/projects';
import { adminSkillsRouter } from './routes/admin/skills';
import { adminTagsRouter } from './routes/admin/tags';
import { adminUploadsRouter } from './routes/admin/uploads';
import { commentsRouter } from './routes/public/comments';
import { contactRouter } from './routes/public/contact';
import { publicDeveloperRouter } from './routes/public/developer';
import { publicEducationRouter } from './routes/public/education';
import { publicExperienceRouter } from './routes/public/experience';
import { feedRouter } from './routes/public/feed';
import { healthRouter } from './routes/public/health';
import { publicHomeRouter } from './routes/public/home';
import { openApiRouter } from './routes/public/openapi';
import { publicPostsRouter } from './routes/public/posts';
import { publicProjectsRouter } from './routes/public/projects';
import { sitemapRouter } from './routes/public/sitemap';
import { publicSkillsRouter } from './routes/public/skills';
import { publicTagsRouter } from './routes/public/tags';
import type { AppEnv } from './types/index';

const app = new Hono<AppEnv>();

// ── Global Middleware (order matters) ──────────────────────────────────────────

// 1. Body size limit
app.use(
  '*',
  bodyLimit({
    maxSize: env.BODY_SIZE_LIMIT,
    onError: (c) => {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Request body exceeds the ${env.BODY_SIZE_LIMIT} byte limit`,
          },
        },
        413
      );
    },
  })
);

// 2. Request ID — early in the chain so all subsequent middleware can access it
app.use('*', requestId);

// 3. CORS
// allowMethods must cover every HTTP method used by admin mutating routes so
// that preflight OPTIONS requests succeed and CSRF-protected mutations work.
// This list is shared with browser-side CSRF injection and admin CSRF guards.
app.use(
  '*',
  cors({
    origin: env.ALLOWED_ORIGIN,
    credentials: true,
    allowMethods: [...CORS_ALLOW_METHODS],
    allowHeaders: ['Content-Type', 'X-CSRF-Token'],
    exposeHeaders: ['X-Request-Id'],
    maxAge: 600,
  })
);

// 4. Security headers
app.use('*', secureHeaders());

// 5. Analytics — track public GET requests asynchronously (after route handling)
app.use('*', analyticsMiddleware);

// 7. Cache-Control — set appropriate headers based on route type
app.use('*', cacheControlMiddleware);

// 6. HTTP logging — official @logtape/hono middleware (category: portfolio:api:http)
app.use(
  '*',
  honoLogger({
    category: ['portfolio', 'api', 'http'],
    level: 'info',
    skip: (c) => c.req.path === '/health' || c.req.path === '/ready',
  })
);

// 6. Content Security Policy (custom middleware — secureHeaders does not manage CSP detail)
// Two policies are applied:
//   - /doc/*  : relaxed — Swagger UI requires 'unsafe-inline' scripts/styles and cdn.jsdelivr.net for its
//               bundled assets. The /doc route is public reference docs, not a sensitive data surface,
//               so the relaxed policy is acceptable and intentional.
//   - everything else : strict — no inline scripts, Cloudflare Turnstile only, S3 images, YT/Vimeo iframes.
app.use('*', async (c, next) => {
  await next();
  const s3Domain = env.S3_PUBLIC_DOMAIN;
  const apiUrl = env.API_PUBLIC_URL;
  const isDocRoute = c.req.path === '/doc' || c.req.path.startsWith('/doc/');

  const csp = isDocRoute
    ? [
        `default-src 'self'`,
        `script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net`,
        `style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net`,
        `img-src 'self' data:`,
        `font-src 'self'`,
        `connect-src 'self' ${apiUrl}`,
        `base-uri 'self'`,
        `form-action 'self'`,
      ]
    : [
        `default-src 'self'`,
        `script-src 'self' https://challenges.cloudflare.com`,
        `style-src 'self' 'unsafe-inline'`,
        `img-src 'self' ${s3Domain} data:`,
        `font-src 'self'`,
        `frame-src ${iframeCspTokens().join(' ')}`,
        `connect-src 'self' ${apiUrl}`,
        `base-uri 'self'`,
        `form-action 'self'`,
      ];

  c.header('Content-Security-Policy', csp.join('; '));
});

// ── Global Error Handler ───────────────────────────────────────────────────────
app.onError(globalErrorHandler);

// ── Admin guards (applied before any admin route is registered) ───────────────

// All /admin/* requests require a valid JWT session
app.use('/admin/*', authAdmin);

// All /admin/* mutating requests require a matching CSRF token.
// The mutating method contract is shared with CORS and the browser client.
app.use('/admin/*', async (c, next) => {
  if (isMutatingHttpMethod(c.req.method)) {
    return csrfProtection(c, next);
  }
  await next();
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.route('/', healthRouter);
app.route('/', feedRouter);
app.route('/', sitemapRouter);
app.route('/', openApiRouter);
app.route('/comments', commentsRouter);
app.route('/contact', contactRouter);
app.route('/developer', publicDeveloperRouter);
app.route('/education', publicEducationRouter);
app.route('/experience', publicExperienceRouter);
app.route('/home', publicHomeRouter);
app.route('/posts', publicPostsRouter);
app.route('/projects', publicProjectsRouter);
app.route('/skills', publicSkillsRouter);
app.route('/tags', publicTagsRouter);

// Auth — GitHub OAuth, session management (mounted at /auth, NOT /admin/auth)
app.route('/auth', authRouter);

// Admin routes — protected by authAdmin + CSRF (applied globally above for /admin/*)
const adminRouter = new Hono<AppEnv>();
adminRouter.route('/posts', adminPostsRouter);
adminRouter.route('/posts/generate', adminPostGenerationRouter);
adminRouter.route('/projects', adminProjectsRouter);
adminRouter.route('/skills', adminSkillsRouter);
adminRouter.route('/tags', adminTagsRouter);
adminRouter.route('/uploads', adminUploadsRouter);
adminRouter.route('/comments', adminCommentsRouter);
adminRouter.route('/contacts', adminContactsRouter);
adminRouter.route('/experience', adminExperienceRouter);
adminRouter.route('/education', adminEducationRouter);
adminRouter.route('/analytics', adminAnalyticsRouter);
adminRouter.route('/jobs', adminJobsRouter);

app.route('/admin', adminRouter);

export { app };
