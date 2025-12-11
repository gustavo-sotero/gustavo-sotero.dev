import { logError, logPerformance, logUserEvent } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, data } = body;

    if (!type || !data) {
      return NextResponse.json(
        { error: 'Type and data are required' },
        { status: 400 }
      );
    }

    switch (type) {
      case 'performance':
        logPerformance(data.metric, data.value, data.unit);
        break;
      case 'user_event':
        logUserEvent(data.event, data.data);
        break;
      case 'error':
        logUserEvent('client_error', {
          message: data.message,
          stack: data.stack,
          url: data.url,
          userAgent: request.headers.get('user-agent')
        });
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid metric type' },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    logError('Failed to process metrics', error as Error);
    return NextResponse.json(
      { error: 'Failed to process metrics' },
      { status: 500 }
    );
  }
}
