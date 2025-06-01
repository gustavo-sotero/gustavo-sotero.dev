'use client';

import { useLanguage } from '@/components/language-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion, useInView } from 'framer-motion';
import { Github, Linkedin, Send } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

// Definindo o esquema de validação com zod
const formSchema = z.object({
  name: z.string().min(2, { message: 'Nome deve ter pelo menos 2 caracteres' }),
  email: z.string().email({ message: 'Email inválido' }),
  message: z
    .string()
    .min(10, { message: 'Mensagem deve ter pelo menos 10 caracteres' })
});

// Definindo o tipo do formulário baseado no esquema
type FormValues = z.infer<typeof formSchema>;

export default function Contact() {
  const { t } = useLanguage();
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.1 });

  // Estado para feedback do usuário
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string | null;
  }>({
    type: null,
    message: null
  });

  // Inicializando react-hook-form com resolver do zod
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      message: ''
    }
  });

  // Manipular envio do formulário
  const onSubmit = async (data: FormValues) => {
    try {
      setIsSubmitting(true);
      setSubmitStatus({ type: null, message: null });

      // Enviar os dados para a API
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || 'Erro ao enviar mensagem');
      }

      // Limpar o formulário em caso de sucesso
      reset();
      setSubmitStatus({
        type: 'success',
        message:
          responseData.message ||
          t('contact.form.successMessage') ||
          'Mensagem enviada com sucesso!'
      });
    } catch (error) {
      console.error('Erro ao enviar formulário:', error);
      setSubmitStatus({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : t('contact.form.errorMessage') ||
              'Erro ao enviar mensagem. Tente novamente.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const socialLinks = [
    {
      name: 'GitHub',
      icon: <Github size={24} />,
      url: 'https://github.com/gustavo-sotero',
      color: 'hover:text-[#333]'
    },
    {
      name: 'LinkedIn',
      icon: <Linkedin size={24} />,
      url: 'https://linkedin.com/in/gustavo-sotero',
      color: 'hover:text-[#0077B5]'
    },
    {
      name: 'Telegram',
      icon: <Send size={24} />,
      url: 'https://t.me/gustavo_sotero',
      color: 'hover:text-[#0088cc]'
    }
  ];

  return (
    <section id="contact" className="py-16 md:py-24" ref={ref}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl mb-8">
          {t('contact.title')}
        </h2>

        <Card>
          <CardContent className="p-6">
            <div className="text-center mb-6">
              <p className="text-lg mb-4">{t('contact.description')}</p>
            </div>

            <div className="flex justify-center space-x-6">
              {socialLinks.map((link, index) => (
                <Link
                  key={index}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`transition-colors duration-200 ${link.color} dark:hover:text-white`}
                >
                  <Button variant="ghost" size="icon" aria-label={link.name}>
                    {link.icon}
                  </Button>
                  <span className="sr-only">{link.name}</span>
                </Link>
              ))}
            </div>

            <div className="mt-8">
              <h3 className="text-lg font-semibold mb-4 text-center">
                {t('contact.orSendMessage')}
              </h3>

              {/* Feedback de status para o usuário */}
              {submitStatus.type && (
                <div
                  className={`mb-4 p-3 rounded text-center ${
                    submitStatus.type === 'success'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
                      : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100'
                  }`}
                >
                  {submitStatus.message}
                </div>
              )}

              <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="name" className="text-sm font-medium">
                      {t('contact.form.name')}
                    </label>
                    <input
                      id="name"
                      type="text"
                      className={`w-full rounded-md border ${
                        errors.name ? 'border-red-500' : 'border-input'
                      } bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`}
                      placeholder={t('contact.form.namePlaceholder')}
                      {...register('name')}
                    />
                    {errors.name && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.name.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="email" className="text-sm font-medium">
                      {t('contact.form.email')}
                    </label>
                    <input
                      id="email"
                      type="email"
                      className={`w-full rounded-md border ${
                        errors.email ? 'border-red-500' : 'border-input'
                      } bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`}
                      placeholder={t('contact.form.emailPlaceholder')}
                      {...register('email')}
                    />
                    {errors.email && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.email.message}
                      </p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <label htmlFor="message" className="text-sm font-medium">
                    {t('contact.form.message')}
                  </label>
                  <textarea
                    id="message"
                    rows={4}
                    className={`w-full rounded-md border ${
                      errors.message ? 'border-red-500' : 'border-input'
                    } bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`}
                    placeholder={t('contact.form.messagePlaceholder')}
                    {...register('message')}
                  ></textarea>
                  {errors.message && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.message.message}
                    </p>
                  )}
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center">
                      <svg
                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      {t('contact.form.sending') || 'Enviando...'}
                    </span>
                  ) : (
                    t('contact.form.send')
                  )}
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </section>
  );
}
