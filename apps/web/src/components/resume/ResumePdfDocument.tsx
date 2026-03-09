'use client';

import { Document, Font, Link, Page, Path, StyleSheet, Svg, Text, View } from '@react-pdf/renderer';
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
// Palette
// ---------------------------------------------------------------------------
const C = {
  black: '#111111',
  dark: '#1c1c1c',
  mid: '#4a4a4a',
  muted: '#767676',
  border: '#d4d4d4',
  accent: '#0e7a52', // deep emerald — prints well on paper
  accentLight: '#e8f5ef',
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
    paddingTop: 40,
    paddingBottom: 40,
    paddingLeft: 48,
    paddingRight: 48,
    lineHeight: 1.5,
  },

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    marginBottom: 18,
    paddingBottom: 14,
    borderBottomWidth: 1.5,
    borderBottomColor: C.accent,
  },
  headerTop: {
    marginBottom: 10,
  },
  headerName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: C.black,
    letterSpacing: 0.5,
    marginBottom: 4,
    lineHeight: 1.2,
  },
  headerRole: {
    fontSize: 11,
    color: C.accent,
    fontWeight: 'bold',
    letterSpacing: 0.3,
    lineHeight: 1.3,
  },
  headerDivider: {
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
    marginVertical: 8,
  },
  headerMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  headerMetaCol: {
    flexDirection: 'column',
    flex: 1,
    gap: 3,
  },
  headerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerMetaLabel: {
    fontSize: 8,
    color: C.muted,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    minWidth: 40,
  },
  headerMetaValue: {
    fontSize: 8.5,
    color: C.mid,
  },
  headerLink: {
    fontSize: 8.5,
    color: C.accent,
    textDecoration: 'none',
  },

  // ── Section ─────────────────────────────────────────────────────────────
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: C.accent,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
    paddingBottom: 3,
  },

  // ── Objective ────────────────────────────────────────────────────────────
  objectiveText: {
    fontSize: 9.5,
    color: C.mid,
    lineHeight: 1.6,
  },

  // ── Entry (experience / education) ─────────────────────────────────────
  entry: {
    marginBottom: 9,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 1,
  },
  entryTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: C.black,
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
    color: C.mid,
    lineHeight: 1.55,
  },
  currentBadge: {
    fontSize: 7.5,
    color: C.accent,
    backgroundColor: C.accentLight,
    paddingHorizontal: 4,
    paddingTop: 2,
    paddingBottom: 0,
    borderRadius: 3,
    marginLeft: 6,
    alignSelf: 'center',
  },

  // ── Skills ───────────────────────────────────────────────────────────────
  skillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  skillGroup: {
    marginBottom: 5,
    minWidth: 120,
  },
  skillGroupLabel: {
    fontSize: 8.5,
    fontWeight: 'bold',
    color: C.mid,
    marginBottom: 3,
  },
  skillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  skillPill: {
    fontSize: 8,
    color: C.accent,
    backgroundColor: C.accentLight,
    paddingHorizontal: 5,
    paddingTop: 2.5,
    paddingBottom: 0.5,
    borderRadius: 3,
  },

  // ── Experience tags ───────────────────────────────────────────────────────
  experienceTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
    marginTop: 3,
  },
  experienceTag: {
    fontSize: 7.5,
    color: C.muted,
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 4,
    paddingTop: 2,
    paddingBottom: 0,
    borderRadius: 2,
  },

  // ── Projects ─────────────────────────────────────────────────────────────
  projectEntry: {
    marginBottom: 8,
  },
  projectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  projectDesc: {
    fontSize: 9,
    color: C.mid,
    lineHeight: 1.5,
    marginBottom: 3,
  },
  projectTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
  },
  projectTag: {
    fontSize: 7.5,
    color: C.muted,
    paddingHorizontal: 4,
    paddingTop: 2,
    paddingBottom: 0,
  },

  // ── Languages ────────────────────────────────────────────────────────────
  langsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
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
    gap: 5,
    marginBottom: 3,
  },
  bulletDot: {
    lineHeight: 1.55,
    marginTop: 0,
  },
  bulletText: {
    fontSize: 9,
    color: C.mid,
    lineHeight: 1.55,
    flex: 1,
  },

  // ── Footer ────────────────────────────────────────────────────────────────
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 48,
    right: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 7.5,
    color: C.muted,
  },
});

