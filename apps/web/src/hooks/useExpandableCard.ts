'use client';

import { useEffect, useRef, useState } from 'react';

function scheduleMeasurement(measure: () => void): () => void {
  if (typeof requestAnimationFrame === 'function') {
    const frameId = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(frameId);
  }

  const timeoutId = window.setTimeout(measure, 0);
  return () => window.clearTimeout(timeoutId);
}

export function useExpandableCard<ElementType extends HTMLElement>(
  collapsedHeight: number,
  dependencyKey: string
) {
  const cardRef = useRef<ElementType | null>(null);
  const [hasOverflow, setHasOverflow] = useState(false);

  useEffect(() => {
    void dependencyKey;

    const measure = () => {
      const card = cardRef.current;

      if (!card) {
        return;
      }

      setHasOverflow(card.scrollHeight > collapsedHeight + 1);
    };

    let cancelScheduledMeasurement = scheduleMeasurement(measure);

    if (typeof ResizeObserver === 'undefined' || !cardRef.current) {
      return () => {
        cancelScheduledMeasurement();
      };
    }

    const resizeObserver = new ResizeObserver(() => {
      cancelScheduledMeasurement();
      cancelScheduledMeasurement = scheduleMeasurement(measure);
    });

    resizeObserver.observe(cardRef.current);

    return () => {
      cancelScheduledMeasurement();
      resizeObserver.disconnect();
    };
  }, [collapsedHeight, dependencyKey]);

  return { cardRef, hasOverflow };
}
