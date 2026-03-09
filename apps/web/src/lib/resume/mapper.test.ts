import type { Education, Experience, Project, Tag } from '@portfolio/shared';
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
    tags: [],
    ...overrides,
  };
}

describe('resume mapper experience tags', () => {
  it('maps experience tags into the resume view model', () => {
    const tags = [createTag(1, 'TypeScript', 'language'), createTag(2, 'Hono', 'framework')];
    const experience = [createExperience({ tags })];

    const resume = buildResumeViewModel({
      experience,
      education: [createEducation()],
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
