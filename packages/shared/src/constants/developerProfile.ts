export const DEVELOPER_PUBLIC_PROFILE = {
  name: 'Gustavo Sotero',
  role: 'Desenvolvedor Full Stack',
  /**
   * Full bio — displayed in the Hero section after the experience label.
   * Deliberately does NOT repeat the role (already shown above as AnimatedGradientText).
   */
  bio: 'Especialista em TypeScript moderno — construo APIs de alta performance, orquestro filas assíncronas e entrego sistemas completos para produção, com testes, observabilidade e deploy confiável.',
  /**
   * Short bio for SEO meta description — ≤ 155 chars to avoid Google truncation.
   * Must contain the strongest selling point before the cut.
   */
  bioShort:
    'Desenvolvedor backend especializado em TypeScript moderno. APIs de alta performance, filas, cache e deploy containerizado — sistemas prontos para produção.',
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
    'Especialista TypeScript — entrego backend ponta a ponta: modelagem de dados, APIs documentadas com OpenAPI 3.1, testes com Vitest, observabilidade e deploy containerizado. Ideal para times que priorizam qualidade e velocidade de entrega.',
  location: 'Brasil',
  city: 'Aracaju',
  state: 'SE',
  citizenship: 'Brasileiro',
  availability: 'Disponível para novos projetos',
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
    { name: 'Inglês', level: 'Básico (leitura e escrita básica)' },
  ] as const,
  additionalInfo: [
    // What was built
    'Monorepo fullstack em produção: API REST, worker de filas, frontend SSR, CI/CD e deploy containerizado — arquitetura pensada para escalar',
    // Code quality signal
    'APIs com OpenAPI 3.1, testes de integração e CI/CD — código que sobrevive à revisão do tech lead',
    // Security depth signal (distinct from the two above)
    'Rate limiting, CSRF, Turnstile e sanitização markdown — segurança implementada na fundação, não como afterthought',
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
