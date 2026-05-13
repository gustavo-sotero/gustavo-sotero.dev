import { Document, Font, Link, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { ResumeViewModel } from '@/lib/resume/mapper';

// ---------------------------------------------------------------------------
// Font registration — use standard fonts for maximum compatibility
// ---------------------------------------------------------------------------
Font.register({
  family: 'Helvetica',
  fonts: [
    { src: 'Helvetica' },
    { src: 'Helvetica-Bold', fontWeight: 'bold' },
    { src: 'Helvetica-Oblique', fontStyle: 'italic' },
  ],
});

// ---------------------------------------------------------------------------
// Palette — neutral, editorial
// ---------------------------------------------------------------------------
const C = {
  black: '#0a0a0a',
  dark: '#1a1a1a',
  mid: '#3a3a3a',
  muted: '#5a5a5a',
  light: '#999999',
  rule: '#cccccc',
  white: '#ffffff',
} as const;

// ---------------------------------------------------------------------------
// StyleSheet
// ---------------------------------------------------------------------------
const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9.5,
    color: C.dark,
    backgroundColor: C.white,
    paddingTop: 44,
    paddingBottom: 44,
    paddingLeft: 52,
    paddingRight: 52,
    lineHeight: 1.5,
  },

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.rule,
  },
  headerName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: C.black,
    letterSpacing: 0.3,
    marginBottom: 3,
    lineHeight: 1.2,
  },
  headerRole: {
    fontSize: 11,
    color: C.mid,
    marginBottom: 10,
    lineHeight: 1.3,
  },
  headerContactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginBottom: 4,
  },
  headerContactText: {
    fontSize: 8.5,
    color: C.mid,
  },
  headerLink: {
    fontSize: 8.5,
    color: '#1a56db',
    textDecoration: 'underline',
  },
  headerSep: {
    fontSize: 8.5,
    color: C.light,
  },

  // ── Section ─────────────────────────────────────────────────────────────
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 8,
    fontWeight: 'bold',
    color: C.muted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 7,
    borderBottomWidth: 0.5,
    borderBottomColor: C.rule,
    paddingBottom: 3,
  },

  // ── Objective ────────────────────────────────────────────────────────────
  objectiveText: {
    fontSize: 9.5,
    color: C.dark,
    lineHeight: 1.6,
  },

  // ── Entry (experience / education) ─────────────────────────────────────
  entry: {
    marginBottom: 10,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 1,
  },
  entryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  entryTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: C.black,
  },
  entryCurrentLabel: {
    fontSize: 7.5,
    color: C.muted,
    marginLeft: 6,
    fontStyle: 'italic',
  },
  entryPeriod: {
    fontSize: 8.5,
    color: C.muted,
    textAlign: 'right',
    flexShrink: 0,
    marginLeft: 8,
  },
  entrySub: {
    fontSize: 9,
    color: C.mid,
    marginBottom: 2,
  },
  entryMeta: {
    fontSize: 8.5,
    color: C.muted,
    marginBottom: 2,
    fontStyle: 'italic',
  },
  entryDesc: {
    fontSize: 9,
    color: C.dark,
    lineHeight: 1.55,
    marginBottom: 3,
  },
  impactList: {
    marginTop: 3,
    marginBottom: 2,
  },
  impactRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 2,
  },
  impactBullet: {
    fontSize: 8.5,
    color: C.muted,
    marginRight: 5,
    lineHeight: 1.5,
  },
  impactText: {
    fontSize: 8.5,
    color: C.dark,
    lineHeight: 1.5,
    flex: 1,
  },

  // ── Skills ───────────────────────────────────────────────────────────────
  skillGroup: {
    marginBottom: 5,
  },
  skillGroupLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  skillsText: {
    fontSize: 8.5,
    color: C.dark,
    lineHeight: 1.5,
  },

  // ── Experience inline skills ──────────────────────────────────────────────
  experienceSkillsText: {
    fontSize: 7.5,
    color: C.muted,
    marginTop: 3,
    lineHeight: 1.4,
  },

  // ── Projects ─────────────────────────────────────────────────────────────
  projectEntry: {
    marginBottom: 9,
  },
  projectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 1,
  },
  projectTitle: {
    fontSize: 9.5,
    fontWeight: 'bold',
    color: C.black,
  },
  projectLinks: {
    flexDirection: 'row',
    gap: 8,
  },
  projectLink: {
    fontSize: 8,
    color: '#1a56db',
    textDecoration: 'underline',
  },
  projectDesc: {
    fontSize: 9,
    color: C.dark,
    lineHeight: 1.5,
    marginBottom: 3,
  },
  projectSkillsText: {
    fontSize: 7.5,
    color: C.muted,
    lineHeight: 1.4,
  },

  // ── Languages ────────────────────────────────────────────────────────────
  langsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  langItem: {
    flexDirection: 'row',
    gap: 4,
  },
  langName: {
    fontWeight: 'bold',
    fontSize: 9.5,
    color: C.dark,
  },
  langLevel: {
    fontSize: 9.5,
    color: C.muted,
  },

  // ── Additional info ───────────────────────────────────────────────────────
  bulletRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 4,
  },
  bulletDot: {
    fontSize: 9,
    color: C.muted,
    lineHeight: 1.55,
    marginTop: 0,
  },
  bulletText: {
    fontSize: 9,
    color: C.dark,
    lineHeight: 1.55,
    flex: 1,
  },

  // ── Footer ────────────────────────────────────────────────────────────────
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 52,
    right: 52,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 7.5,
    color: C.light,
  },
});

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionTitle({ children }: { children: string }) {
  return <Text style={s.sectionTitle}>{children}</Text>;
}

