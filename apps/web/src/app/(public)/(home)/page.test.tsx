import { render, screen } from '@testing-library/react';
import { Children, isValidElement, type ReactElement, Suspense } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { getHomeAggregateMock } = vi.hoisted(() => ({
  getHomeAggregateMock: vi.fn(() =>
    Promise.resolve({
      posts: { state: 'ok' as const, data: [] },
      projects: { state: 'ok' as const, data: [] },
      skills: { state: 'ok' as const, data: [] },
      blogTags: { state: 'ok' as const, data: [] },
      experience: { state: 'ok' as const, data: [] },
      education: { state: 'ok' as const, data: [] },
    })
  ),
}));

const {
  ContactSectionMock,
  EducationSectionWrapperMock,
  ExperienceSectionWrapperMock,
  FeaturedProjectsSectionMock,
  HeroSectionWrapperMock,
  RecentPostsSectionMock,
  SkillsSectionMock,
  EducationSkeletonMock,
  ExperienceSkeletonMock,
  FeaturedProjectsSkeletonMock,
  RecentPostsSkeletonMock,
  SkillsSkeletonMock,
} = vi.hoisted(() => ({
  ContactSectionMock: () => null,
  EducationSectionWrapperMock: () => null,
  ExperienceSectionWrapperMock: () => null,
  FeaturedProjectsSectionMock: () => null,
  HeroSectionWrapperMock: () => null,
  RecentPostsSectionMock: () => null,
  SkillsSectionMock: () => null,
  EducationSkeletonMock: () => null,
  ExperienceSkeletonMock: () => null,
  FeaturedProjectsSkeletonMock: () => null,
  RecentPostsSkeletonMock: () => null,
  SkillsSkeletonMock: () => null,
}));

vi.mock('@/components/home/ContactSection', () => ({
  ContactSection: ContactSectionMock,
}));

vi.mock('@/components/home/sections/EducationSectionWrapper', () => ({
  EducationSectionWrapper: EducationSectionWrapperMock,
}));

vi.mock('@/components/home/sections/ExperienceSectionWrapper', () => ({
  ExperienceSectionWrapper: ExperienceSectionWrapperMock,
}));

vi.mock('@/components/home/sections/FeaturedProjectsSection', () => ({
  FeaturedProjectsSection: FeaturedProjectsSectionMock,
}));

vi.mock('@/components/home/sections/HeroSectionWrapper', () => ({
  HeroSectionWrapper: HeroSectionWrapperMock,
}));

vi.mock('@/components/home/sections/RecentPostsSection', () => ({
  RecentPostsSection: RecentPostsSectionMock,
}));

vi.mock('@/components/home/sections/SkillsSection', () => ({
  SkillsSection: SkillsSectionMock,
}));

vi.mock('@/components/home/skeletons', () => ({
  EducationSkeleton: EducationSkeletonMock,
  ExperienceSkeleton: ExperienceSkeletonMock,
  FeaturedProjectsSkeleton: FeaturedProjectsSkeletonMock,
  RecentPostsSkeleton: RecentPostsSkeletonMock,
  SkillsSkeleton: SkillsSkeletonMock,
}));

vi.mock('@/lib/data/public/home', () => ({
  getHomeAggregate: getHomeAggregateMock,
}));

import HomePage from './page';

describe('HomePage composition', () => {
  it('keeps the hero outside Suspense so it is part of the initial HTML shell', () => {
    const tree = HomePage();
    expect(isValidElement(tree)).toBe(true);

    const root = tree as ReactElement<{ children: ReactElement[] }>;
    const children = Children.toArray(root.props.children) as ReactElement[];
    const heroNode = children[0];

    expect(heroNode?.type).toBe(HeroSectionWrapperMock);
    expect(heroNode?.type).not.toBe(Suspense);
  });

  it('passes one shared home aggregate promise to every home data wrapper', () => {
    const tree = HomePage();
    expect(isValidElement(tree)).toBe(true);

    const root = tree as ReactElement<{ children: ReactElement[] }>;
    const children = Children.toArray(root.props.children) as ReactElement[];
    const heroNode = children[0] as ReactElement<{ aggregatePromise?: Promise<unknown> }>;
    const sectionsContainer = children[1] as ReactElement<{ children: ReactElement[] }>;
    const sections = Children.toArray(sectionsContainer.props.children) as ReactElement[];
    const sharedPromise = heroNode.props.aggregatePromise;

    expect(sharedPromise).toBeInstanceOf(Promise);

    for (const section of sections.slice(0, 5)) {
      const sectionElement = section as ReactElement<{ children: ReactElement }>;
      const suspenseNode = Children.only(sectionElement.props.children) as ReactElement<{
        children: ReactElement<{ aggregatePromise?: Promise<unknown> }>;
      }>;

      expect(suspenseNode.props.children.props.aggregatePromise).toBe(sharedPromise);
    }
  });

  it('labels the posts section as featured content to match manual ordering', () => {
    render(HomePage() as ReactElement);

    expect(screen.getByRole('region', { name: 'Posts em destaque' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Posts recentes' })).not.toBeInTheDocument();
  });
});
