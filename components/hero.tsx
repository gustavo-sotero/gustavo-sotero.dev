'use client';

import { useLanguage } from '@/components/language-provider';
import { ResumeButton } from '@/components/resume-button';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { ChevronDown, Github, Linkedin, Send } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

export default function Hero() {
  const { t } = useLanguage();

  const socialLinks = [
    {
      name: 'GitHub',
      icon: <Github size={20} />,
      url: 'https://github.com/gustavo-sotero',
      color: 'hover:text-[#333] dark:hover:text-white'
    },
    {
      name: 'LinkedIn',
      icon: <Linkedin size={20} />,
      url: 'https://linkedin.com/in/gustavo-sotero',
      color: 'hover:text-[#0077B5]'
    },
    {
      name: 'Telegram',
      icon: <Send size={20} />,
      url: 'https://t.me/gustavo_sotero',
      color: 'hover:text-[#0088cc]'
    }
  ];

  return (
    <section
      id="home"
      className="min-h-[calc(100vh-4rem)] flex items-center relative pb-16 sm:pb-8 md:pb-0"
    >
      <div className="grid grid-cols-1 gap-12 md:grid-cols-2 md:gap-16 items-center w-full py-8 md:py-0">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl mb-4">
            {t('hero.greeting')}{' '}
            <span className="text-primary">Gustavo Sotero</span>
            <br />
            {t('hero.title')}
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            {t('hero.subtitle')}
          </p>

          <div className="flex flex-wrap gap-4 mb-6">
            {/* Always show full text on the Resume Button */}
            <ResumeButton
              variant="default"
              size="default"
              showFullText={true}
            />

            <Button variant="outline" size="default" asChild>
              <Link href="#contact" className="flex items-center gap-2">
                <Send size={16} />
                {t('hero.contactMe')}
              </Link>
            </Button>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {t('hero.findMe')}:
            </span>
            <div className="flex gap-2">
              {socialLinks.map((link, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.6 + index * 0.1 }}
                >
                  <Link
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`transition-colors duration-200 ${link.color}`}
                    aria-label={link.name}
                  >
                    <Button variant="ghost" size="icon" className="h-9 w-9">
                      {link.icon}
                    </Button>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex justify-center mb-8 md:mb-0"
        >
          <div className="relative w-56 h-56 sm:w-64 sm:h-64 md:w-80 md:h-80 rounded-full overflow-hidden border-4 border-primary/20">
            <Image
              src="/gustavo-sotero.webp"
              alt="Gustavo Sotero"
              fill
              className="object-cover"
              priority
            />
          </div>
        </motion.div>
      </div>

      {/* Seta animada indicando scroll */}
      <div className="absolute bottom-4 sm:bottom-8 left-0 right-0 flex justify-center">
        <Link href="#about" aria-label={t('hero.scrollDown')}>
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.5 }}
            className="flex flex-col items-center cursor-pointer"
          >
            <span className="text-sm text-muted-foreground mb-2">
              {t('hero.scrollDown')}
            </span>
            <motion.div
              animate={{ y: [0, 10, 0] }}
              transition={{
                duration: 1.5,
                repeat: Number.POSITIVE_INFINITY,
                repeatType: 'loop',
                ease: 'easeInOut'
              }}
              className="bg-primary/10 rounded-full p-2"
            >
              <ChevronDown className="h-6 w-6 text-primary" />
            </motion.div>
          </motion.div>
        </Link>
      </div>
    </section>
  );
}