function ExperienceEntry({ item }: { item: ResumeViewModel['experience'][number] }) {
  return (
    <View style={s.entry} wrap={false}>
      <View style={s.entryHeader}>
        <View style={s.entryTitleRow}>
          <Text style={s.entryTitle}>{item.role}</Text>
          {item.isCurrent && <Text style={s.entryCurrentLabel}>atual</Text>}
        </View>
        <Text style={s.entryPeriod}>{item.formattedPeriod}</Text>
      </View>
      <Text style={s.entrySub}>
        {item.company}
        {item.location ? ` · ${item.location}` : ''}
        {item.employmentType ? ` · ${item.employmentType}` : ''}
      </Text>
      {item.description ? <Text style={s.entryDesc}>{item.description}</Text> : null}
      {item.impactFacts && item.impactFacts.length > 0 ? (
        <View style={s.impactList}>
          {item.impactFacts.map((fact) => (
            <View key={fact} style={s.impactRow}>
              <Text style={s.impactBullet}>›</Text>
              <Text style={s.impactText}>{fact}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {item.skills && item.skills.length > 0 ? (
        <Text style={s.experienceSkillsText}>{item.skills.join(' · ')}</Text>
      ) : null}
    </View>
  );
}

function EducationEntry({ item }: { item: ResumeViewModel['education'][number] }) {
  const meta: string[] = [];
  if (item.educationType) meta.push(item.educationType);
  if (item.location) meta.push(item.location);
  if (item.workloadHours) meta.push(`${item.workloadHours}h`);

  return (
    <View style={s.entry} wrap={false}>
      <View style={s.entryHeader}>
        <View style={s.entryTitleRow}>
          <Text style={s.entryTitle}>{item.title}</Text>
          {item.isCurrent && <Text style={s.entryCurrentLabel}>em curso</Text>}
        </View>
        {item.formattedPeriod ? <Text style={s.entryPeriod}>{item.formattedPeriod}</Text> : null}
      </View>
      <Text style={s.entrySub}>{item.institution}</Text>
      {meta.length > 0 ? <Text style={s.entryMeta}>{meta.join(' · ')}</Text> : null}
      {item.description ? <Text style={s.entryDesc}>{item.description}</Text> : null}
    </View>
  );
}

function ProjectEntry({ item }: { item: ResumeViewModel['projects'][number] }) {
  return (
    <View style={s.projectEntry} wrap={false}>
      <View style={s.projectHeader}>
        <Text style={s.projectTitle}>{item.title}</Text>
        <View style={s.projectLinks}>
          {item.repositoryUrl ? (
            <Link src={item.repositoryUrl} style={s.projectLink}>
              GitHub
            </Link>
          ) : null}
          {item.liveUrl ? (
            <Link src={item.liveUrl} style={s.projectLink}>
              Demo
            </Link>
          ) : null}
        </View>
      </View>
      {item.description ? <Text style={s.projectDesc}>{item.description}</Text> : null}
      {item.impactFacts && item.impactFacts.length > 0 ? (
        <View style={s.impactList}>
          {item.impactFacts.map((fact) => (
            <View key={fact} style={s.impactRow}>
              <Text style={s.impactBullet}>›</Text>
              <Text style={s.impactText}>{fact}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {item.skills.length > 0 ? (
        <Text style={s.projectSkillsText}>{item.skills.join(' · ')}</Text>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main Document
// ---------------------------------------------------------------------------

interface ResumePdfDocumentProps {
  resume: ResumeViewModel;
  /** Pre-formatted date string (e.g. "15 de maio de 2026"). Must be supplied by the caller. */
  generatedAt: string;
}

export function ResumePdfDocument({ resume, generatedAt }: ResumePdfDocumentProps) {
  const { identity, contacts, experience, education, skills, projects, languages, additionalInfo } =
    resume;

  const locationStr = [identity.city, identity.state, identity.country].filter(Boolean).join(', ');

  const contactLine = [locationStr, `${identity.age} anos`, contacts.email, contacts.phone]
    .filter(Boolean)
    .join('  ·  ');

  const contactLinks: { label: string; href: string }[] = [
    contacts.github
      ? {
          label: contacts.github.replace('https://github.com/', 'github.com/'),
          href: contacts.github,
        }
      : null,
    contacts.linkedin
      ? {
          label: contacts.linkedin.replace('https://www.linkedin.com/in/', 'linkedin.com/in/'),
          href: contacts.linkedin,
        }
      : null,
    contacts.website
      ? { label: contacts.website.replace('https://', ''), href: contacts.website }
      : null,
  ].filter((x): x is { label: string; href: string } => x !== null);

  return (
    <Document
      title={`Currículo — ${identity.name}`}
      author={identity.name}
      subject={`Currículo de ${identity.name} — ${identity.role}`}
      creator="gustavo-sotero.dev"
      keywords="desenvolvedor fullstack typescript bun hono next.js"
    >
      <Page size="A4" style={s.page}>
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={s.header}>
          <Text style={s.headerName}>{identity.name}</Text>
          <Text style={s.headerRole}>{identity.role}</Text>
          {contactLine ? (
            <View style={s.headerContactRow}>
              <Text style={s.headerContactText}>
                {locationStr}
                {'  ·  '}
                {`${identity.age} anos`}
                {'  ·  '}
              </Text>
              <Link src={`mailto:${contacts.email}`} style={s.headerLink}>
                {contacts.email}
              </Link>
              <Text style={s.headerContactText}>{'  ·  '}</Text>
              <Text style={s.headerContactText}>{contacts.phone}</Text>
            </View>
          ) : null}
          {contactLinks.length > 0 ? (
            <View style={s.headerContactRow}>
              {contactLinks.map((link, i) => (
                <Text key={link.href} style={s.headerContactText}>
                  {i > 0 ? '  ·  ' : ''}
                  <Link src={link.href} style={s.headerLink}>
                    {link.label}
                  </Link>
                </Text>
              ))}
            </View>
          ) : null}
        </View>

        {/* ── Objetivo ────────────────────────────────────────────────────── */}
        {identity.objective ? (
          <View style={s.section}>
            <SectionTitle>Resumo Profissional</SectionTitle>
            <Text style={s.objectiveText}>{identity.objective}</Text>
          </View>
        ) : null}

        {/* ── Experiência ─────────────────────────────────────────────────── */}
        {experience.length > 0 ? (
          <View style={s.section}>
            <SectionTitle>Experiência Profissional</SectionTitle>
            {experience.map((item) => (
              <ExperienceEntry key={item.id} item={item} />
            ))}
          </View>
        ) : null}

        {/* ── Educação ────────────────────────────────────────────────────── */}
        {education.length > 0 ? (
          <View style={s.section}>
            <SectionTitle>Educação</SectionTitle>
            {education.map((item) => (
              <EducationEntry key={item.id} item={item} />
            ))}
          </View>
        ) : null}

        {/* ── Habilidades ─────────────────────────────────────────────────── */}
        {/* ── Habilidades ─────────────────────────────────────────────────── */}
        {skills.length > 0
          ? skills.map((group, i) => (
              <View
                key={group.category}
                wrap={false}
                style={{ marginBottom: i === skills.length - 1 ? 16 : 5 }}
              >
                {i === 0 ? <SectionTitle>Habilidades Técnicas</SectionTitle> : null}
                <Text style={s.skillGroupLabel}>{group.label}</Text>
                <Text style={s.skillsText}>{group.skills.map((sk) => sk.name).join(', ')}</Text>
              </View>
            ))
          : null}

        {/* ── Projetos ────────────────────────────────────────────────────── */}
        {projects.length > 0 ? (
          <View style={s.section}>
            <SectionTitle>Projetos</SectionTitle>
            {projects.map((item) => (
              <ProjectEntry key={item.id} item={item} />
            ))}
          </View>
        ) : null}

        {/* ── Idiomas ─────────────────────────────────────────────────────── */}
        {languages.length > 0 ? (
          <View style={s.section}>
            <SectionTitle>Idiomas</SectionTitle>
            <View style={s.langsRow}>
              {languages.map((lang) => (
                <View key={lang.name} style={s.langItem}>
                  <Text style={s.langName}>{lang.name}:</Text>
                  <Text style={s.langLevel}>{lang.level}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* ── Informações adicionais ──────────────────────────────────────── */}
        {additionalInfo.length > 0 ? (
          <View style={s.section}>
            <SectionTitle>Informações Adicionais</SectionTitle>
            {additionalInfo.map((info) => (
              <View key={info} style={s.bulletRow}>
                <Text style={s.bulletDot}>–</Text>
                <Text style={s.bulletText}>{info}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* ── Footer (fixed) ──────────────────────────────────────────────── */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>{identity.name} · Currículo</Text>
          <Text style={s.footerText}>Gerado em {generatedAt}</Text>
          <Text
            style={s.footerText}
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
