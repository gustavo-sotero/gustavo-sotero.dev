'use client';

import { useLanguage } from '@/components/language-provider';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

interface ResumeButtonProps {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
  mobile?: boolean;
  showFullText?: boolean;
  compact?: boolean;
}

export function ResumeButton({
  variant = 'outline',
  size = 'sm',
  className = '',
  mobile = false,
  showFullText = false,
  compact = false
}: ResumeButtonProps) {
  const { t, language } = useLanguage();

  // Mapeia o idioma para o arquivo de currículo correspondente
  const resumeFiles = {
    en: '/resumes/cv-gustavo-sotero-en.pdf',
    'pt-BR': '/resumes/cv-gustavo-sotero.pdf'
  };

  const resumeFile = resumeFiles[language] || resumeFiles['en'];

  // Determine what text to show based on compact mode
  const buttonText = compact ? 'CV' : t('resume.download');

  // Função para lidar com o download
  const handleDownload = () => {
    // Criar um link temporário para forçar o download
    const link = document.createElement('a');
    link.href = resumeFile;
    link.download = `gustavo-sotero-cv-${
      language === 'pt-BR' ? 'pt' : 'en'
    }.pdf`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';

    // Adicionar ao DOM, clicar e remover
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Button
      variant={variant}
      size={mobile ? 'lg' : size}
      className={`gap-1 ${className} ${mobile ? 'w-full' : ''}`}
      onClick={handleDownload}
      aria-label={t('resume.download')}
    >
      <Download size={mobile ? 18 : 16} />
      <span
        className={showFullText || !compact ? 'inline' : 'hidden sm:inline'}
      >
        {buttonText}
      </span>
    </Button>
  );
}
