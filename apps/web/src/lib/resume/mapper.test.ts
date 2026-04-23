import type { Education, Experience, Project, Skill, Tag } from '@portfolio/shared';
import { describe, expect, it } from 'vitest';
import { buildResumeViewModel } from './mapper';

function createTag(id: number, name: string, category: Tag['category'] = 'tool'): Tag {
  return {
    id,
    name,
    slug: name.toLowerCase(),
    category,
    iconKey: null,
    isHighlighted: false,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

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
    tags: [],
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
    tags: [],
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
// Explicit timestamp contract — now is always supplied by the caller
// ---------------------------------------------------------------------------

describe('resume mapper timestamp contract', () => {
  it('calculates age deterministically from the provided now value', () => {
    // Two different reference dates must produce two different ages for the
    // same birthDate — proving that now controls the output, not new Date().
    const base = {
      experience: [],
      education: [],
      skills: [],
      tags: [],
      projects: [],
    };

    const resumeAt2026 = buildResumeViewModel({
      ...base,
      now: new Date('2026-01-01T00:00:00.000Z'),
    });

    const resumeAt2030 = buildResumeViewModel({
      ...base,
      now: new Date('2030-01-01T00:00:00.000Z'),
    });

    // The identity.age field is derived from now — different years → different ages.
    expect(typeof resumeAt2026.identity.age).toBe('number');
    expect(typeof resumeAt2030.identity.age).toBe('number');
    expect(resumeAt2030.identity.age).toBeGreaterThan(resumeAt2026.identity.age);
  });

  it('produces identical output for the same now value across two calls', () => {
    const opts = {
      experience: [],
      education: [],
      skills: [],
      tags: [],
      projects: [],
      now: new Date('2026-06-15T12:00:00.000Z'),
    };

    const first = buildResumeViewModel(opts);
    const second = buildResumeViewModel(opts);

    expect(first.identity.age).toBe(second.identity.age);
  });
});

describe('resume mapper experience tags', () => {
  it('maps experience tags into the resume view model', () => {
    const tags = [createTag(1, 'TypeScript', 'language'), createTag(2, 'Hono', 'framework')];
    const experience = [createExperience({ tags })];

    const resume = buildResumeViewModel({
      experience,
      education: [createEducation()],
      skills: [],
      tags,
      projects: [createProject()],
      now: new Date('2026-02-01T00:00:00.000Z'),
    });

    expect(resume.experience[0]?.tags).toEqual(['TypeScript', 'Hono']);
  });

  it('keeps experience tags empty when payload has no tags', () => {
    const resume = buildResumeViewModel({
      experience: [createExperience({ tags: undefined })],
      education: [],
      tags: [],
      projects: [],
      now: new Date('2026-02-01T00:00:00.000Z'),
    });

    expect(resume.experience[0]?.tags).toEqual([]);
  });
});

describe('resume mapper impactFacts', () => {
  it('projects experience impactFacts into the view model', () => {
    const facts = ['Reduziu latência em 40%', 'Implementou CI/CD completo'];
    const resume = buildResumeViewModel({
      experience: [createExperience({ impactFacts: facts })],
      education: [],
      tags: [],
      projects: [],
      now: new Date('2026-02-01T00:00:00.000Z'),
    });

    expect(resume.experience[0]?.impactFacts).toEqual(facts);
  });

  it('defaults experience impactFacts to [] when undefined', () => {
    const resume = buildResumeViewModel({
      experience: [createExperience({ impactFacts: undefined })],
      education: [],
      tags: [],
      projects: [],
      now: new Date('2026-02-01T00:00:00.000Z'),
    });

    expect(resume.experience[0]?.impactFacts).toEqual([]);
  });

  it('projects project impactFacts into the view model', () => {
    const facts = ['API documentada via OpenAPI', 'Pipeline de imagens com sharp'];
    const resume = buildResumeViewModel({
      experience: [],
      education: [],
      tags: [],
      projects: [createProject({ impactFacts: facts })],
      now: new Date('2026-02-01T00:00:00.000Z'),
    });

    expect(resume.projects[0]?.impactFacts).toEqual(facts);
  });

  it('defaults project impactFacts to [] when undefined', () => {
    const resume = buildResumeViewModel({
      experience: [],
      education: [],
      tags: [],
      projects: [createProject({ impactFacts: undefined })],
      now: new Date('2026-02-01T00:00:00.000Z'),
    });

    expect(resume.projects[0]?.impactFacts).toEqual([]);
  });
});

describe('resume mapper skill expertise', () => {
  it('keeps expertiseLevel in grouped skills and orders highlighted skills first', () => {
    const resume = buildResumeViewModel({
      experience: [],
      education: [],
      tags: [],
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
      now: new Date('2026-02-01T00:00:00.000Z'),
    });

    expect(resume.skills).toEqual([
      {
        category: 'language',
        label: 'Linguagens',
        skills: [
          { name: 'TypeScript', expertiseLevel: 3 },
          { name: 'JavaScript', expertiseLevel: 2 },
        ],
      },
      {
        category: 'tool',
        label: 'Ferramentas',
        skills: [{ name: 'Node.js', expertiseLevel: 2 }],
      },
    ]);
  });
});
