'use client';

import { useLanguage } from '@/components/language-provider';
import { experiencesData } from '@/data/experience-data'; // Importar dados
import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';

export default function Experience() {
  const { t, language } = useLanguage(); // Adicionar language
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.1 });

  // Usar experiencesData e acessar a tradução correta
  const experiences = experiencesData.map((exp) => ({
    ...exp,
    ...exp.translations[language]
  }));

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5 } }
  };

  return (
    <section id="experience" className="py-16 md:py-24" ref={ref}>
      <h2 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl mb-8">
        {t('experience.title')}
      </h2>

      <motion.div
        variants={container}
        initial="hidden"
        animate={isInView ? 'show' : 'hidden'}
        className="relative border-l border-muted pl-6 ml-3"
      >
        {experiences.map((exp, index) => (
          <motion.div key={index} variants={item} className="mb-10 relative">
            <div className="absolute w-3 h-3 bg-primary rounded-full -left-[1.65rem] top-1.5 border-4 border-background"></div>
            <div className="inline-block px-2 py-1 text-xs rounded-full bg-primary/10 text-primary mb-2">
              {exp.period}
            </div>
            <h3 className="text-xl font-semibold">{exp.title}</h3>
            <p className="text-muted-foreground mb-2">{exp.company}</p>
            <p>{exp.description}</p>
          </motion.div>
        ))}
      </motion.div>

      <div className="mt-8"></div>
    </section>
  );
}
