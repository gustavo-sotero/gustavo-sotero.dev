'use client';

import type { Language } from '@/components/language-provider';

export interface BlogPost {
  id: number;
  slug: string;
  date: string;
  readingTime: number;
  translations: {
    [key in Language]: {
      title: string;
      excerpt: string;
      content: string;
      tags: string[];
    };
  };
}

export const blogPosts: BlogPost[] = [
  {
    id: 1,
    slug: 'how-to-start-a-career-in-tech',
    date: '2025-07-01',
    readingTime: 5,
    translations: {
      en: {
        title: 'How to Start a Career in Tech',
        excerpt:
          'A guide for aspiring developers to navigate their journey into the tech industry.',
        content: '/content/blog/en/how-to-start-a-career-in-tech.md',
        tags: ['Career', 'Development', 'Junior']
      },
      'pt-BR': {
        title: 'Como Iniciar uma Carreira em Tecnologia',
        excerpt:
          'Um guia para desenvolvedores aspirantes navegarem em sua jornada na indústria de tecnologia.',
        content:
          '/content/blog/pt-br/como-iniciar-uma-carreira-em-tecnologia.md',
        tags: ['Carreira', 'Desenvolvimento', 'Júnior']
      }
    }
  },
  {
    id: 2,
    slug: '5-tips-for-your-first-job-interview',
    date: '2025-06-25',
    readingTime: 3,
    translations: {
      en: {
        title: '5 Tips for Your First Job Interview',
        excerpt:
          'Five tips to help you prepare and succeed in your first technical interview.',
        content: '/content/blog/en/5-tips-for-your-first-job-interview.md',
        tags: ['Career', 'Interview', 'Junior']
      },
      'pt-BR': {
        title: '5 Dicas para Sua Primeira Entrevista de Emprego',
        excerpt:
          'Cinco dicas para ajudá-lo a se preparar e ter sucesso em sua primeira entrevista técnica.',
        content:
          '/content/blog/pt-br/5-dicas-para-sua-primeira-entrevista-de-emprego.md',
        tags: ['Carreira', 'Entrevista', 'Júnior']
      }
    }
  },
  {
    id: 3,
    slug: 'a-junior-developers-guide-to-git-and-github',
    date: '2025-06-18',
    readingTime: 4,
    translations: {
      en: {
        title: "A Junior Developer's Guide to Git and GitHub",
        excerpt:
          'A guide covering the basic concepts of Git and GitHub to get you started.',
        content:
          '/content/blog/en/a-junior-developers-guide-to-git-and-github.md',
        tags: ['Git', 'GitHub', 'Development', 'Junior']
      },
      'pt-BR': {
        title: 'Um Guia de Git e GitHub para Desenvolvedores Júniores',
        excerpt:
          'Um guia cobrindo os conceitos básicos de Git e GitHub para você começar.',
        content:
          '/content/blog/pt-br/um-guia-de-git-e-github-para-desenvolvedores-juniores.md',
        tags: ['Git', 'GitHub', 'Desenvolvimento', 'Júnior']
      }
    }
  }
];
