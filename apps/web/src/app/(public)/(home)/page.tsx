import { DEVELOPER_PUBLIC_PROFILE } from '@portfolio/shared/constants/developerProfile';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ContactSection } from '@/components/home/ContactSection';
import { EducationSectionWrapper } from '@/components/home/sections/EducationSectionWrapper';
import { ExperienceSectionWrapper } from '@/components/home/sections/ExperienceSectionWrapper';
import { FeaturedProjectsSection } from '@/components/home/sections/FeaturedProjectsSection';
import { HeroSectionWrapper } from '@/components/home/sections/HeroSectionWrapper';
import { RecentPostsSection } from '@/components/home/sections/RecentPostsSection';
import { SkillsSection } from '@/components/home/sections/SkillsSection';
import {
  EducationSkeleton,
  ExperienceSkeleton,
  FeaturedProjectsSkeleton,
  RecentPostsSkeleton,
  SkillsSkeleton,
} from '@/components/home/skeletons';
import { JsonLdScript } from '@/components/shared/JsonLdScript';
import { SITE_METADATA } from '@/lib/constants';
import { getHomeAggregate } from '@/lib/data/public/home';

export const metadata: Metadata = {
  title: SITE_METADATA.title,
  description: SITE_METADATA.description,
  openGraph: {
    title: SITE_METADATA.title,
    description: SITE_METADATA.description,
  },
};

export default function HomePage() {
  const aggregatePromise = getHomeAggregate();

  const personJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: DEVELOPER_PUBLIC_PROFILE.name,
    url: SITE_METADATA.url,
    jobTitle: DEVELOPER_PUBLIC_PROFILE.role,
    description: DEVELOPER_PUBLIC_PROFILE.bioShort,
    sameAs: [DEVELOPER_PUBLIC_PROFILE.links.github, DEVELOPER_PUBLIC_PROFILE.links.linkedin],
    address: {
      '@type': 'PostalAddress',
      addressLocality: DEVELOPER_PUBLIC_PROFILE.city,
      addressRegion: DEVELOPER_PUBLIC_PROFILE.state,
      addressCountry: 'BR',
    },
    email: DEVELOPER_PUBLIC_PROFILE.contacts.email,
  };

  return (
    <>
      <JsonLdScript data={personJsonLd} />

      {/* Hero is pre-rendered synchronously — data fetching functions use
          'use cache' so on warm requests the data is instantly available.
          No Suspense boundary here intentionally: the hero must appear without
          any loading flash or streaming pop-in (only the terminal's own
          typing animation is allowed). */}
      <HeroSectionWrapper aggregatePromise={aggregatePromise} />

      {/* Main content sections — each has its own Suspense boundary */}
      <div className="container mx-auto max-w-6xl px-4 md:px-6 lg:px-8 space-y-24 pb-24">
        <section id="projetos" aria-label="Projetos">
          <Suspense fallback={<FeaturedProjectsSkeleton />}>
            <FeaturedProjectsSection aggregatePromise={aggregatePromise} />
          </Suspense>
        </section>

        <section id="posts" aria-label="Posts em destaque">
          <Suspense fallback={<RecentPostsSkeleton />}>
            <RecentPostsSection aggregatePromise={aggregatePromise} />
          </Suspense>
        </section>

        <section id="skills" aria-label="Habilidades técnicas">
          <Suspense fallback={<SkillsSkeleton />}>
            <SkillsSection aggregatePromise={aggregatePromise} />
          </Suspense>
        </section>

        <section id="experiencia" aria-label="Experiência profissional">
          <Suspense fallback={<ExperienceSkeleton />}>
            <ExperienceSectionWrapper aggregatePromise={aggregatePromise} />
          </Suspense>
        </section>

        <section id="formacao" aria-label="Educação e cursos">
          <Suspense fallback={<EducationSkeleton />}>
            <EducationSectionWrapper aggregatePromise={aggregatePromise} />
          </Suspense>
        </section>

        {/* Contact is static — no data fetch, no boundary needed */}
        <section id="contato" aria-label="Contato">
          <ContactSection />
        </section>
      </div>
    </>
  );
}
