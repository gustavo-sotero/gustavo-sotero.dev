import type { Language } from '@/components/language-provider';

export interface ExperienceItem {
  id: number;
  type: string; // e.g., "work"
  translations: {
    [key in Language]: {
      title: string;
      company: string;
      period: string;
      description: string;
    };
  };
}

export const experiencesData: ExperienceItem[] = [
  {
    id: 1,
    type: 'work',
    translations: {
      en: {
        title: 'Senior Back-End Developer',
        company: 'NOTZ LTDA.',
        period: '2023 - Present',
        description:
          'Development and Maintenance of Telegram Bot, Experience with PHP, PostgreSQL, Node.JS, JavaScript, TypeScript, Git, MongoDB, React.JS, Next.JS, and Docker.'
      },
      'pt-BR': {
        title: 'Desenvolvedor FullStack Independente',
        company: 'NOTZ LTDA.',
        period: '2023 - Presente',
        description:
          'Desenvolvimento e Manutenção de Bot para Telegram, Experiência com PHP, PostgreSQL, Node.JS, JavaScript, TypeScript, Git, MongoDB, React.JS, Next.JS e Docker.'
      }
    }
  }
];
