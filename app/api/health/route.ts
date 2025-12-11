import { logError, logInfo } from '@/lib/logger';
import { NextResponse } from 'next/server';

export async function GET() {
  const startTime = Date.now();

  try {
    // Informações básicas do sistema
    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'gustavo-sotero.dev',
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      memory: {
        used:
          Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) /
          100,
        total:
          Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) /
          100
      },
      responseTime: Date.now() - startTime
    };

    logInfo('Health check performed', {
      type: 'health_check',
      responseTime: healthData.responseTime,
      memory: healthData.memory
    });

    return NextResponse.json(healthData, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Response-Time': `${healthData.responseTime}ms`
      }
    });
  } catch (error) {
    logError('Health check failed', error as Error);

    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        service: 'gustavo-sotero.dev',
        error: 'Internal server error',
        responseTime: Date.now() - startTime
      },
      { status: 500 }
    );
  }
}
