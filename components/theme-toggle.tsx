'use client';

import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
	const { theme, setTheme, resolvedTheme } = useTheme();
	const [mounted, setMounted] = useState(false);
	const [isAnimating, setIsAnimating] = useState(false);

	// Evita problemas de hidratação
	useEffect(() => {
		setMounted(true);
	}, []);

	const toggleTheme = () => {
		if (isAnimating || !mounted) return;

		setIsAnimating(true);

		// Determine the next theme in the cycle: dark -> light -> system -> dark
		let newTheme = 'dark';
		if (theme === 'dark') {
			newTheme = 'light';
		} else if (theme === 'light') {
			newTheme = 'system';
		}

		setTheme(newTheme);

		// Reset animation state after a short delay
		setTimeout(() => {
			setIsAnimating(false);
		}, 300);
	};

	// Render a placeholder with proper dimensions during SSR to prevent layout shift
	if (!mounted) {
		return (
			<Button
				variant="ghost"
				size="icon"
				aria-label="Toggle theme"
				className="opacity-0"
			>
				<div className="h-5 w-5" />
				<span className="sr-only">Toggle theme</span>
			</Button>
		);
	}

	// Determine which icon to show based on the current theme
	const getIcon = () => {
		if (theme === 'system') {
			return <Monitor className="h-5 w-5" />;
		} else if (theme === 'dark' || resolvedTheme === 'dark') {
			return <Sun className="h-5 w-5" />;
		} else {
			return <Moon className="h-5 w-5" />;
		}
	};

	return (
		<Button
			variant="ghost"
			size="icon"
			onClick={toggleTheme}
			aria-label={`Current theme: ${theme}. Click to toggle theme.`}
			disabled={isAnimating}
			className="hover:bg-white/20 transition-all duration-200"
		>
			{getIcon()}
			<span className="sr-only">
				{theme === 'system'
					? 'Using system theme preference'
					: theme === 'dark'
						? 'Switch to light theme'
						: 'Switch to dark theme'}
			</span>
		</Button>
	);
}
