import { DEVELOPER_PUBLIC_PROFILE } from '@portfolio/shared/constants/developerProfile';
import { render, screen } from '@testing-library/react';
import { Children, isValidElement, type ReactElement, Suspense } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SITE_METADATA } from '@/lib/constants';

vi.mock('server-only', () => ({}));

const { JsonLdScriptMock } = vi.hoisted(() => ({
  JsonLdScriptMock: vi.fn(({ data }: { data: Record<string, unknown> }) => (
    <script type="application/ld+json" data-testid="json-ld" data-type={data['@type'] as string} />
  )),
}));

vi.mock('@/components/shared/JsonLdScript', () => ({
  JsonLdScript: JsonLdScriptMock,
}));

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
    // children[0] is JsonLdScript, children[1] is HeroSectionWrapper
    const heroNode = children[1];

    expect(heroNode?.type).toBe(HeroSectionWrapperMock);
    expect(heroNode?.type).not.toBe(Suspense);
  });

  it('passes one shared home aggregate promise to every home data wrapper', () => {
    const tree = HomePage();
    expect(isValidElement(tree)).toBe(true);

    const root = tree as ReactElement<{ children: ReactElement[] }>;
    const children = Children.toArray(root.props.children) as ReactElement[];
    // children[0] is JsonLdScript, children[1] is HeroSectionWrapper, children[2] is the sections container
    const heroNode = children[1] as ReactElement<{ aggregatePromise?: Promise<unknown> }>;
    const sectionsContainer = children[2] as ReactElement<{ children: ReactElement[] }>;
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

  it('emits a Person JSON-LD script tag in the page output', () => {
    render(HomePage() as ReactElement);

    const script = screen.getByTestId('json-ld');
    expect(script).toBeInTheDocument();
    expect(script).toHaveAttribute('data-type', 'Person');

    const lastCall = JsonLdScriptMock.mock.calls.at(-1);
    expect(lastCall).toBeDefined();

    const data = lastCall?.[0]?.data as Record<string, unknown>;
    expect(data).toEqual(
      expect.objectContaining({
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: DEVELOPER_PUBLIC_PROFILE.name,
        url: SITE_METADATA.url,
        jobTitle: DEVELOPER_PUBLIC_PROFILE.role,
        description: DEVELOPER_PUBLIC_PROFILE.bioShort,
        email: DEVELOPER_PUBLIC_PROFILE.contacts.email,
        sameAs: expect.arrayContaining([
          DEVELOPER_PUBLIC_PROFILE.links.github,
          DEVELOPER_PUBLIC_PROFILE.links.linkedin,
        ]),
        address: expect.objectContaining({
          '@type': 'PostalAddress',
          addressLocality: DEVELOPER_PUBLIC_PROFILE.city,
          addressRegion: DEVELOPER_PUBLIC_PROFILE.state,
          addressCountry: 'BR',
        }),
      })
    );
  });
});
