export const DEVELOPER_PUBLIC_PROFILE = {
  name: 'Gustavo Sotero',
  role: 'Desenvolvedor Full Stack',
  /**
   * Full bio — displayed in the Hero section after the experience label.
   * Deliberately does NOT repeat the role (already shown above as AnimatedGradientText).
   */
  bio: 'Desenvolvo sistemas web completos com TypeScript — APIs robustas, processamento assíncrono e frontend dinâmico, com testes automatizados, observabilidade e deploy confiável em produção.',
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
    'Desenvolvedor Full Stack com foco em TypeScript e backend robusto. Entrego sistemas completos para produção — APIs REST documentadas, processamento assíncrono, testes automatizados e deploy containerizado. Comprometido com qualidade de código, prazos e colaboração eficiente com o time.',
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
    'Projeto fullstack autoral em produção — backend, frontend, filas de processamento e infraestrutura containerizada, desenvolvido e mantido de forma independente',
    // Code quality signal
    'Código documentado, testado automaticamente e validado via pipeline de CI/CD — pronto para integrar um time sem fricção',
    // Security depth signal (distinct from the two above)
    'Segurança implementada desde a fundação: autenticação, proteção contra ataques comuns e validação rigorosa de entrada de dados',
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
