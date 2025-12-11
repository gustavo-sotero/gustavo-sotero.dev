import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const start = Date.now();
  const { pathname, search } = request.nextUrl;
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const ip =
    request.headers.get('x-forwarded-for') ||
    request.headers.get('x-real-ip') ||
    'unknown';
  const referer = request.headers.get('referer') || 'direct';

  // Log da requisição
  logger.info(
    {
      type: 'request',
      method: request.method,
      pathname,
      search,
      userAgent,
      ip: ip.split(',')[0], // Pega apenas o primeiro IP se houver múltiplos
      referer,
      timestamp: new Date().toISOString()
    },
    `${request.method} ${pathname}${search}`
  );

  // Continua o processamento da requisição
  const response = NextResponse.next();

  // Adiciona headers de segurança e observabilidade
  response.headers.set('X-Response-Time', `${Date.now() - start}ms`);
  response.headers.set('X-Request-ID', crypto.randomUUID());

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)'
  ]
};
