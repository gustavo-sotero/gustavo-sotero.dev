import { DEVELOPER_PUBLIC_PROFILE } from '@portfolio/shared/constants/developerProfile';
import type { Education } from '@portfolio/shared/types/education';
import type { Experience } from '@portfolio/shared/types/experience';
import type { Project } from '@portfolio/shared/types/projects';
import type { Skill } from '@portfolio/shared/types/skills';

// ---------------------------------------------------------------------------
// ResumeViewModel — unified shape consumed by both the web view and PDF doc
// ---------------------------------------------------------------------------

export interface ResumeIdentity {
  name: string;
  role: string;
  age: number;
  city: string;
  state: string;
  country: string;
  objective: string;
  bio: string;
}

export interface ResumeContact {
  email: string;
  phone: string;
  github: string;
  linkedin: string;
  website: string;
}

export interface ResumeExperienceItem {
  id: number;
  role: string;
  company: string;
  description: string;
  location: string | null;
  employmentType: string | null;
  startDate: string;
  endDate: string | null;
  isCurrent: boolean;
  formattedPeriod: string;
  impactFacts: string[];
  skills: string[];
}

export interface ResumeEducationItem {
  id: number;
  title: string;
  institution: string;
  description: string | null;
  location: string | null;
  educationType: string | null;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
  workloadHours: number | null;
  formattedPeriod: string;
}

export interface ResumeSkillGroup {
  category: string;
  label: string;
  skills: ResumeSkillItem[];
}

export interface ResumeSkillItem {
  name: string;
  expertiseLevel: 1 | 2 | 3;
}

export interface ResumeProjectItem {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  repositoryUrl: string | null;
  liveUrl: string | null;
  impactFacts: string[];
  skills: string[];
}

export interface ResumeLanguageItem {
  name: string;
  level: string;
}

export interface ResumeViewModel {
  identity: ResumeIdentity;
  contacts: ResumeContact;
  experience: ResumeExperienceItem[];
  education: ResumeEducationItem[];
  skills: ResumeSkillGroup[];
  projects: ResumeProjectItem[];
  languages: ResumeLanguageItem[];
  additionalInfo: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MONTH_ABBR = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];

function calculateAge(birthDate: string): number {
  const birth = new Date(birthDate);
  const now = new Date();
  const age = now.getFullYear() - birth.getFullYear();
  const hasHadBirthdayThisYear =
    now.getMonth() > birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() >= birth.getDate());
  return hasHadBirthdayThisYear ? age : age - 1;
}

function formatDateYYYYMM(dateStr: string): string {
  const [year, month] = dateStr.split('-');
  return `${MONTH_ABBR[parseInt(month, 10) - 1]}. ${year}`;
}

function formatPeriod(
  startDate: string | null,
  endDate: string | null,
  isCurrent: boolean
): string {
  if (!startDate) return '';
  const start = formatDateYYYYMM(startDate);
  if (isCurrent) return `${start} — presente`;
  if (endDate) return `${start} — ${formatDateYYYYMM(endDate)}`;
  return start;
}

// ---------------------------------------------------------------------------
// Recruiter-friendly skill grouping (presentation layer only)
// The internal taxonomy (language, framework, etc.) is preserved in the DB.
// ---------------------------------------------------------------------------

type RecruiterGroup =
  | 'linguagens'
  | 'backend'
  | 'frontend'
  | 'dados'
  | 'devops'
  | 'testes'
  | 'seguranca';

const RECRUITER_GROUP_LABELS: Record<RecruiterGroup, string> = {
  linguagens: 'Linguagens',
  backend: 'Backend',
  frontend: 'Frontend',
  dados: 'Dados',
  devops: 'DevOps',
  testes: 'Testes',
  seguranca: 'Segurança',
};

/**
 * Name-based lookup that overrides the default category-to-group fallback.
 * Covers the most common skills in this codebase; unknown skills fall back
 * to CATEGORY_TO_RECRUITER_GROUP.
 */
const SKILL_GROUP_BY_NAME: Record<string, RecruiterGroup> = {
  // Linguagens
  TypeScript: 'linguagens',
  JavaScript: 'linguagens',
  SQL: 'linguagens',
  Python: 'linguagens',
  Bash: 'linguagens',
  Shell: 'linguagens',
  // Frontend
  React: 'frontend',
  'Next.js': 'frontend',
  'Tailwind CSS': 'frontend',
  Tailwind: 'frontend',
  HTML: 'frontend',
  CSS: 'frontend',
  'shadcn/ui': 'frontend',
  Radix: 'frontend',
  // Backend
  'Node.js': 'backend',
  Bun: 'backend',
  Hono: 'backend',
  Express: 'backend',
  Fastify: 'backend',
  BullMQ: 'backend',
  REST: 'backend',
  OpenAPI: 'backend',
  // Dados
  PostgreSQL: 'dados',
  Redis: 'dados',
  'Drizzle ORM': 'dados',
  Drizzle: 'dados',
  SQLite: 'dados',
  // DevOps
  Docker: 'devops',
  'Docker Compose': 'devops',
  'GitHub Actions': 'devops',
  Linux: 'devops',
  Nginx: 'devops',
  Git: 'devops',
  CI: 'devops',
  'CI/CD': 'devops',
  // Testes
  Vitest: 'testes',
  Jest: 'testes',
  Playwright: 'testes',
  Supertest: 'testes',
  Testing: 'testes',
  // Segurança
  JWT: 'seguranca',
  OWASP: 'seguranca',
  OAuth: 'seguranca',
  CORS: 'seguranca',
  CSRF: 'seguranca',
};

