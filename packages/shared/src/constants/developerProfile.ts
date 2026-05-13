export const DEVELOPER_PUBLIC_PROFILE = {
  name: 'Gustavo Sotero',
  role: 'Desenvolvedor Full Stack',
  /**
   * Full bio — displayed in the Hero section after the experience label.
   * Deliberately does NOT repeat the role (already shown above as AnimatedGradientText).
   */
  bio: 'Desenvolvo sistemas web completos em TypeScript: APIs REST documentadas com OpenAPI, processamento assíncrono com filas e worker dedicado, frontend com Next.js e React, testes automatizados e deploy containerizado com Docker e GitHub Actions.',
  /**
   * Short bio for SEO meta description — ≤ 155 chars to avoid Google truncation.
   * Must contain the strongest selling point before the cut.
   */
  bioShort:
    'Desenvolvedor Full Stack TypeScript. Sistemas web completos para produção: API, testes, CI/CD e deploy containerizado — com qualidade e consistência.',
  /** ISO 8601 YYYY-MM-DD — used to calculate age dynamically */
  birthDate: '2004-05-29',
  /** ISO 8601 YYYY-MM-DD — used to calculate years of experience dynamically */
  careerStartDate: '2021-07-01',
  hero: {
    greeting: 'Olá, eu sou',
    /** Shown as subtitle below the role — capability statement, not a tool listing. */
    focus: 'TypeScript ponta a ponta — APIs performáticas, filas, cache e deploy containerizado',
  },
  objective:
    'Desenvolvedor Full Stack especializado em TypeScript, com foco em sistemas web completos e prontos para produção. Projeto e entrego API REST documentada com OpenAPI, processamento assíncrono com BullMQ e Redis, frontend com Next.js e React, observabilidade com logs estruturados e deploy containerizado com Docker e GitHub Actions. Testes automatizados com Vitest em todas as camadas e pipeline de CI validando lint, tipagem e cobertura antes de cada merge.',
  location: 'Brasil',
  city: 'Aracaju',
  state: 'SE',
  availability: 'Disponível — CLT ou PJ, remoto no Brasil',
  links: {
    github: 'https://github.com/gustavo-sotero',
    linkedin: 'https://linkedin.com/in/gustavo-sotero',
    website: 'https://gustavo-sotero.dev',
    telegram: 'https://t.me/gustavo_sotero',
    whatsapp: 'https://wa.me/5579996423943',
  },
  contacts: {
    email: 'contato@gustavo-sotero.dev',
    phone: '+55 79 99642-3943',
  },
  languages: [
    { name: 'Português', level: 'Nativo' },
    { name: 'Inglês', level: 'Intermediário (leitura técnica e escrita profissional)' },
  ] as const,
  additionalInfo: [
    // Tech stack specificity
    'Projeto fullstack autoral em produção com TypeScript ponta a ponta: API REST com Hono, filas com BullMQ, frontend com Next.js e deploy com Docker + GitHub Actions',
    // Code quality signal
    'Testes automatizados com Vitest em todas as camadas; pipeline de CI que valida lint, tipagem e cobertura antes de qualquer merge',
    // Security depth signal
    'Segurança desde a fundação: autenticação com JWT e refresh tokens, rate limiting, sanitização de entrada, CORS configurado e proteção CSRF',
    // Work style signal
    'Trabalho de forma assíncrona e independente — entrego funcionalidades completas com documentação técnica, sem supervisão próxima',
  ] as const,
} as const;

/**
 * Calculates the experience label (e.g. "3+ anos") from a ISO 8601 start date.
 * Defaults to DEVELOPER_PUBLIC_PROFILE.careerStartDate when called with no argument.
 */
export function getExperienceLabel(startDate = DEVELOPER_PUBLIC_PROFILE.careerStartDate): string {
  const start = new Date(startDate);
  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  const monthDiff = now.getMonth() - start.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < start.getDate())) {
    years -= 1;
  }
  return `${years}+ anos`;
}
