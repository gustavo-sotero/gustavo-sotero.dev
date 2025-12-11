'use client';

import { useEffect } from 'react';
import type { Metric } from 'web-vitals';

// Helper function to send metrics to the server
function sendMetric(type: string, data: Record<string, unknown>) {
  fetch('/api/metrics', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type,
      data: {
        ...data,
        timestamp: new Date().toISOString()
      }
    })
  }).catch(() => {
    // Falha silenciosa para não afetar a experiência do usuário
  });
}

// Hook para medir performance de componentes
export function usePerformanceMetrics(componentName: string) {
  useEffect(() => {
    const startTime = performance.now();

    // Log quando o componente monta
    sendMetric('user_event', {
      event: 'component_mount',
      component: componentName
    });

    return () => {
      // Log quando o componente desmonta e calcula tempo de vida
      const lifetime = performance.now() - startTime;
      sendMetric('performance', {
        metric: `${componentName}_lifetime`,
        value: lifetime,
        unit: 'ms'
      });
    };
  }, [componentName]);
}

// Hook para observar Web Vitals
export function useWebVitals() {
  useEffect(() => {
    // Observa Core Web Vitals apenas no cliente
    if (typeof window !== 'undefined') {
      import('web-vitals').then(({ onCLS, onINP, onFCP, onLCP, onTTFB }) => {
        onCLS((metric: Metric) => {
          sendMetric('performance', {
            metric: 'CLS',
            value: metric.value,
            unit: 'score'
          });
        });

        onINP((metric: Metric) => {
          sendMetric('performance', {
            metric: 'INP',
            value: metric.value,
            unit: 'ms'
          });
        });

        onFCP((metric: Metric) => {
          sendMetric('performance', {
            metric: 'FCP',
            value: metric.value,
            unit: 'ms'
          });
        });

        onLCP((metric: Metric) => {
          sendMetric('performance', {
            metric: 'LCP',
            value: metric.value,
            unit: 'ms'
          });
        });

        onTTFB((metric: Metric) => {
          sendMetric('performance', {
            metric: 'TTFB',
            value: metric.value,
            unit: 'ms'
          });
        });
      });
    }
  }, []);
}

// Hook para rastrear interações do usuário
export function useUserInteractionTracking() {
  useEffect(() => {
    const trackClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target) {
        sendMetric('user_event', {
          event: 'click',
          element: target.tagName.toLowerCase(),
          id: target.id || undefined,
          className: target.className || undefined,
          text: target.textContent?.substring(0, 50) || undefined
        });
      }
    };

    const trackScroll = () => {
      const scrollPercentage = Math.round(
        (window.scrollY / (document.body.scrollHeight - window.innerHeight)) *
          100
      );

      if (scrollPercentage % 25 === 0) {
        // Log a cada 25% do scroll
        sendMetric('user_event', {
          event: 'scroll',
          percentage: scrollPercentage
        });
      }
    };

    document.addEventListener('click', trackClick);
    window.addEventListener('scroll', trackScroll, { passive: true });

    return () => {
      document.removeEventListener('click', trackClick);
      window.removeEventListener('scroll', trackScroll);
    };
  }, []);
}
