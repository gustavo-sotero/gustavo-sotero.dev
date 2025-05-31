'use client';

import { useLanguage } from '@/components/language-provider';
import { Button } from '@/components/ui/button';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import type { JSX } from 'react';
import { useEffect, useRef, useState } from 'react';

interface ThemeOption {
  value: string;
  icon: JSX.Element;
}

interface ThemeSelectorProps {
  variant?: 'default' | 'ghost' | 'outline';
  compact?: boolean;
}

export function ThemeSelector({
  variant = 'ghost',
  compact = false
}: ThemeSelectorProps) {
  const { theme, setTheme } = useTheme();
  const { t } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const themeOptions: ThemeOption[] = [
    {
      value: 'light',
      icon: <Sun className="h-4 w-4" />
    },
    {
      value: 'dark',
      icon: <Moon className="h-4 w-4" />
    },
    {
      value: 'system',
      icon: <Monitor className="h-4 w-4" />
    }
  ];

  // Determine current theme for display
  const getCurrentTheme = (): ThemeOption => {
    if (!mounted) return themeOptions[0];

    const currentTheme = theme || 'system';
    return (
      themeOptions.find((option) => option.value === currentTheme) ||
      themeOptions[0]
    );
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleThemeChange = (themeValue: string) => {
    setTheme(themeValue);
    setIsOpen(false);
  };

  // Render placeholder during SSR
  if (!mounted) {
    return (
      <Button
        variant={variant}
        size="sm"
        className="gap-1 opacity-0"
        aria-label="Select theme"
      >
        <div className="h-4 w-4" />
        <span>Theme</span>
        <ChevronDown className="h-4 w-4" />
      </Button>
    );
  }

  const currentTheme = getCurrentTheme();

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant={variant}
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="gap-1"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label="Select theme"
      >
        {currentTheme.icon}
        {!compact && (
          <span className="hidden sm:inline">
            {t(`theme.${currentTheme.value}`)}
          </span>
        )}
        <ChevronDown
          className={`h-4 w-4 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 min-w-[180px] rounded-md border bg-background shadow-md z-50"
            role="listbox"
          >
            <div className="py-1">
              {themeOptions.map((option) => (
                <button
                  key={option.value}
                  className={`flex items-center w-full px-4 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground ${
                    theme === option.value ? 'bg-accent/50' : ''
                  }`}
                  onClick={() => handleThemeChange(option.value)}
                  role="option"
                  aria-selected={theme === option.value}
                >
                  <span className="mr-2">{option.icon}</span>
                  <span className="flex-grow">
                    {t(`theme.${option.value}`)}
                  </span>
                  {theme === option.value && <Check className="h-4 w-4 ml-2" />}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
