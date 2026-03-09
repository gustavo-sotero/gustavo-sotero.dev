'use client';

import { useEffect, useRef, useState } from 'react';

export interface TypewriterLine {
  text: string;
  speed?: number; // ms per character (default: 40)
  pause?: number; // ms pause AFTER this line before starting next (default: 0)
}

export interface UseTypewriterReturn {
  displayedText: string;
  currentLine: number;
  isDone: boolean;
}

export function useTypewriter(lines: TypewriterLine[]): UseTypewriterReturn {
  const [displayedText, setDisplayedText] = useState('');
  const [currentLine, setCurrentLine] = useState(0);
  const [isDone, setIsDone] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Respect prefers-reduced-motion — show all text immediately
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      const fullText = lines.map((l) => l.text).join('\n');
      setDisplayedText(fullText);
      setCurrentLine(lines.length - 1);
      setIsDone(true);
      return;
    }

    let lineIndex = 0;
    let charIndex = 0;
    let completedText = '';

    function typeNextChar() {
      if (lineIndex >= lines.length) {
        setIsDone(true);
        return;
      }

      const line = lines[lineIndex];
      const speed = line.speed ?? 40;

      if (charIndex < line.text.length) {
        charIndex++;
        const partial = line.text.slice(0, charIndex);
        setDisplayedText(completedText + partial);
        timeoutRef.current = setTimeout(typeNextChar, speed);
      } else {
        // Line complete — pause then move to next line
        completedText += line.text + (lineIndex < lines.length - 1 ? '\n' : '');
        lineIndex++;
        charIndex = 0;
        setCurrentLine(lineIndex);

        const pause = line.pause ?? 0;
        timeoutRef.current = setTimeout(typeNextChar, pause);
      }
    }

    // Short initial delay before starting
    timeoutRef.current = setTimeout(typeNextChar, 300);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [lines]);

  return { displayedText, currentLine, isDone };
}
