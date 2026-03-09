import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { getClientIp } from './ip';

describe('getClientIp', () => {
  it('uses the rightmost X-Forwarded-For entry when one proxy is trusted', async () => {
    const app = new Hono();
    app.get('/ip', (c) => c.json({ ip: getClientIp(c as never) }));

    const res = await app.request('/ip', {
      headers: {
        'x-forwarded-for': '198.51.100.10, 203.0.113.20',
      },
    });

    const body = (await res.json()) as { ip: string };
    expect(body.ip).toBe('203.0.113.20');
  });

  it('uses Nth-from-right entry when multiple proxies are trusted', async () => {
    const app = new Hono();
    app.get('/ip', (c) => c.json({ ip: getClientIp(c as never, 2) }));

    const res = await app.request('/ip', {
      headers: {
        // leftmost entries can be client-controlled; trusted proxies append to the right
        'x-forwarded-for': '198.51.100.10, 203.0.113.20, 192.0.2.30',
      },
    });

    const body = (await res.json()) as { ip: string };
    expect(body.ip).toBe('203.0.113.20');
  });

  it('falls back to x-real-ip when x-forwarded-for is missing', async () => {
    const app = new Hono();
    app.get('/ip', (c) => c.json({ ip: getClientIp(c as never) }));

    const res = await app.request('/ip', {
      headers: {
        'x-real-ip': '198.51.100.42',
      },
    });

    const body = (await res.json()) as { ip: string };
    expect(body.ip).toBe('198.51.100.42');
  });

  it('returns unknown when no IP headers are present', async () => {
    const app = new Hono();
    app.get('/ip', (c) => c.json({ ip: getClientIp(c as never) }));

    const res = await app.request('/ip');
    const body = (await res.json()) as { ip: string };

    expect(body.ip).toBe('unknown');
  });
});
