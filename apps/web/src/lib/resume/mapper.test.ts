import type { Education } from '@portfolio/shared/types/education';
import type { Experience } from '@portfolio/shared/types/experience';
import type { Project } from '@portfolio/shared/types/projects';
import type { Skill } from '@portfolio/shared/types/skills';
import { describe, expect, it } from 'vitest';
import { buildResumeViewModel } from './mapper';

function createExperience(overrides: Partial<Experience> = {}): Experience {
  return {
    id: 1,
    slug: 'eng-acme',
    role: 'Engenheiro de Software',
    company: 'Acme',
    description: 'Construção de APIs.',
    location: 'Remoto',
    employmentType: 'CLT',
    startDate: '2024-01-01',
    endDate: null,
    isCurrent: true,
    order: 0,
    status: 'published',
    logoUrl: null,
    credentialUrl: null,
    deletedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    impactFacts: [],
    skills: [],
    ...overrides,
  };
}

function createEducation(overrides: Partial<Education> = {}): Education {
  return {
    id: 1,
    slug: 'ads',
    title: 'ADS',
    institution: 'IF',
    description: null,
    location: null,
    educationType: null,
    startDate: '2022-01-01',
    endDate: '2023-12-01',
    isCurrent: false,
    workloadHours: null,
    credentialId: null,
    credentialUrl: null,
    order: 0,
    status: 'published',
    logoUrl: null,
    deletedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function createProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 1,
    slug: 'portfolio',
    title: 'Portfolio',
    description: 'Projeto pessoal',
    content: null,
    renderedContent: null,
    coverUrl: null,
    status: 'published',
    repositoryUrl: null,
    liveUrl: null,
    featured: true,
    order: 0,
    deletedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    impactFacts: [],
    skills: [],
    ...overrides,
  };
}

function createSkill(overrides: Partial<Skill> & Pick<Skill, 'id' | 'name' | 'category'>): Skill {
  return {
    id: overrides.id,
    name: overrides.name,
    slug: overrides.slug ?? overrides.name.toLowerCase(),
    category: overrides.category,
    iconKey: overrides.iconKey ?? null,
    expertiseLevel: overrides.expertiseLevel ?? 1,
    isHighlighted: overrides.isHighlighted ?? false,
    createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
  };
}

// ---------------------------------------------------------------------------
// identity fields
// ---------------------------------------------------------------------------

describe('resume mapper identity', () => {
  it('exposes age computed from birthDate and omits citizenship', () => {
    const resume = buildResumeViewModel({
      experience: [],
      education: [],
      skills: [],
      projects: [],
    });

    expect(resume.identity.age).toBeTypeOf('number');
    expect(resume.identity.age).toBeGreaterThan(0);
    expect(resume.identity).not.toHaveProperty('citizenship');
    expect(resume.identity.name).toBe('Gustavo Sotero');
  });
});

describe('resume mapper experience skills', () => {
  it('maps experience skills into the resume view model', () => {
    const skills = [
      createSkill({ id: 1, name: 'TypeScript', category: 'language' }),
      createSkill({ id: 2, name: 'Hono', category: 'framework' }),
    ];
    const experience = [createExperience({ skills })];

    const resume = buildResumeViewModel({
      experience,
      education: [createEducation()],
      skills: [],
      projects: [createProject()],
    });

    expect(resume.experience[0]?.skills).toEqual(['TypeScript', 'Hono']);
  });

  it('keeps experience skills empty when payload has no skills', () => {
    const resume = buildResumeViewModel({
      experience: [createExperience({ skills: undefined })],
      education: [],
      projects: [],
    });

    expect(resume.experience[0]?.skills).toEqual([]);
  });
});

describe('resume mapper impactFacts', () => {
  it('projects experience impactFacts into the view model', () => {
    const facts = ['Reduziu latência em 40%', 'Implementou CI/CD completo'];
    const resume = buildResumeViewModel({
      experience: [createExperience({ impactFacts: facts })],
      education: [],
      projects: [],
    });

    expect(resume.experience[0]?.impactFacts).toEqual(facts);
  });

  it('defaults experience impactFacts to [] when undefined', () => {
    const resume = buildResumeViewModel({
      experience: [createExperience({ impactFacts: undefined })],
      education: [],
      projects: [],
    });

    expect(resume.experience[0]?.impactFacts).toEqual([]);
  });

  it('projects project impactFacts into the view model', () => {
    const facts = ['API documentada via OpenAPI', 'Pipeline de imagens com sharp'];
    const resume = buildResumeViewModel({
      experience: [],
      education: [],
      projects: [createProject({ impactFacts: facts })],
    });

    expect(resume.projects[0]?.impactFacts).toEqual(facts);
  });

  it('defaults project impactFacts to [] when undefined', () => {
    const resume = buildResumeViewModel({
      experience: [],
      education: [],
      projects: [createProject({ impactFacts: undefined })],
    });

    expect(resume.projects[0]?.impactFacts).toEqual([]);
  });
});

describe('resume mapper skill grouping', () => {
  it('groups skills into recruiter-friendly categories', () => {
    const resume = buildResumeViewModel({
      experience: [],
      education: [],
      projects: [],
      skills: [
        createSkill({ id: 1, name: 'Node.js', category: 'tool', expertiseLevel: 2 }),
        createSkill({
          id: 2,
          name: 'TypeScript',
          category: 'language',
          expertiseLevel: 3,
          isHighlighted: true,
        }),
        createSkill({ id: 3, name: 'JavaScript', category: 'language', expertiseLevel: 2 }),
      ],
    });

    expect(resume.skills).toEqual([
      {
        category: 'linguagens',
        label: 'Linguagens',
        skills: [
          { name: 'TypeScript', expertiseLevel: 3 },
          { name: 'JavaScript', expertiseLevel: 2 },
        ],
      },
      {
        category: 'backend',
        label: 'Backend',
        skills: [{ name: 'Node.js', expertiseLevel: 2 }],
      },
    ]);
  });
});
