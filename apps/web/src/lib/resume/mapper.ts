import type { Education, Experience, Project, Skill } from '@portfolio/shared';
import { DEVELOPER_PUBLIC_PROFILE } from '@portfolio/shared';

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
  citizenship: string;
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
  tags: string[];
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
  tags: string[];
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

function calculateAge(birthDateIso: string, now: Date): number {
  const birth = new Date(birthDateIso);
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

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

const CATEGORY_LABELS: Record<string, string> = {
  language: 'Linguagens',
  framework: 'Frameworks',
  tool: 'Ferramentas',
  db: 'Bancos de Dados',
  infra: 'Infraestrutura',
  cloud: 'Cloud',
  other: 'Outras',
};

/** Max skills shown per category in the PDF — keeps it concise */
const MAX_SKILLS_PER_CATEGORY = 10;

// ---------------------------------------------------------------------------
// Main mapper
// ---------------------------------------------------------------------------

export function buildResumeViewModel(opts: {
  experience: Experience[];
  education: Education[];
  skills?: Skill[];
  projects: Project[];
  now: Date;
}): ResumeViewModel {
  const profile = DEVELOPER_PUBLIC_PROFILE;

  // Identity
  const identity: ResumeIdentity = {
    name: profile.name,
    role: profile.role,
    age: calculateAge(profile.birthDate, opts.now),
    city: profile.city,
    state: profile.state,
    country: 'Brasil',
    citizenship: profile.citizenship,
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
    tags: (e.tags ?? []).map((t) => t.name),
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

  // Skills — group by category from Skill catalog, dedupe names, limit per category
  const categoryOrder = ['language', 'framework', 'db', 'tool', 'infra', 'cloud'];
  const grouped = new Map<string, ResumeSkillItem[]>();
  const sortedSkills = [...(opts.skills ?? [])].sort(
    (a, b) =>
      Number(b.isHighlighted) - Number(a.isHighlighted) ||
      b.expertiseLevel - a.expertiseLevel ||
      a.name.localeCompare(b.name)
  );

  for (const skill of sortedSkills) {
    const cat = skill.category ?? 'tool';
    if (!grouped.has(cat)) grouped.set(cat, []);
    const list = grouped.get(cat);
    if (list && !list.some((item) => item.name === skill.name)) {
      list.push({
        name: skill.name,
        expertiseLevel: skill.expertiseLevel,
      });
    }
  }

  const skills: ResumeSkillGroup[] = categoryOrder
    .filter((cat) => grouped.has(cat))
    .map((cat) => ({
      category: cat,
      label: CATEGORY_LABELS[cat] ?? cat,
      skills: (grouped.get(cat) ?? []).slice(0, MAX_SKILLS_PER_CATEGORY),
    }));

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
    tags: (p.tags ?? []).map((t) => t.name),
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