// ---------------------------------------------------------------------------
// SVG Icons (Material Design paths, 24x24 viewBox)
// ---------------------------------------------------------------------------

const ICON = 9;

function IcoPin() {
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 24 24" style={{ marginTop: -4 }}>
      <Path
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
        fill={C.muted}
      />
    </Svg>
  );
}

function IcoPerson() {
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 24 24" style={{ marginTop: -4 }}>
      <Path
        d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
        fill={C.muted}
      />
    </Svg>
  );
}

function IcoPhone() {
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 24 24" style={{ marginTop: -4 }}>
      <Path
        d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"
        fill={C.muted}
      />
    </Svg>
  );
}

function IcoMail() {
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 24 24" style={{ marginTop: -4 }}>
      <Path
        d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"
        fill={C.muted}
      />
    </Svg>
  );
}

function IcoLinkedIn() {
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 24 24" style={{ marginTop: -4 }}>
      <Path
        d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14zm-1 15v-5.5c0-1.93-1.4-3.5-3.5-3.5-1.02 0-1.94.52-2.5 1.35V9H9v9h3v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5V18h3zM6.5 7.5C5.67 7.5 5 8.17 5 9s.67 1.5 1.5 1.5S8 9.83 8 9s-.67-1.5-1.5-1.5zM8 18V9H5v9h3z"
        fill={C.muted}
      />
    </Svg>
  );
}

function IcoGithub() {
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 24 24" style={{ marginTop: -4 }}>
      <Path
        d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z"
        fill={C.muted}
      />
    </Svg>
  );
}

function IcoGlobe() {
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 24 24" style={{ marginTop: -4 }}>
      <Path
        d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm6.93 6h-2.95c-.32-1.25-.78-2.45-1.38-3.56 1.84.63 3.37 1.91 4.33 3.56zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96zM4.26 14C4.1 13.36 4 12.69 4 12s.1-1.36.26-2h3.38c-.08.66-.14 1.32-.14 2 0 .68.06 1.34.14 2H4.26zm.82 2h2.95c.32 1.25.78 2.45 1.38 3.56-1.84-.63-3.37-1.9-4.33-3.56zm2.95-8H5.08c.96-1.66 2.49-2.93 4.33-3.56C8.81 5.55 8.35 6.75 8.03 8zM12 19.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82c-.43 1.43-1.08 2.76-1.91 3.96zM14.34 14H9.66c-.09-.66-.16-1.32-.16-2 0-.68.07-1.35.16-2h4.68c.09.65.16 1.32.16 2 0 .68-.07 1.34-.16 2zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95c-.96 1.65-2.49 2.93-4.33 3.56zM16.36 14c.08-.66.14-1.32.14-2 0-.68-.06-1.34-.14-2h3.38c.16.64.26 1.31.26 2s-.1 1.36-.26 2h-3.38z"
        fill={C.muted}
      />
    </Svg>
  );
}