/** Fallback: map internal category key → recruiter group */
const CATEGORY_TO_RECRUITER_GROUP: Record<string, RecruiterGroup> = {
  language: 'linguagens',
  framework: 'backend',
  tool: 'devops',
  db: 'dados',
  infra: 'devops',
  cloud: 'devops',
};

const RECRUITER_GROUP_ORDER: RecruiterGroup[] = [
  'linguagens',
  'backend',
  'frontend',
  'dados',
  'devops',
  'testes',
  'seguranca',
];

/** Max skills shown per recruiter group in the resume — keeps it concise */
const MAX_SKILLS_PER_GROUP = 12;

// ---------------------------------------------------------------------------
// Main mapper
// ---------------------------------------------------------------------------

export function buildResumeViewModel(opts: {
  experience: Experience[];
  education: Education[];
  skills?: Skill[];
  projects: Project[];
}): ResumeViewModel {
  const profile = DEVELOPER_PUBLIC_PROFILE;

  // Identity
  const identity: ResumeIdentity = {
    name: profile.name,
    role: profile.role,
    age: calculateAge(profile.birthDate),
    city: profile.city,
    state: profile.state,
    country: 'Brasil',
    objective: profile.objective,
    bio: profile.bio,
  };

  // Contacts
  const contacts: ResumeContact = {
    email: profile.contacts.email,
    phone: profile.contacts.phone,
    github: profile.links.github,
    linkedin: profile.links.linkedin,
    website: profile.links.website,
  };

  // Experience — ordered by isCurrent desc, then startDate desc
  const sortedExperience = [...opts.experience]
    .filter((e) => e.status === 'published' || !('status' in e))
    .sort((a, b) => {
      if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
      return b.startDate.localeCompare(a.startDate);
    });

  const experience: ResumeExperienceItem[] = sortedExperience.map((e) => ({
    id: e.id,
    role: e.role,
    company: e.company,
    description: e.description,
    location: e.location ?? null,
    employmentType: e.employmentType ?? null,
    startDate: e.startDate,
    endDate: e.endDate ?? null,
    isCurrent: e.isCurrent,
    formattedPeriod: formatPeriod(e.startDate, e.endDate ?? null, e.isCurrent),
    impactFacts: e.impactFacts ?? [],
    skills: (e.skills ?? []).map((s) => s.name),
  }));

  // Education — ordered by isCurrent desc, then endDate desc
  const sortedEducation = [...opts.education].sort((a, b) => {
    if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
    const aDate = a.endDate ?? a.startDate ?? '';
    const bDate = b.endDate ?? b.startDate ?? '';
    return bDate.localeCompare(aDate);
  });

  const education: ResumeEducationItem[] = sortedEducation.map((e) => ({
    id: e.id,
    title: e.title,
    institution: e.institution,
    description: e.description ?? null,
    location: e.location ?? null,
    educationType: e.educationType ?? null,
    startDate: e.startDate ?? null,
    endDate: e.endDate ?? null,
    isCurrent: e.isCurrent,
    workloadHours: e.workloadHours ?? null,
    formattedPeriod: formatPeriod(e.startDate ?? null, e.endDate ?? null, e.isCurrent),
  }));

  // Skills — group by recruiter-friendly groups (presentation layer only)
  const grouped = new Map<RecruiterGroup, ResumeSkillItem[]>();
  const sortedSkills = [...(opts.skills ?? [])].sort(
    (a, b) =>
      Number(b.isHighlighted) - Number(a.isHighlighted) ||
      b.expertiseLevel - a.expertiseLevel ||
      a.name.localeCompare(b.name)
  );

  for (const skill of sortedSkills) {
    const group: RecruiterGroup =
      SKILL_GROUP_BY_NAME[skill.name] ?? CATEGORY_TO_RECRUITER_GROUP[skill.category] ?? 'devops';
    if (!grouped.has(group)) grouped.set(group, []);
    const list = grouped.get(group);
    if (list && !list.some((item) => item.name === skill.name)) {
      list.push({
        name: skill.name,
        expertiseLevel: skill.expertiseLevel,
      });
    }
  }

  const skills: ResumeSkillGroup[] = RECRUITER_GROUP_ORDER.filter((g) => grouped.has(g)).map(
    (g) => ({
      category: g,
      label: RECRUITER_GROUP_LABELS[g],
      skills: (grouped.get(g) ?? []).slice(0, MAX_SKILLS_PER_GROUP),
    })
  );

  // Projects — published ones, featured first
  const sortedProjects = [...opts.projects]
    .filter((p) => p.status === 'published')
    .sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return a.order - b.order;
    })
    .slice(0, 6);

  const projects: ResumeProjectItem[] = sortedProjects.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    description: p.description ?? null,
    repositoryUrl: p.repositoryUrl ?? null,
    liveUrl: p.liveUrl ?? null,
    impactFacts: p.impactFacts ?? [],
    skills: (p.skills ?? []).map((s) => s.name),
  }));

  // Languages
  const languages: ResumeLanguageItem[] = profile.languages.map((l) => ({
    name: l.name,
    level: l.level,
  }));

  // Additional info
  const additionalInfo = [...profile.additionalInfo];

  return {
    identity,
    contacts,
    experience,
    education,
    skills,
    projects,
    languages,
    additionalInfo,
  };
}
