'use client';

import { useLanguage } from '@/components/language-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { blogPosts } from '@/data/blog-posts';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { enUS, ptBR } from 'date-fns/locale';
import { motion, useInView } from 'framer-motion';
import { Calendar, ChevronRight, Clock, Search } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState } from 'react';

export default function Blog() {
  const { t, language } = useLanguage();
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.1 });
  const [searchQuery, setSearchQuery] = useState('');

  // Format date based on current language
  const formatDate = (dateString: string) => {
    const date = parseISO(dateString);
    const locale = language === 'pt-BR' ? ptBR : enUS;
    return formatDistanceToNow(date, { addSuffix: true, locale });
  };

  // Filter posts based on search query
  const filteredPosts = blogPosts.filter((post) => {
    const postTitle = post.translations[language].title.toLowerCase();
    const postExcerpt = post.translations[language].excerpt.toLowerCase();
    const postTags = post.translations[language].tags.join(' ').toLowerCase();
    const query = searchQuery.toLowerCase().trim();

    return (
      postTitle.includes(query) ||
      postExcerpt.includes(query) ||
      postTags.includes(query)
    );
  });

  return (
    <section id="blog" className="py-16 md:py-24" ref={ref}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl mb-8">
          {t('blog.title')}
        </h2>

        {/* Search bar */}
        <div className="relative mb-8">
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
        </div>

        {filteredPosts.slice(0, 3).length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPosts.slice(0, 3).map((post, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={
                  isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }
                }
                transition={{ duration: 0.5, delay: Number(index) * 0.1 }}
              >
                <Card className="h-full flex flex-col hover:shadow-md transition-shadow">
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
                      {post.translations[language].tags.map((tag, index) => (
                        <Badge
                          key={index}
                          variant="secondary"
                          className="text-xs"
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
          </div>
        ) : (
          <Card className="text-center p-8">
            <CardHeader>
              <CardTitle>{t('blog.noResults')}</CardTitle>
              <CardDescription>{t('blog.tryDifferentSearch')}</CardDescription>
            </CardHeader>
          </Card>
        )}
        {/* Botão para ver todos os artigos */}
        <div className="mt-8 text-center">
          <Button asChild size="lg" variant="outline">
            <Link href="/blog" className="inline-flex items-center gap-2">
              {t('blog.viewAll')}
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </motion.div>
    </section>
  );
}
