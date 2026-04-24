import React, { type ComponentPropsWithoutRef, type CSSProperties } from 'react';

import { cn } from '@/lib/utils';

interface ShimmerSurfaceProps {
  shimmerColor?: string;
  shimmerSize?: string;
  borderRadius?: string;
  shimmerDuration?: string;
  background?: string;
  className?: string;
  children?: React.ReactNode;
}

export interface ShimmerButtonProps
  extends ComponentPropsWithoutRef<'button'>,
    ShimmerSurfaceProps {}

export interface ShimmerLinkProps extends ComponentPropsWithoutRef<'a'>, ShimmerSurfaceProps {}

function buildShimmerStyle({
  shimmerColor,
  shimmerSize,
  borderRadius,
  shimmerDuration,
  background,
}: ShimmerSurfaceProps): CSSProperties {
  return {
    '--spread': '90deg',
    '--shimmer-color': shimmerColor ?? '#ffffff',
    '--radius': borderRadius ?? '100px',
    '--speed': shimmerDuration ?? '3s',
    '--cut': shimmerSize ?? '0.05em',
    '--bg': background ?? 'rgba(0, 0, 0, 1)',
  } as CSSProperties;
}

function buildShimmerClassName(className?: string): string {
  return cn(
    'group relative z-0 flex cursor-pointer items-center justify-center overflow-hidden [border-radius:var(--radius)] border border-white/10 px-6 py-3 whitespace-nowrap text-white [background:var(--bg)]',
    'transform-gpu transition-transform duration-300 ease-in-out active:translate-y-px',
    className
  );
}

function ShimmerLayers() {
  return (
    <>
      <div
        className={cn('-z-30 blur-[2px]', '@container-[size] absolute inset-0 overflow-visible')}
      >
        <div className="animate-shimmer-slide absolute inset-0 aspect-[1] h-[100cqh] rounded-none [mask:none]">
          <div className="animate-spin-around absolute -inset-full w-auto [translate:0_0] rotate-0 [background:conic-gradient(from_calc(270deg-(var(--spread)*0.5)),transparent_0,var(--shimmer-color)_var(--spread),transparent_var(--spread))]" />
        </div>
      </div>

      <div
        className={cn(
          'absolute inset-0 size-full',
          'rounded-2xl px-4 py-1.5 text-sm font-medium shadow-[inset_0_-8px_10px_#ffffff1f]',
          'transform-gpu transition-all duration-300 ease-in-out',
          'group-hover:shadow-[inset_0_-6px_10px_#ffffff3f]',
          'group-active:shadow-[inset_0_-10px_10px_#ffffff3f]'
        )}
      />

      <div
        className={cn(
          'absolute inset-(--cut) -z-20 [border-radius:var(--radius)] [background:var(--bg)]'
        )}
      />
    </>
  );
}

export const ShimmerButton = React.forwardRef<HTMLButtonElement, ShimmerButtonProps>(
  (
    {
      className,
      children,
      shimmerColor,
      shimmerSize,
      borderRadius,
      shimmerDuration,
      background,
      ...props
    },
    ref
  ) => {
    return (
      <button
        style={buildShimmerStyle({
          shimmerColor,
          shimmerSize,
          borderRadius,
          shimmerDuration,
          background,
        })}
        className={buildShimmerClassName(className)}
        ref={ref}
        {...props}
      >
        {children}
        <ShimmerLayers />
      </button>
    );
  }
);

ShimmerButton.displayName = 'ShimmerButton';

export const ShimmerLink = React.forwardRef<HTMLAnchorElement, ShimmerLinkProps>(
  (
    {
      className,
      children,
      shimmerColor,
      shimmerSize,
      borderRadius,
      shimmerDuration,
      background,
      ...props
    },
    ref
  ) => {
    return (
      <a
        style={buildShimmerStyle({
          shimmerColor,
          shimmerSize,
          borderRadius,
          shimmerDuration,
          background,
        })}
        className={buildShimmerClassName(className)}
        ref={ref}
        {...props}
      >
        {children}
        <ShimmerLayers />
      </a>
    );
  }
);

ShimmerLink.displayName = 'ShimmerLink';
