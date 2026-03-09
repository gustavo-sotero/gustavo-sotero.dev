'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { Loader2, Send } from 'lucide-react';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiPost } from '@/lib/api';
import { env } from '@/lib/env';

const contactFormSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100),
  email: z.string().email('E-mail inválido'),
  message: z.string().min(10, 'Mensagem deve ter pelo menos 10 caracteres').max(5000),
  // honeypot — must remain empty
  website: z.string().max(0).optional(),
});

type ContactFormValues = z.infer<typeof contactFormSchema>;

export function ContactForm() {
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);
  const turnstileRef = useRef<TurnstileInstance>(undefined);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
  });

  const onSubmit = async (values: ContactFormValues) => {
    if (!turnstileToken) {
      toast.error('Verificação de segurança necessária. Aguarde ou recarregue a página.');
      return;
    }

    try {
      await apiPost('/contact', {
        name: values.name,
        email: values.email,
        message: values.message,
        website: values.website ?? '',
        turnstileToken,
      });

      toast.success('Mensagem enviada com sucesso! Responderei em breve.');
      reset();
      setTurnstileToken(null);
      turnstileRef.current?.reset();
      setIsDone(true);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Erro ao enviar mensagem. Tente novamente.';
      toast.error(message);
      turnstileRef.current?.reset();
      setTurnstileToken(null);
    }
  };

  if (isDone) {
    return (
      <div className="flex flex-col items-center justify-center py-14 gap-4 text-center rounded-xl border border-emerald-500/20 bg-emerald-500/5">
        <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
          <Send className="h-5 w-5 text-emerald-400" />
        </div>
        <h3 className="text-zinc-200 font-semibold text-lg">Mensagem enviada!</h3>
        <p className="text-zinc-500 text-sm max-w-xs">
          Obrigado pelo contato. Responderei o mais breve possível.
        </p>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setIsDone(false)}
          className="text-emerald-400 hover:text-emerald-300"
        >
          Enviar outra mensagem
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      {/* Honeypot — hidden from real users */}
      <input
        {...register('website')}
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="space-y-1.5">
          <Label htmlFor="contact-name" className="text-xs text-zinc-400">
            Nome <span aria-hidden="true">*</span>
          </Label>
          <Input
            id="contact-name"
            placeholder="Gustavo Silva"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? 'contact-name-error' : undefined}
            className="bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500/60"
            {...register('name')}
          />
          {errors.name && (
            <p id="contact-name-error" className="text-xs text-red-400" role="alert">
              {errors.name.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="contact-email" className="text-xs text-zinc-400">
            E-mail <span aria-hidden="true">*</span>
          </Label>
          <Input
            id="contact-email"
            type="email"
            placeholder="seu@email.com"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'contact-email-error' : undefined}
            className="bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500/60"
            {...register('email')}
          />
          {errors.email && (
            <p id="contact-email-error" className="text-xs text-red-400" role="alert">
              {errors.email.message}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contact-message" className="text-xs text-zinc-400">
          Mensagem <span aria-hidden="true">*</span>
        </Label>
        <Textarea
          id="contact-message"
          placeholder="Descreva seu projeto, oportunidade ou qualquer dúvida..."
          rows={6}
          aria-invalid={!!errors.message}
          aria-describedby={errors.message ? 'contact-message-error' : undefined}
          className="bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500/60 resize-none"
          {...register('message')}
        />
        {errors.message && (
          <p id="contact-message-error" className="text-xs text-red-400" role="alert">
            {errors.message.message}
          </p>
        )}
      </div>

      {env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
        <Turnstile
          ref={turnstileRef}
          siteKey={env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
          onSuccess={setTurnstileToken}
          onExpire={() => setTurnstileToken(null)}
          options={{ theme: 'dark', size: 'normal' }}
        />
      )}

      <Button
        type="submit"
        disabled={isSubmitting || !turnstileToken}
        className="w-full sm:w-auto gap-2 bg-emerald-500 text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Enviando...
          </>
        ) : (
          <>
            <Send className="h-4 w-4" />
            Enviar mensagem
          </>
        )}
      </Button>
    </form>
  );
}
