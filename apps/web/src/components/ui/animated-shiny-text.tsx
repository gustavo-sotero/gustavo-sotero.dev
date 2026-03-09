import { cn } from '@/lib/utils';

interface AnimatedShinyTextProps {
  children: React.ReactNode;
  className?: string;
  shimmerWidth?: number;
  style?: React.CSSProperties;
}

export function AnimatedShinyText({
  children,
  className,
  shimmerWidth = 100,
  style,
}: AnimatedShinyTextProps) {
  return (
    <span
      style={
        {
          '--shiny-width': `${shimmerWidth}px`,
          ...style,
        } as React.CSSProperties
      }
      className={cn(
        'text-neutral-600/70 dark:text-neutral-400/70',

        // Shiny text
        'animate-shiny-text bg-clip-text bg-no-repeat bg-position-[0_0] bg-size-[var(--shiny-width)_100%] [transition:background-position_1s_cubic-bezier(.6,.6,0,1)_infinite]',

        // Shiny text gradient (light mode)
        'bg-linear-to-r from-transparent via-black/80 via-50% to-transparent',

        // Shiny text gradient (dark mode)
        'dark:bg-linear-to-r dark:from-transparent dark:via-white/80 dark:via-50% dark:to-transparent',

        className
      )}
    >
      {children}
    </span>
  );
}
