'use client';

import { useState, useRef, useEffect } from 'react';
import { useLanguage } from '@/components/language-provider';
import { Button } from '@/components/ui/button';
import { Check, ChevronDown, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Language {
	code: 'en' | 'pt-BR';
	name: string;
	flag: string;
	nativeName: string;
}

const languages: Language[] = [
	{
		code: 'en',
		name: 'English',
		flag: '🇺🇸',
		nativeName: 'English'
	},
	{
		code: 'pt-BR',
		name: 'Portuguese (Brazil)',
		flag: '🇧🇷',
		nativeName: 'Português'
	}
];

interface LanguageSelectorProps {
	variant?: 'default' | 'ghost' | 'outline';
	mobile?: boolean;
	showFullText?: boolean;
	compact?: boolean;
}

export function LanguageSelector({
	variant = 'default',
	mobile = false,
	showFullText = false,
	compact = false
}: LanguageSelectorProps) {
	const { language, setLanguage } = useLanguage();
	const [isOpen, setIsOpen] = useState(false);
	const dropdownRef = useRef<HTMLDivElement>(null);

	const currentLanguage =
		languages.find((lang) => lang.code === language) || languages[0];

	// Fechar o dropdown quando clicar fora dele
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

	const handleLanguageChange = (langCode: 'en' | 'pt-BR') => {
		setLanguage(langCode);
		setIsOpen(false);
	};

	return (
		<div className="relative" ref={dropdownRef}>
			<Button
				variant={variant}
				size={mobile ? 'lg' : 'sm'}
				onClick={() => setIsOpen(!isOpen)}
				className={`gap-1 ${mobile ? 'text-lg w-full justify-between' : ''}`}
				aria-expanded={isOpen}
				aria-haspopup="listbox"
				aria-label="Select language"
			>
				<Globe
					className={`${mobile ? 'h-5 w-5' : 'h-4 w-4'} ${compact ? 'mr-0' : 'mr-1'}`}
				/>
				<span className="flex items-center">
					<span>{currentLanguage.flag}</span>
					{(!compact || showFullText) && (
						<span
							className={
								compact ? 'hidden lg:ml-1 lg:inline' : 'ml-1 hidden sm:inline'
							}
						>
							{currentLanguage.nativeName}
						</span>
					)}
				</span>
				<ChevronDown
					className={`${mobile ? 'h-5 w-5' : 'h-4 w-4'} transition-transform ${isOpen ? 'rotate-180' : ''}`}
				/>
			</Button>

			<AnimatePresence>
				{isOpen && (
					<motion.div
						initial={{ opacity: 0, y: -10 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -10 }}
						transition={{ duration: 0.15 }}
						className={`absolute ${mobile ? 'w-full' : 'right-0 min-w-[180px]'} mt-2 rounded-md border bg-background shadow-md z-50`}
						role="listbox"
					>
						<div className="py-1">
							{languages.map((lang) => (
								<button
									key={lang.code}
									className={`flex items-center w-full px-4 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground ${
										language === lang.code ? 'bg-accent/50' : ''
									}`}
									onClick={() => handleLanguageChange(lang.code)}
									role="option"
									aria-selected={language === lang.code}
								>
									<span className="mr-2">{lang.flag}</span>
									<span className="flex-grow">{lang.nativeName}</span>
									{language === lang.code && <Check className="h-4 w-4 ml-2" />}
								</button>
							))}
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
