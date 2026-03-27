// API test bootstrap — mirrors the pattern used in apps/worker/vitest.setup.ts.
// Sets all env vars required by apps/api/src/config/env.ts before any module is
// imported, so the Zod schema succeeds and no process.argv heuristic is needed.

process.env.DATABASE_URL ??= 'postgresql://user:pass@localhost:5432/test';
process.env.REDIS_URL ??= 'redis://localhost:6379';
process.env.JWT_SECRET ??= '12345678901234567890123456789012';
process.env.GITHUB_CLIENT_ID ??= 'test-client-id';
process.env.GITHUB_CLIENT_SECRET ??= 'test-client-secret';
process.env.GITHUB_CALLBACK_URL ??= 'https://example.com/api/auth/github/callback';
process.env.ADMIN_GITHUB_ID ??= '12345';
process.env.S3_ENDPOINT ??= 'https://example.com/s3';
process.env.S3_BUCKET ??= 'test-bucket';
process.env.S3_ACCESS_KEY ??= 'test-access-key';
process.env.S3_SECRET_KEY ??= 'test-secret-key';
process.env.S3_REGION ??= 'auto';
process.env.S3_PUBLIC_DOMAIN ??= 'cdn.example.test';
process.env.TELEGRAM_BOT_TOKEN ??= 'test-bot-token';
process.env.TELEGRAM_CHAT_ID ??= 'test-chat-id';
process.env.TURNSTILE_SECRET ??= 'test-turnstile-secret';
process.env.ALLOWED_ORIGIN ??= 'https://example.com';
process.env.API_PUBLIC_URL ??= 'https://example.com/api';
process.env.IP_HASH_SALT ??= '1234567890abcdef';
process.env.NODE_ENV = 'test';
