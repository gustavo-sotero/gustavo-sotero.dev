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
        title: 'Undergraduate in Software Engineering',
        institution: 'Cruzeiro do Sul University',
        period: '2025 - 2029',
        description: 'Expected graduation: 2029'
      },
      'pt-BR': {
        title: 'Graduando em Engenharia de Software',
        institution: 'Universidade Cruzeiro do Sul',
        period: '2025 - 2029',
        description: 'Conclusão prevista: 2029'
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
