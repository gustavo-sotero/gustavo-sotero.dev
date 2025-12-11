'use client';

import { useEffect } from 'react';

// Hook para capturar erros globais do JavaScript
export function useErrorTracking() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      // Envia erro para o endpoint de métricas
      fetch('/api/metrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'error',
          data: {
            message: event.message,
            stack: event.error?.stack,
            url: event.filename,
            line: event.lineno,
            column: event.colno,
            timestamp: new Date().toISOString()
          }
        })
      }).catch(() => {
        // Falha silenciosa para não afetar a experiência do usuário
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      fetch('/api/metrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'error',
          data: {
            message: `Unhandled Promise Rejection: ${event.reason}`,
            stack: event.reason?.stack,
            url: window.location.href,
            timestamp: new Date().toISOString()
          }
        })
      }).catch(() => {
        // Falha silenciosa
      });
    };

    // Adiciona listeners de erro global
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener(
        'unhandledrejection',
        handleUnhandledRejection
      );
    };
  }, []);
}

// Função para reportar erros manualmente
export function reportError(error: Error, context?: Record<string, unknown>) {
  fetch('/api/metrics', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type: 'error',
      data: {
        message: error.message,
        stack: error.stack,
        url: window.location.href,
        context,
        timestamp: new Date().toISOString()
      }
    })
  }).catch(() => {
    // Falha silenciosa
  });
}
