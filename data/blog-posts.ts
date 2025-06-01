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
    slug: 'microservices-architecture-best-practices',
    date: '2023-12-15',
    readingTime: 8,
    translations: {
      en: {
        title:
          'Microservices Architecture: Best Practices for Scalable Applications',
        excerpt:
          'Learn the key principles and best practices for designing and implementing microservices architecture that scales effectively.',
        content:
          '/content/blog/en/microservices-architecture-best-practices.md',
        tags: ['Microservices', 'Architecture', 'Scalability', 'Backend']
      },
      'pt-BR': {
        title:
          'Arquitetura de Microsserviços: Melhores Práticas para Aplicações Escaláveis',
        excerpt:
          'Aprenda os princípios fundamentais e as melhores práticas para projetar e implementar uma arquitetura de microsserviços que escala efetivamente.',
        content:
          '/content/blog/pt-br/microservices-architecture-best-practices.md',
        tags: ['Microsserviços', 'Arquitetura', 'Escalabilidade', 'Backend']
      }
    }
  },
  {
    id: 2,
    slug: 'react-performance-optimization-techniques',
    date: '2023-11-20',
    readingTime: 6,
    translations: {
      en: {
        title: 'React Performance Optimization Techniques',
        excerpt:
          'Discover practical techniques to optimize your React applications for better performance and user experience.',
        content:
          '/content/blog/en/react-performance-optimization-techniques.md',
        tags: ['React', 'Performance', 'JavaScript', 'Frontend']
      },
      'pt-BR': {
        title: 'Técnicas de Otimização de Performance em React',
        excerpt:
          'Descubra técnicas práticas para otimizar suas aplicações React para melhor performance e experiência do usuário.',
        content:
          '/content/blog/pt-br/react-performance-optimization-techniques.md',
        tags: ['React', 'Performance', 'JavaScript', 'Frontend']
      }
    }
  },
  {
    id: 3,
    slug: 'securing-nodejs-applications',
    date: '2023-10-05',
    readingTime: 7,
    translations: {
      en: {
        title: 'Securing Node.js Applications: A Comprehensive Guide',
        excerpt:
          'Learn essential security practices to protect your Node.js applications from common vulnerabilities and attacks.',
        content: '/content/blog/en/securing-nodejs-applications.md',
        tags: ['Node.js', 'Security', 'JavaScript', 'Backend']
      },
      'pt-BR': {
        title: 'Protegendo Aplicações Node.js: Um Guia Abrangente',
        excerpt:
          'Aprenda práticas essenciais de segurança para proteger suas aplicações Node.js contra vulnerabilidades e ataques comuns.',
        content: '/content/blog/pt-br/securing-nodejs-applications.md',
        tags: ['Node.js', 'Segurança', 'JavaScript', 'Backend']
      }
    }
  }
];
