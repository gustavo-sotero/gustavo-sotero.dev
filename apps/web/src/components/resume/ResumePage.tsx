import { Briefcase, ExternalLink, Globe, GraduationCap, Mail, MapPin, Phone } from 'lucide-react';
import Link from 'next/link';
import { GitHubIcon, LinkedInIcon } from '@/components/shared/BrandIcons';
import type { ResumeViewModel } from '@/lib/resume/mapper';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <div className="flex items-center gap-3 mb-5">
        <h2 className="text-xs font-mono font-bold text-emerald-500 uppercase tracking-widest shrink-0">
          {title}
        </h2>
        <div className="flex-1 h-px bg-zinc-800" />
      </div>
      {children}
    </section>
  );
}

function EntryCard({ left, right }: { left: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="group relative rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 hover:border-zinc-700 transition-colors duration-200 mb-4 last:mb-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">{left}</div>
        {right && <div className="shrink-0 text-right">{right}</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-sections
// ---------------------------------------------------------------------------

function ExperienceSection({ experience }: { experience: ResumeViewModel['experience'] }) {
  if (experience.length === 0) return null;
  return (
    <Section title="Experiência Profissional">
      {experience.map((item) => (
        <EntryCard
          key={item.id}
          left={
            <>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h3 className="font-semibold text-zinc-100 text-base">{item.role}</h3>
                {item.isCurrent && (
                  <span className="text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                    atual
                  </span>
                )}
              </div>
              <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-sm text-zinc-400 mb-2">
                <span className="flex items-center gap-1.5">
                  <Briefcase className="h-3.5 w-3.5 shrink-0" />
                  {item.company}
                </span>
                {item.location && (
                  <span className="flex items-center gap-1 text-zinc-500">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    {item.location}
                  </span>
                )}
                {item.employmentType && (
                  <span className="text-zinc-500 text-xs border border-zinc-700 px-2 py-0.5 rounded-full">
                    {item.employmentType}
                  </span>
                )}
              </div>
              {item.description && (
                <p className="text-sm text-zinc-400 leading-relaxed">{item.description}</p>
              )}
              {item.impactFacts && item.impactFacts.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {item.impactFacts.map((fact) => (
                    <li
                      key={fact}
                      className="flex items-start gap-2 text-xs text-zinc-400 leading-relaxed"
                    >
                      <span className="text-emerald-500 mt-0.5 shrink-0">▸</span>
                      {fact}
                    </li>
                  ))}
                </ul>
              )}
              {item.tags && item.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {item.tags.map((tagName) => (
                    <span
                      key={tagName}
                      className="text-[11px] text-zinc-500 bg-zinc-800/60 border border-zinc-700/50 px-2 py-0.5 rounded-full"
                    >
                      {tagName}
                    </span>
                  ))}
                </div>
              )}
            </>
          }
          right={
            item.formattedPeriod ? (
              <span className="text-xs text-zinc-500 font-mono whitespace-nowrap">
                {item.formattedPeriod}
              </span>
            ) : undefined
          }
        />
      ))}
    </Section>
  );
}

function EducationSection({ education }: { education: ResumeViewModel['education'] }) {
  if (education.length === 0) return null;
  return (
    <Section title="Educação">
      {education.map((item) => (
        <EntryCard
          key={item.id}
          left={
            <>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h3 className="font-semibold text-zinc-100 text-base">{item.title}</h3>
                {item.isCurrent && (
                  <span className="text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                    em curso
                  </span>
                )}
              </div>
              <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-sm text-zinc-400 mb-2">
                <span className="flex items-center gap-1.5">
                  <GraduationCap className="h-3.5 w-3.5 shrink-0" />
                  {item.institution}
                </span>
                {item.location && (
                  <span className="flex items-center gap-1 text-zinc-500">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    {item.location}
                  </span>
                )}
                {item.educationType && (
                  <span className="text-zinc-500 text-xs border border-zinc-700 px-2 py-0.5 rounded-full">
                    {item.educationType}
                  </span>
                )}
                {item.workloadHours && (
                  <span className="text-zinc-500 text-xs">{item.workloadHours}h</span>
                )}
              </div>
              {item.description && (
                <p className="text-sm text-zinc-400 leading-relaxed">{item.description}</p>
              )}
            </>
          }
          right={
            item.formattedPeriod ? (
              <span className="text-xs text-zinc-500 font-mono whitespace-nowrap">
                {item.formattedPeriod}
              </span>
            ) : undefined
          }
        />
      ))}
    </Section>
  );
}

function SkillsSection({ skills }: { skills: ResumeViewModel['skills'] }) {
  if (skills.length === 0) return null;
  return (
    <Section title="Habilidades Técnicas">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {skills.map((group) => (
          <div key={group.category}>
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">
              {group.label}
            </p>
            <div className="flex flex-wrap gap-2">
              {group.skills.map((skill) => (
                <span
                  key={skill}
                  className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function ProjectsSection({ projects }: { projects: ResumeViewModel['projects'] }) {
  if (projects.length === 0) return null;
  return (
    <Section title="Projetos">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {projects.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 hover:border-zinc-700 transition-colors duration-200 flex flex-col gap-2"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-zinc-100 text-sm leading-snug">{item.title}</h3>
              <div className="flex gap-2 shrink-0">
                {item.repositoryUrl && (
                  <Link
                    href={item.repositoryUrl}
                    target="_blank"
                    rel="nofollow noreferrer"
                    className="text-zinc-500 hover:text-emerald-400 transition-colors"
                    aria-label={`Repositório de ${item.title}`}
                  >
                    <GitHubIcon className="h-3.5 w-3.5" />
                  </Link>
                )}
                {item.liveUrl && (
                  <Link
                    href={item.liveUrl}
                    target="_blank"
                    rel="nofollow noreferrer"
                    className="text-zinc-500 hover:text-emerald-400 transition-colors"
                    aria-label={`Demo de ${item.title}`}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
            </div>
            {item.description && (
              <p className="text-xs text-zinc-400 leading-relaxed flex-1">{item.description}</p>
            )}
            {item.impactFacts && item.impactFacts.length > 0 && (
              <ul className="space-y-1">
                {item.impactFacts.map((fact) => (
                  <li
                    key={fact}
                    className="flex items-start gap-1.5 text-xs text-zinc-400 leading-relaxed"
                  >
                    <span className="text-emerald-500 mt-0.5 shrink-0">▸</span>
                    {fact}
                  </li>
                ))}
              </ul>
            )}
            {item.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {item.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[11px] text-zinc-500 border border-zinc-700/60 px-2 py-0.5 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}

function LanguagesSection({ languages }: { languages: ResumeViewModel['languages'] }) {
  if (languages.length === 0) return null;
  return (
    <Section title="Idiomas">
      <div className="flex flex-wrap gap-6">
        {languages.map((lang) => (
          <div key={lang.name} className="flex items-baseline gap-2">
            <span className="font-semibold text-zinc-200 text-sm">{lang.name}</span>
            <span className="text-zinc-500 text-sm">{lang.level}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

function AdditionalInfoSection({ info }: { info: string[] }) {
  if (info.length === 0) return null;
  return (
    <Section title="Informações Adicionais">
      <ul className="space-y-2">
        {info.map((item) => (
          <li key={item} className="flex items-start gap-2.5 text-sm text-zinc-400">
            <span className="text-emerald-500 mt-0.5 shrink-0">▸</span>
            {item}
          </li>
        ))}
      </ul>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface ResumePageProps {
  resume: ResumeViewModel;
}

export function ResumePage({ resume }: ResumePageProps) {
  const { identity, contacts, experience, education, skills, projects, languages, additionalInfo } =
    resume;

  const locationStr = [identity.city, identity.state, identity.country].filter(Boolean).join(', ');

  return (
    <article className="max-w-3xl mx-auto">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="mb-10">
        <p className="text-xs font-mono text-emerald-500 uppercase tracking-widest mb-2">
          currículo
        </p>
        <h1 className="text-3xl md:text-4xl font-bold text-zinc-100 mb-1">{identity.name}</h1>
        <p className="text-emerald-400 font-medium text-lg mb-4">{identity.role}</p>

        {/* Meta info row */}
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-zinc-400 mb-4">
          <span className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
            {locationStr}
          </span>
          <span className="text-zinc-500">
            {identity.age} anos · {identity.citizenship}
          </span>
          <span className="flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
            <a
              href={`mailto:${contacts.email}`}
              className="hover:text-emerald-400 transition-colors"
            >
              {contacts.email}
            </a>
          </span>
          <span className="flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
            {contacts.phone}
          </span>
        </div>

        {/* Social links */}
        <div className="flex flex-wrap gap-3">
          <a
            href={contacts.linkedin}
            target="_blank"
            rel="nofollow noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-emerald-400 transition-colors border border-zinc-700 hover:border-emerald-500/50 rounded-full px-3 py-1.5"
          >
            <LinkedInIcon className="h-3.5 w-3.5" />
            LinkedIn
          </a>
          <a
            href={contacts.github}
            target="_blank"
            rel="nofollow noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-emerald-400 transition-colors border border-zinc-700 hover:border-emerald-500/50 rounded-full px-3 py-1.5"
          >
            <GitHubIcon className="h-3.5 w-3.5" />
            GitHub
          </a>
          <a
            href={contacts.website}
            target="_blank"
            rel="nofollow noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-emerald-400 transition-colors border border-zinc-700 hover:border-emerald-500/50 rounded-full px-3 py-1.5"
          >
            <Globe className="h-3.5 w-3.5" />
            {contacts.website.replace('https://', '')}
          </a>
        </div>
      </header>

      {/* ── Objective ───────────────────────────────────────────────────── */}
      {identity.objective && (
        <section className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-xs font-mono font-bold text-emerald-500 uppercase tracking-widest shrink-0">
              Objetivo
            </h2>
            <div className="flex-1 h-px bg-zinc-800" />
          </div>
          <p className="text-zinc-400 leading-relaxed">{identity.objective}</p>
        </section>
      )}

      {/* ── Dynamic sections ────────────────────────────────────────────── */}
      <ExperienceSection experience={experience} />
      <EducationSection education={education} />
      <SkillsSection skills={skills} />
      <ProjectsSection projects={projects} />
      <LanguagesSection languages={languages} />
      <AdditionalInfoSection info={additionalInfo} />
    </article>
  );
}
