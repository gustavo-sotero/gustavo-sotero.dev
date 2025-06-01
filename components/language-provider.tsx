'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
  useCallback
} from 'react';

import { en } from '@/translations/en';
import { ptBR } from '@/translations/pt-BR';

export type Language = 'en' | 'pt-BR';

interface TranslationObject {
  [key: string]: string | TranslationObject;
}

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string) => string;
}

const translations = {
  en: en,
  'pt-BR': ptBR
};

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined
);

const LANGUAGE_STORAGE_KEY = 'preferred-language';

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('en'); // Default to 'en', will be updated

  useEffect(() => {
    // Função para detectar idioma baseado no fuso horário ou navegador
    const detectLanguageFromClient = (): Language => {
      try {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const portugueseSpeakingTimezones = [
          'America/Sao_Paulo',
          'America/Manaus',
          'America/Fortaleza',
          'America/Recife',
          'America/Bahia',
          'America/Belem',
          'America/Campo_Grande',
          'America/Cuiaba',
          'America/Porto_Velho',
          'America/Boa_Vista',
          'America/Rio_Branco',
          'America/Araguaina',
          'America/Maceio',
          'America/Noronha',
          'Europe/Lisbon',
          'Atlantic/Madeira',
          'Atlantic/Azores',
          'Africa/Luanda',
          'Africa/Maputo',
          'Atlantic/Cape_Verde',
          'Africa/Bissau',
          'Africa/Sao_Tome',
          'Asia/Dili',
          'Asia/Macau',
          'Asia/Kolkata'
        ];

        if (portugueseSpeakingTimezones.includes(timezone)) {
          return 'pt-BR';
        }

        const browserLanguage = navigator.language;
        if (browserLanguage.startsWith('pt')) {
          return 'pt-BR';
        }
        return 'en';
      } catch {
        const browserLanguage = navigator.language;
        return browserLanguage.startsWith('pt') ? 'pt-BR' : 'en';
      }
    };

    // 1. Verificar preferência salva no localStorage
    const savedLanguage = localStorage.getItem(
      LANGUAGE_STORAGE_KEY
    ) as Language | null;
    if (
      savedLanguage &&
      (savedLanguage === 'en' || savedLanguage === 'pt-BR')
    ) {
      setLanguage(savedLanguage);
    } else {
      // 2. Se não há preferência salva, detectar automaticamente no cliente
      const detectedLanguage = detectLanguageFromClient();
      setLanguage(detectedLanguage);
      localStorage.setItem(LANGUAGE_STORAGE_KEY, detectedLanguage); // Salvar detecção
    }
  }, []);

  const t = useCallback(
    (key: string): string => {
      const currentTranslations = translations[language] || translations.en;
      const parts = key.split('.');
      let result: string | TranslationObject | undefined = currentTranslations;

      for (const part of parts) {
        if (result && typeof result === 'object' && part in result) {
          result = result[part] as string | TranslationObject;
        } else {
          // Fallback to English if key not found in current language
          if (language !== 'en') {
            let fallbackResult: string | TranslationObject | undefined =
              translations.en;
            for (const fbPart of parts) {
              if (
                fallbackResult &&
                typeof fallbackResult === 'object' &&
                fbPart in fallbackResult
              ) {
                fallbackResult = fallbackResult[fbPart] as
                  | string
                  | TranslationObject;
              } else {
                return key; // Return key if not found in English either
              }
            }
            return typeof fallbackResult === 'string' ? fallbackResult : key;
          }
          return key; // Retorna a chave se não encontrar a tradução
        }
      }
      return typeof result === 'string' ? result : key;
    },
    [language]
  );

  // Efeito para atualizar o lang do HTML, título e meta descrição no cliente
  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.documentElement.lang = language;
      document.title = t('metadata.title');

      let descriptionMeta = document.querySelector('meta[name="description"]');
      if (!descriptionMeta) {
        descriptionMeta = document.createElement('meta');
        descriptionMeta.setAttribute('name', 'description');
        document.head.appendChild(descriptionMeta);
      }
      descriptionMeta.setAttribute('content', t('metadata.description'));
    }
  }, [language, t]);

  const handleSetLanguage = (newLanguage: Language) => {
    setLanguage(newLanguage);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, newLanguage);
  };

  return (
    <LanguageContext.Provider
      value={{ language, setLanguage: handleSetLanguage, t }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
