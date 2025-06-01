'use client';

import { useState } from 'react';
import { useLanguage } from '@/components/language-provider';
import { motion } from 'framer-motion';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, Calendar, ChevronRight, Search, ArrowLeft } from 'lucide-react';
import { blogPosts } from '@/data/blog-posts';
import Link from 'next/link';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { enUS, ptBR } from 'date-fns/locale';

export default function BlogPage() {
  const { t, language } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Format date based on current language
  const formatDate = (dateString: string) => {
    const date = parseISO(dateString);
    const locale = language === 'pt-BR' ? ptBR : enUS;
    return formatDistanceToNow(date, { addSuffix: true, locale });
  };

  // Get all unique tags
  const allTags = Array.from(
    new Set(blogPosts.flatMap((post) => post.translations[language].tags))
  ).sort();

  // Filter posts based on search query and selected tag
  const filteredPosts = blogPosts.filter((post) => {
    const postTitle = post.translations[language].title.toLowerCase();
    const postExcerpt = post.translations[language].excerpt.toLowerCase();
    const postTags = post.translations[language].tags;
    const query = searchQuery.toLowerCase();

    const matchesSearch =
      !query ||
      postTitle.includes(query) ||
      postExcerpt.includes(query) ||
      postTags.some((tag) => tag.toLowerCase().includes(query));
    const matchesTag = !selectedTag || postTags.includes(selectedTag);

    return matchesSearch && matchesTag;
  });

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5 } }
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" asChild className="mb-4">
            <Link href="/" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              {t('blog.backToHome')}
            </Link>
          </Button>

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl mb-4">
            {t('blog.title')}
          </h1>
          <p className="text-lg text-muted-foreground">
            {t('blog.description')}
          </p>
        </div>

        {/* Search and Filters */}
        <div className="space-y-4 mb-8">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder={t('blog.searchPlaceholder')}
              className="w-full rounded-md border border-input bg-background pl-10 pr-4 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Tag filters */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedTag === null ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedTag(null)}
            >
              {t('blog.allTags')}
            </Button>
            {allTags.map((tag) => (
              <Button
                key={tag}
                variant={selectedTag === tag ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedTag(tag)}
              >
                {tag}
              </Button>
            ))}
          </div>
        </div>

        {/* Blog posts grid */}
        {filteredPosts.length > 0 ? (
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filteredPosts.map((post, index) => (
              <motion.div key={post.id} variants={item} custom={index}>
                <Card className="h-full flex flex-col hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle className="line-clamp-2">
                      {post.translations[language].title}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-4 mt-2">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {formatDate(post.date)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {post.readingTime} {t('blog.minuteRead')}
                      </span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <p className="text-muted-foreground line-clamp-3">
                      {post.translations[language].excerpt}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-4">
                      {post.translations[language].tags.map((tag, tagIndex) => (
                        <Badge
                          key={tagIndex}
                          variant="secondary"
                          className="text-xs cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                          onClick={(e) => {
                            e.preventDefault();
                            setSelectedTag(tag);
                          }}
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button asChild className="w-full">
                      <Link
                        href={`/blog/${post.slug}`}
                        className="flex items-center justify-center gap-2"
                      >
                        {t('blog.readMore')}
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <Card className="text-center p-8">
            <CardHeader>
              <CardTitle>{t('blog.noResults')}</CardTitle>
              <CardDescription>{t('blog.tryDifferentSearch')}</CardDescription>
            </CardHeader>
          </Card>
        )}
      </motion.div>
    </div>
  );
}
