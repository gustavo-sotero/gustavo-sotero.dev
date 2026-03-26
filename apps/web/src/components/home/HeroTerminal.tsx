'use client';

import { DEVELOPER_PUBLIC_PROFILE, getExperienceLabel } from '@portfolio/shared';
import { useMemo } from 'react';
import { AnimatedSpan, Terminal, TypingAnimation } from '@/components/ui/terminal';
import { env } from '@/lib/env';

const FALLBACK_STACK = ['TypeScript', 'Bun', 'Hono', 'Next.js', 'PostgreSQL'];

const DEVELOPER_PROFILE = {
  name: DEVELOPER_PUBLIC_PROFILE.name,
  role: DEVELOPER_PUBLIC_PROFILE.role,
  availability: DEVELOPER_PUBLIC_PROFILE.availability,
  experience: getExperienceLabel(),
  location: DEVELOPER_PUBLIC_PROFILE.location,
  links: {
    github: DEVELOPER_PUBLIC_PROFILE.links.github,
    linkedin: DEVELOPER_PUBLIC_PROFILE.links.linkedin,
    website: DEVELOPER_PUBLIC_PROFILE.links.website,
    telegram: DEVELOPER_PUBLIC_PROFILE.links.telegram,
    whatsapp: DEVELOPER_PUBLIC_PROFILE.links.whatsapp,
  },
  contacts: {
    email: DEVELOPER_PUBLIC_PROFILE.contacts.email,
    phone: DEVELOPER_PUBLIC_PROFILE.contacts.phone,
  },
} as const;

const CLICKABLE_VALUE_TO_HREF: Record<string, string> = {
  [DEVELOPER_PUBLIC_PROFILE.links.github]: DEVELOPER_PUBLIC_PROFILE.links.github,
  [DEVELOPER_PUBLIC_PROFILE.links.linkedin]: DEVELOPER_PUBLIC_PROFILE.links.linkedin,
  [DEVELOPER_PUBLIC_PROFILE.links.website]: DEVELOPER_PUBLIC_PROFILE.links.website,
  [DEVELOPER_PUBLIC_PROFILE.links.telegram]: DEVELOPER_PUBLIC_PROFILE.links.telegram,
  [DEVELOPER_PUBLIC_PROFILE.links.whatsapp]: DEVELOPER_PUBLIC_PROFILE.links.whatsapp,
  [DEVELOPER_PUBLIC_PROFILE.contacts.email]: `mailto:${DEVELOPER_PUBLIC_PROFILE.contacts.email}`,
  [DEVELOPER_PUBLIC_PROFILE.contacts.phone]:
    `tel:${DEVELOPER_PUBLIC_PROFILE.contacts.phone.replace(/\s+/g, '')}`,
};

interface HeroTerminalProps {
  stack?: string[];
}

// ---------------------------------------------------------------------------
// Token colours — applied as inline styles so they are completely immune to
// Tailwind JIT scanning, dark-mode selectors and CSS cascade specificity.
// ---------------------------------------------------------------------------
const C = {
  key: '#7dd3fc', // sky-300     – JSON keys
  str: '#6ee7b7', // emerald-300 – string values
  bool: '#fbbf24', // amber-400   – true / false / null
  num: '#c084fc', // purple-400  – numbers
  punct: '#71717a', // zinc-500    – { } [ ] : ,
  ws: '#a1a1aa', // zinc-400    – whitespace / commas
} as const;

type TokenKind = keyof typeof C;

interface Token {
  kind: TokenKind;
  text: string;
}

/**
 * Character-level tokeniser for 2-space-indented JSON produced by
 * JSON.stringify. Single forward pass — no regex lastIndex state,
 * no re-entrant issues between React renders.
 */
