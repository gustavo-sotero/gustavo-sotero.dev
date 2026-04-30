import { render, screen } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getHomeAggregateMock } = vi.hoisted(() => ({
  getHomeAggregateMock: vi.fn(),
}));

const baseAggregate = {
  posts: { state: 'ok' as const, data: [] },
  projects: { state: 'ok' as const, data: [] },
  skills: { state: 'ok' as const, data: [] },
  blogTags: { state: 'ok' as const, data: [] },
  experience: { state: 'ok' as const, data: [] },
  education: { state: 'ok' as const, data: [] },
};

vi.mock('@/lib/data/public/home', () => ({
  getHomeAggregate: getHomeAggregateMock,
}));

vi.mock('../FeaturedProjects', () => ({
  FeaturedProjects: () => <div data-testid="featured-projects">featured</div>,
}));

vi.mock('../RecentPosts', () => ({
  RecentPosts: () => <div data-testid="recent-posts">recent</div>,
}));

vi.mock('../SkillsBentoBox', () => ({
  SkillsBentoBox: () => <div data-testid="skills-bento">skills</div>,
}));

vi.mock('../ExperienceSection', () => ({
  ExperienceSection: () => <div data-testid="experience-section">experience</div>,
}));

vi.mock('../EducationSection', () => ({
  EducationSection: () => <div data-testid="education-section">education</div>,
}));

import { EducationSectionWrapper } from './EducationSectionWrapper';
import { ExperienceSectionWrapper } from './ExperienceSectionWrapper';
import { FeaturedProjectsSection } from './FeaturedProjectsSection';
import { RecentPostsSection } from './RecentPostsSection';
import { SkillsSection } from './SkillsSection';

async function renderServerComponent(elementPromise: Promise<React.ReactNode>) {
  const element = await elementPromise;
  render(element as React.ReactElement);
}

describe('home section wrappers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders degraded UI for featured projects failures', async () => {
    getHomeAggregateMock.mockResolvedValue({ ...baseAggregate, projects: { state: 'degraded' } });

    await renderServerComponent(FeaturedProjectsSection());

    expect(screen.getByText('Seção temporariamente indisponível.')).toBeInTheDocument();
  });

  it('renders null for legitimate empty featured projects', async () => {
    getHomeAggregateMock.mockResolvedValue({
      ...baseAggregate,
      projects: { state: 'empty', data: [] },
    });

    await renderServerComponent(FeaturedProjectsSection());

    expect(screen.queryByTestId('featured-projects')).not.toBeInTheDocument();
  });

  it('renders degraded UI for recent posts failures', async () => {
    getHomeAggregateMock.mockResolvedValue({ ...baseAggregate, posts: { state: 'degraded' } });

    await renderServerComponent(RecentPostsSection());

    expect(screen.getByText('Seção temporariamente indisponível.')).toBeInTheDocument();
  });

  it('renders degraded UI for skills dependency failures in skills section', async () => {
    getHomeAggregateMock.mockResolvedValue({ ...baseAggregate, skills: { state: 'degraded' } });

    await renderServerComponent(SkillsSection());

    expect(screen.getByText('Seção temporariamente indisponível.')).toBeInTheDocument();
  });

  it('renders degraded UI for experience failures', async () => {
    getHomeAggregateMock.mockResolvedValue({ ...baseAggregate, experience: { state: 'degraded' } });

    await renderServerComponent(ExperienceSectionWrapper());

    expect(screen.getByText('Seção temporariamente indisponível.')).toBeInTheDocument();
  });

  it('renders degraded UI for education failures', async () => {
    getHomeAggregateMock.mockResolvedValue({ ...baseAggregate, education: { state: 'degraded' } });

    await renderServerComponent(EducationSectionWrapper());

    expect(screen.getByText('Seção temporariamente indisponível.')).toBeInTheDocument();
  });
});
