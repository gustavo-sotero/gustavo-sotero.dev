'use client';

import type { Post } from '@portfolio/shared/types/posts';
import { CalendarDays, ChevronDown } from 'lucide-react';
import { motion } from 'motion/react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { BorderBeam } from '@/components/ui/border-beam';
import { formatDateBR } from '@/lib/utils';

interface PostCardProps {
  post: Post;
}

const CONTENT_COLLAPSED_HEIGHT = 180;

export function PostCard({ post }: PostCardProps) {
  const tags = post.tags ?? [];
  const dateStr = formatDateBR(post.publishedAt ?? post.createdAt);
  const [expanded, setExpanded] = useState(false);

  const needsExpand = !!post.excerpt && post.excerpt.length > 150;

  return (
    <div className="group relative flex flex-col glass-card rounded-xl overflow-hidden hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/5 transition-[box-shadow,border-color] duration-300">
      {/* Stretched link — covers entire card, below action buttons (z-10) */}
      <Link
        href={`/blog/${post.slug}`}
        className="absolute inset-0 z-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 rounded-xl"
        aria-label={`Ler post: ${post.title}`}
      />
      <BorderBeam colorFrom="#34d399" colorTo="#22d3ee" duration={4} size={100} />
      {/* Cover image */}
      <div className="relative aspect-4/3 w-full bg-zinc-800/60 overflow-hidden">
        {post.coverUrl ? (
          <Image
            src={post.coverUrl}
            alt={post.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className="h-full w-full bg-linear-to-br from-zinc-800 to-zinc-900 flex items-center justify-center">
            <div className="font-mono text-zinc-700 text-xs opacity-50 select-none">
              {'{ post }'}
            </div>
          </div>
        )}
        <div className="absolute inset-0 bg-linear-to-t from-zinc-950/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>

      {/* Content — animated height; image above is never clipped */}
      <motion.div
        className="relative"
        initial={false}
        animate={{ height: expanded ? 'auto' : CONTENT_COLLAPSED_HEIGHT }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        style={{ overflow: 'hidden' }}
      >
      <div className="flex flex-col flex-1 p-5 gap-3 pb-12">
        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <Badge
                key={tag.id}
                variant="secondary"
                className="text-xs border bg-zinc-800/80 text-zinc-400 border-zinc-700/50 hover:bg-zinc-700/80"
              >
                {tag.name}
              </Badge>
            ))}
          </div>
        )}

        {/* Title */}
        <h3 className="font-semibold text-zinc-100 line-clamp-2 group-hover:text-emerald-400 transition-colors duration-200 leading-snug">
          {post.title}
        </h3>

        {/* Excerpt — full text; card-level overflow clips when collapsed */}
        {post.excerpt && (
          <p className="text-sm text-zinc-500 leading-relaxed">{post.excerpt}</p>
        )}

        {/* Footer - date */}
        <div className="flex items-center gap-1.5 text-xs text-zinc-600 mt-auto pt-2 border-t border-zinc-800/60">
          <CalendarDays className="h-3 w-3" />
          <time dateTime={post.publishedAt ?? post.createdAt ?? undefined}>{dateStr}</time>
        </div>
      </div>

      {/* Gradient fade + expand button — absolutely anchored at card bottom */}
      {needsExpand && (
        <>
          <motion.div
            initial={false}
            animate={{ opacity: expanded ? 0 : 1 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="absolute bottom-0 left-0 right-0 h-20 bg-linear-to-t from-zinc-950 via-zinc-950/60 to-transparent pointer-events-none z-5"
          />
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 text-xs font-medium text-emerald-500 hover:text-emerald-400 transition-colors bg-zinc-950/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-zinc-800/60 hover:border-emerald-500/30 whitespace-nowrap"
          >
            <motion.span
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="flex"
            >
              <ChevronDown className="h-3 w-3" />
            </motion.span>
            Mostrar {expanded ? 'menos' : 'mais'}
          </button>
        </>
      )}
      </motion.div>
    </div>
  );
}
