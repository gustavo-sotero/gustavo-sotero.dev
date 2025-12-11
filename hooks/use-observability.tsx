import { logPerformance, logUserEvent } from '@/lib/logger';
import { useEffect } from 'react';
import type { Metric } from 'web-vitals';

// Hook para medir performance de componentes
export function usePerformanceMetrics(componentName: string) {
  useEffect(() => {
    const startTime = performance.now();

    // Log quando o componente monta
    logUserEvent('component_mount', { component: componentName });

    return () => {
      // Log quando o componente desmonta e calcula tempo de vida
      const lifetime = performance.now() - startTime;
      logPerformance(`${componentName}_lifetime`, lifetime);
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
          logPerformance('CLS', metric.value, 'score');
        });

        onINP((metric: Metric) => {
          logPerformance('INP', metric.value, 'ms');
        });

        onFCP((metric: Metric) => {
          logPerformance('FCP', metric.value, 'ms');
        });

        onLCP((metric: Metric) => {
          logPerformance('LCP', metric.value, 'ms');
        });

        onTTFB((metric: Metric) => {
          logPerformance('TTFB', metric.value, 'ms');
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
        logUserEvent('click', {
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
        logUserEvent('scroll', { percentage: scrollPercentage });
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
