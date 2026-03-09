'use client';

import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

interface Meteor {
  id: number;
  left: string;
  top: string;
  width: string;
  animationDelay: string;
  animationDuration: string;
}

interface MeteorsProps {
  number?: number;
  minDelay?: number;
  maxDelay?: number;
  minDuration?: number;
  maxDuration?: number;
  angle?: number;
  className?: string;
}

export function Meteors({
  number = 20,
  minDelay = 0.2,
  maxDelay = 1.2,
  minDuration = 2,
  maxDuration = 10,
  angle = 215,
  className,
}: MeteorsProps) {
  const [meteorStyles, setMeteorStyles] = useState<Meteor[]>([]);

  useEffect(() => {
    const styles = Array.from({ length: number }, (_, i) => ({
      id: i,
      left: `${Math.floor(Math.random() * window.innerWidth)}px`,
      top: `${Math.random() * 100}vh`,
      width: `${Math.floor(Math.random() * (100 - 20) + 20)}px`,
      animationDelay: `${(Math.random() * (maxDelay - minDelay) + minDelay).toFixed(2)}s`,
      animationDuration: `${(Math.random() * (maxDuration - minDuration) + minDuration).toFixed(2)}s`,
    }));
    setMeteorStyles(styles);
  }, [number, minDelay, maxDelay, minDuration, maxDuration]);

  return (
    <>
      {meteorStyles.map((style) => (
        <span
          key={style.id}
          style={{
            top: style.top,
            left: style.left,
            width: style.width,
            animationDelay: style.animationDelay,
            animationDuration: style.animationDuration,
            transform: `rotate(${angle}deg)`,
          }}
          className={cn(
            'pointer-events-none absolute h-0.5 rounded-full bg-zinc-500',
            'before:absolute before:top-1/2 before:h-px before:w-12.5 before:-translate-y-[50%] before:rounded-full',
            "before:bg-linear-to-r before:from-transparent before:to-current before:opacity-50 before:content-['']",
            'animate-meteor',
            className
          )}
        />
      ))}
    </>
  );
}
