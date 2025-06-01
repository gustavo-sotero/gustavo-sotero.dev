'use client';

import { useLanguage } from '@/components/language-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { BlogPost as BlogPostType } from '@/data/blog-posts';
import { blogPosts } from '@/data/blog-posts';
import { fetchMarkdownContent } from '@/lib/markdown-utils';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { enUS, ptBR } from 'date-fns/locale';
import { ArrowLeft, Calendar, Clock } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';

export default function BlogPost() {
  const params = useParams();
  const { language } = useLanguage();
  const [post, setPost] = useState<BlogPostType | null>(null);
  const [loading, setLoading] = useState(true);
  const [markdownContent, setMarkdownContent] = useState<string | null>(null);
  const [contentLoading, setContentLoading] = useState(false);

  useEffect(() => {
    // Find the post with the matching slug
    const foundPost = blogPosts.find((p) => p.slug === params.slug);
    setPost(foundPost || null);
    setLoading(false);
  }, [params.slug]);

  useEffect(() => {
    async function loadMarkdownContent() {
      if (!post || !language) return;

      try {
        setContentLoading(true);
        const contentPath = post.translations[language].content;

        // Se o conteúdo já é o markdown em si (não um caminho), use-o diretamente
        if (contentPath.startsWith('#')) {
          setMarkdownContent(contentPath);
          return;
        }

        // Caso contrário, carregue o arquivo
        const content = await fetchMarkdownContent(contentPath);
        setMarkdownContent(content);
      } catch (error) {
        console.error('Erro ao carregar o conteúdo markdown:', error);
        setMarkdownContent(null);
      } finally {
        setContentLoading(false);
      }
    }

    loadMarkdownContent();
  }, [post, language]);

  // Format date based on current language
  const formatDate = (dateString: string) => {
    const date = parseISO(dateString);
    const locale = language === 'pt-BR' ? ptBR : enUS;
    return formatDistanceToNow(date, { addSuffix: true, locale });
  };

  if (loading) {
    return <BlogPostSkeleton />;
  }

  if (!post) {
    return <BlogPostNotFound />;
  }

  return (
    <div className="container max-w-4xl py-16 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Button variant="ghost" asChild className="mb-4">
          <Link href="/#blog" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Blog
          </Link>
        </Button>

        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl mb-4">
          {post.translations[language].title}
        </h1>

        <div className="flex flex-wrap items-center gap-4 text-muted-foreground mb-6">
          <span className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            {formatDate(post.date)}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            {post.readingTime} min read
          </span>
          <div className="flex flex-wrap gap-2">
            {post.translations[language].tags.map((tag, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <div className="prose prose-lg dark:prose-invert max-w-none">
        {contentLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-3/4" />
          </div>
        ) : markdownContent ? (
          <ReactMarkdown>{markdownContent}</ReactMarkdown>
        ) : (
          <div className="text-center p-8">
            <p className="text-muted-foreground">
              Erro ao carregar o conteúdo. Por favor, tente novamente mais
              tarde.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function BlogPostSkeleton() {
  return (
    <div className="container max-w-4xl py-16 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Skeleton className="h-10 w-32 mb-4" />
        <Skeleton className="h-12 w-full mb-4" />
        <Skeleton className="h-12 w-3/4 mb-6" />
        <div className="flex gap-4 mb-6">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-6 w-32" />
        </div>
      </div>
      <div className="space-y-4">
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-3/4" />
      </div>
    </div>
  );
}

function BlogPostNotFound() {
  return (
    <div className="container max-w-4xl py-16 px-4 sm:px-6 lg:px-8 text-center">
      <h1 className="text-3xl font-bold mb-4">Blog Post Not Found</h1>
      <p className="text-muted-foreground mb-8">
        The blog post you&apos;re looking for doesn&apos;t exist or has been
        removed.
      </p>
      <Button asChild>
        <Link href="/#blog">Back to Blog</Link>
      </Button>
    </div>
  );
}
