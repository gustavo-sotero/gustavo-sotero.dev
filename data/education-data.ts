import type { Language } from '@/components/language-provider';

export interface EducationItem {
  id: number;
  translations: {
    [key in Language]: {
      title: string;
      institution: string;
      period: string;
      description: string;
    };
  };
}

export const educationData: EducationItem[] = [
  {
    id: 1,
    translations: {
      en: {
        title: 'Undergraduate in Analysis and Systems Development',
        institution: 'Tiradentes University',
        period: '2023 - 2025',
        description: ''
      },
      'pt-BR': {
        title: 'Graduando em Analise e Desenvolvimento de Sistemas',
        institution: 'Universidade Tiradentes',
        period: '2023 - 2025',
        description: ''
      }
    }
  },
  {
    id: 2,
    translations: {
      en: {
        title: 'Google Cloud Computing Foundations Certificate',
        institution: 'Google Cloud Skills Boost',
        period: '2025',
        description: 'Workload: +50 hours'
      },
      'pt-BR': {
        title: 'Google Cloud Computing Foundations Certificate',
        institution: 'Google Cloud Skills Boost',
        period: '2025',
        description: 'Carga horária: +50 horas'
      }
    }
  }
];