function IcoBullet() {
  return (
    <Svg width={6} height={6} viewBox="0 0 24 24" style={{ marginTop: 2 }}>
      <Path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z" fill={C.accent} />
    </Svg>
  );
}

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
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Text style={s.entryTitle}>{item.role}</Text>
          {item.isCurrent && <Text style={s.currentBadge}>atual</Text>}
        </View>
        <Text style={s.entryPeriod}>{item.formattedPeriod}</Text>
      </View>
      <Text style={s.entrySub}>
        {item.company}
        {item.location ? ` · ${item.location}` : ''}
        {item.employmentType ? ` · ${item.employmentType}` : ''}
      </Text>
      {item.description ? <Text style={s.entryDesc}>{item.description}</Text> : null}
      {item.tags && item.tags.length > 0 ? (
        <View style={s.experienceTagsRow}>
          {item.tags.map((tagName) => (
            <Text key={tagName} style={s.experienceTag}>
              {tagName}
            </Text>
          ))}
        </View>
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
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Text style={s.entryTitle}>{item.title}</Text>
          {item.isCurrent && <Text style={s.currentBadge}>em curso</Text>}
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
            <Link src={item.repositoryUrl} style={s.headerLink}>
              GitHub
            </Link>
          ) : null}
          {item.liveUrl ? (
            <Link src={item.liveUrl} style={s.headerLink}>
              Demo
            </Link>
          ) : null}
        </View>
      </View>
      {item.description ? <Text style={s.projectDesc}>{item.description}</Text> : null}
      {item.tags.length > 0 ? (
        <View style={s.projectTags}>
          {item.tags.map((tag) => (
            <Text key={tag} style={s.projectTag}>
              {tag}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main Document
// ---------------------------------------------------------------------------

interface ResumePdfDocumentProps {
  resume: ResumeViewModel;
}

export function ResumePdfDocument({ resume }: ResumePdfDocumentProps) {
  const { identity, contacts, experience, education, skills, projects, languages, additionalInfo } =
    resume;

  const locationStr = [identity.city, identity.state, identity.country].filter(Boolean).join(', ');

  const today = new Date();
  const generatedAt = today.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

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
          <View style={s.headerTop}>
            <Text style={s.headerName}>{identity.name}</Text>
            <Text style={s.headerRole}>{identity.role}</Text>
          </View>
          <View style={s.headerDivider} />
          <View style={s.headerMeta}>
            {/* Coluna esquerda */}
            <View style={s.headerMetaCol}>
              {locationStr ? (
                <View style={s.headerMetaRow}>
                  <IcoPin />
                  <Text style={s.headerMetaValue}>{locationStr}</Text>
                </View>
              ) : null}
              {identity.age ? (
                <View style={s.headerMetaRow}>
                  <IcoPerson />
                  <Text style={s.headerMetaValue}>
                    {identity.age} anos{identity.citizenship ? ` · ${identity.citizenship}` : ''}
                  </Text>
                </View>
              ) : null}
              {contacts.phone ? (
                <View style={s.headerMetaRow}>
                  <IcoPhone />
                  <Text style={s.headerMetaValue}>{contacts.phone}</Text>
                </View>
              ) : null}
              {contacts.email ? (
                <View style={s.headerMetaRow}>
                  <IcoMail />
                  <Link src={`mailto:${contacts.email}`} style={s.headerLink}>
                    {contacts.email}
                  </Link>
                </View>
              ) : null}
            </View>
            {/* Coluna direita */}
            <View style={s.headerMetaCol}>
              {contacts.linkedin ? (
                <View style={s.headerMetaRow}>
                  <IcoLinkedIn />
                  <Link src={contacts.linkedin} style={s.headerLink}>
                    {contacts.linkedin.replace('https://www.linkedin.com/in/', 'linkedin.com/in/')}
                  </Link>
                </View>
              ) : null}
              {contacts.github ? (
                <View style={s.headerMetaRow}>
                  <IcoGithub />
                  <Link src={contacts.github} style={s.headerLink}>
                    {contacts.github.replace('https://github.com/', 'github.com/')}
                  </Link>
                </View>
              ) : null}
              {contacts.website ? (
                <View style={s.headerMetaRow}>
                  <IcoGlobe />
                  <Link src={contacts.website} style={s.headerLink}>
                    {contacts.website.replace('https://', '')}
                  </Link>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {/* ── Objetivo ────────────────────────────────────────────────────── */}
        {identity.objective ? (
          <View style={s.section}>
            <SectionTitle>Objetivo</SectionTitle>
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
        {skills.length > 0 ? (
          <View style={s.section}>
            <SectionTitle>Habilidades Técnicas</SectionTitle>
            <View style={s.skillsGrid}>
              {skills.map((group) => (
                <View key={group.category} style={s.skillGroup}>
                  <Text style={s.skillGroupLabel}>{group.label}</Text>
                  <View style={s.skillsRow}>
                    {group.skills.map((skill) => (
                      <Text key={skill} style={s.skillPill}>
                        {skill}
                      </Text>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}

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
                <View style={s.bulletDot}>
                  <IcoBullet />
                </View>
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