function tokeniseJson(raw: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < raw.length) {
    const ch = raw[i];

    // ── whitespace ──────────────────────────────────────────────────────────
    if (ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t') {
      let j = i;
      while (
        j < raw.length &&
        (raw[j] === ' ' || raw[j] === '\n' || raw[j] === '\r' || raw[j] === '\t')
      )
        j++;
      tokens.push({ kind: 'ws', text: raw.slice(i, j) });
      i = j;
      continue;
    }

    // ── quoted string ────────────────────────────────────────────────────────
    if (ch === '"') {
      let j = i + 1;
      while (j < raw.length) {
        if (raw[j] === '\\') {
          j += 2;
          continue;
        }
        if (raw[j] === '"') {
          j++;
          break;
        }
        j++;
      }
      const str = raw.slice(i, j);
      // Peek past whitespace — if next non-space char is ':' this is a key
      let peek = j;
      while (peek < raw.length && (raw[peek] === ' ' || raw[peek] === '\t')) peek++;
      tokens.push({ kind: raw[peek] === ':' ? 'key' : 'str', text: str });
      i = j;
      continue;
    }

    // ── keywords ─────────────────────────────────────────────────────────────
    if (raw.startsWith('true', i)) {
      tokens.push({ kind: 'bool', text: 'true' });
      i += 4;
      continue;
    }
    if (raw.startsWith('false', i)) {
      tokens.push({ kind: 'bool', text: 'false' });
      i += 5;
      continue;
    }
    if (raw.startsWith('null', i)) {
      tokens.push({ kind: 'bool', text: 'null' });
      i += 4;
      continue;
    }

    // ── numbers ───────────────────────────────────────────────────────────────
    if (
      (ch >= '0' && ch <= '9') ||
      (ch === '-' && i + 1 < raw.length && raw[i + 1] >= '0' && raw[i + 1] <= '9')
    ) {
      let j = i;
      if (raw[j] === '-') j++;
      while (j < raw.length && raw[j] >= '0' && raw[j] <= '9') j++;
      if (raw[j] === '.') {
        j++;
        while (j < raw.length && raw[j] >= '0' && raw[j] <= '9') j++;
      }
      tokens.push({ kind: 'num', text: raw.slice(i, j) });
      i = j;
      continue;
    }

    // ── punctuation ───────────────────────────────────────────────────────────
    if ('{}[]:,'.includes(ch)) {
      tokens.push({ kind: 'punct', text: ch });
      i++;
      continue;
    }

    // ── fallback ──────────────────────────────────────────────────────────────
    tokens.push({ kind: 'ws', text: ch });
    i++;
  }

  return tokens;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function HeroTerminal({ stack = FALLBACK_STACK }: HeroTerminalProps) {
  const renderedJson = useMemo(() => {
    const json = JSON.stringify({ ...DEVELOPER_PROFILE, stack }, null, 2);
    let offset = 0;

    return tokeniseJson(json).map((tok) => {
      const key = offset;
      offset += tok.text.length;

      if (tok.kind !== 'str') {
        return (
          <span key={key} style={{ color: C[tok.kind] }}>
            {tok.text}
          </span>
        );
      }

      const rawValue = tok.text.slice(1, -1);
      const href = CLICKABLE_VALUE_TO_HREF[rawValue];

      if (!href) {
        return (
          <span key={key} style={{ color: C[tok.kind] }}>
            {tok.text}
          </span>
        );
      }

      return (
        <span key={key}>
          <span style={{ color: C.str }}>{'"'}</span>
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
            style={{ color: C.str }}
          >
            {rawValue}
          </a>
          <span style={{ color: C.str }}>{'"'}</span>
        </span>
      );
    });
  }, [stack]);

  return (
    <div className="relative w-full max-w-xl mx-auto">
      {/* Magic UI Terminal — sequences children automatically */}
      <Terminal className="max-h-none max-w-full w-full bg-zinc-900/90 border-zinc-800 shadow-2xl shadow-zinc-950/80">
        {/* 1. curl command — types out char by char */}
        <TypingAnimation duration={28} as="div" className="font-mono text-sm text-zinc-300">
          {`$ curl -X GET ${env.NEXT_PUBLIC_API_URL}/developer/profile`}
        </TypingAnimation>

        {/* 2. Status label */}
        <AnimatedSpan className="font-mono text-xs text-zinc-500 mt-1 mb-0.5">
          {'// 200 OK'}
        </AnimatedSpan>

        {/* 3. JSON block — whiteSpace:pre preserves indentation; inline colours
              on every <span> are immune to Tailwind classes and CSS cascade. */}
        <AnimatedSpan className="font-mono text-xs leading-relaxed">
          <code
            style={{
              whiteSpace: 'pre',
              display: 'block',
              background: 'none',
              fontSize: 'inherit',
              fontFamily: 'inherit',
            }}
          >
            {renderedJson}
          </code>
        </AnimatedSpan>
      </Terminal>

      {/* Ambient glow behind the card */}
      <div className="absolute -z-10 -inset-8 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
    </div>
  );
}
