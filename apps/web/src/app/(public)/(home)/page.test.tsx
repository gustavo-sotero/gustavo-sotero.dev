import { Children, isValidElement, type ReactElement, Suspense } from 'react';
import { describe, expect, it, vi } from 'vitest';

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
});
