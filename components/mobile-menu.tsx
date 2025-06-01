'use client';

import { useLanguage } from '@/components/language-provider';
import { Button } from '@/components/ui/button';
import { AnimatePresence, motion } from 'framer-motion';
import {
	Check,
	ChevronDown,
	Download,
	Globe,
	Monitor,
	Moon,
	Sun,
	X
} from 'lucide-react';
import { useTheme } from 'next-themes';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface MobileMenuProps {
	isOpen: boolean;
	onClose: () => void;
	activeSection: string | null;
	navItems: { href: string; label: string }[];
	isOnHomePage: boolean;
}

export default function MobileMenu({
	isOpen,
	onClose,
	activeSection,
	navItems,
	isOnHomePage
}: MobileMenuProps) {
	const { t, language, setLanguage } = useLanguage();
	const { theme, setTheme } = useTheme();
	const [languageOpen, setLanguageOpen] = useState(false);
	const [themeOpen, setThemeOpen] = useState(false);
	const [mounted, setMounted] = useState(false);

	// Evitar problemas de hidratação
	useEffect(() => {
		setMounted(true);
	}, []);

	// Lock scroll when menu is open
	useEffect(() => {
		if (isOpen) {
			document.body.style.overflow = 'hidden';
		} else {
			document.body.style.overflow = '';
		}
		return () => {
			document.body.style.overflow = '';
		};
	}, [isOpen]);

	// Animation variants
	const menuVariants = {
		closed: {
			opacity: 0,
			x: '100%',
			transition: {
				type: 'tween',
				duration: 0.35,
				ease: [0.4, 0.0, 0.2, 1],
				when: 'afterChildren',
				staggerChildren: 0.05,
				staggerDirection: -1
			}
		},
		open: {
			opacity: 1,
			x: 0,
			transition: {
				type: 'tween',
				duration: 0.4,
				ease: [0.2, 0.0, 0.0, 1.0],
				when: 'beforeChildren',
				staggerChildren: 0.07,
				delayChildren: 0.1
			}
		}
	};

	const itemVariants = {
		closed: {
			opacity: 0,
			y: 20,
			transition: { duration: 0.2 }
		},
		open: {
			opacity: 1,
			y: 0,
			transition: { duration: 0.3 }
		}
	};

	const dropdownVariants = {
		hidden: { opacity: 0, height: 0 },
		visible: { opacity: 1, height: 'auto' }
	};

	// Opções de idioma
	const languages = [
		{ code: 'en', label: 'English', flag: '🇺🇸', shortLabel: 'US' },
		{ code: 'pt-BR', label: 'Português', flag: '🇧🇷', shortLabel: 'BR' }
	];

	// Opções de tema
	const themes = [
		{ value: 'light', icon: <Sun size={18} /> },
		{ value: 'dark', icon: <Moon size={18} /> },
		{ value: 'system', icon: <Monitor size={18} /> }
	];

	// Obter o tema atual
	const getCurrentTheme = () => {
		if (!mounted) return themes[0];
		const currentTheme = theme || 'system';
		return themes.find((t) => t.value === currentTheme) || themes[0];
	};

	// Obter o idioma atual
	const getCurrentLanguage = () => {
		return languages.find((lang) => lang.code === language) || languages[0];
	};

	const currentTheme = getCurrentTheme();
	const currentLanguage = getCurrentLanguage();

	// Função para lidar com cliques nos itens de navegação
	const handleNavClick = (href: string) => {
		onClose();

		if (isOnHomePage) {
			// Se está na página inicial, rola para a seção
			const element = document.querySelector(href);
			if (element) {
				element.scrollIntoView({ behavior: 'smooth' });
			}
		}
		// Se não está na página inicial, o Link do Next.js navegará para home + hash
	};

	// Função para lidar com o download do CV
	const handleDownload = () => {
		const resumeFiles = {
			en: '/resumes/cv-gustavo-sotero-en.pdf',
			'pt-BR': '/resumes/cv-gustavo-sotero.pdf'
		};

		const resumeFile = resumeFiles[language] || resumeFiles['en'];

		// Criar um link temporário para forçar o download
		const link = document.createElement('a');
		link.href = resumeFile;
		link.download = `gustavo-sotero-cv-${
			language === 'pt-BR' ? 'pt' : 'en'
		}.pdf`;
		link.target = '_blank';
		link.rel = 'noopener noreferrer';

		// Adicionar ao DOM, clicar e remover
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	};

	return (
		<AnimatePresence mode="wait">
			{isOpen && (
				<motion.div
					className="fixed inset-0 z-50 bg-background flex flex-col"
					initial="closed"
					animate="open"
					exit="closed"
					variants={menuVariants}
					style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
				>
					<div className="flex justify-between items-center p-4 border-b border-border">
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={{ delay: 0.2 }}
						>
							{isOnHomePage ? (
								<span className="text-xl font-bold text-foreground">
									Gustavo Sotero
								</span>
							) : (
								<Link
									href="/"
									className="text-xl font-bold text-foreground hover:text-primary transition-colors"
									onClick={onClose}
								>
									Gustavo Sotero
								</Link>
							)}
						</motion.div>
						<motion.button
							onClick={onClose}
							className="text-foreground"
							whileTap={{ scale: 0.9 }}
							whileHover={{ scale: 1.1 }}
							initial={{ opacity: 0, rotate: -90 }}
							animate={{ opacity: 1, rotate: 0 }}
							transition={{ delay: 0.2 }}
						>
							<X size={24} />
						</motion.button>
					</div>

					<div className="flex-1 overflow-auto p-4 flex flex-col items-center justify-center">
						<nav className="flex flex-col items-center space-y-8 w-full mb-10">
							{navItems.map((item, index) => {
								const isActive =
									isOnHomePage && activeSection === item.href.replace('#', '');

								return (
									<motion.div
										key={item.href}
										variants={itemVariants}
										custom={index}
										whileHover={{ scale: 1.05 }}
										whileTap={{ scale: 0.95 }}
									>
										<Link
											href={isOnHomePage ? item.href : `/${item.href}`}
											className={`text-2xl font-medium ${
												isActive ? 'text-primary' : 'text-foreground'
											}`}
											onClick={(e) => {
												if (isOnHomePage) {
													e.preventDefault();
													handleNavClick(item.href);
												} else {
													onClose();
												}
											}}
										>
											{item.label}
										</Link>
									</motion.div>
								);
							})}
						</nav>

						<div className="w-full max-w-xs space-y-4">
							{/* Download CV Button */}
							<motion.div variants={itemVariants} className="w-full">
								<Button
									variant="outline"
									className="w-full flex items-center justify-start gap-2 bg-background border-border text-foreground rounded-md h-12"
									onClick={handleDownload}
								>
									<Download size={18} className="shrink-0" />
									<span>{t('resume.download')}</span>
								</Button>
							</motion.div>

							{/* Language Selector */}
							<motion.div variants={itemVariants} className="w-full relative">
								<Button
									variant="outline"
									className="w-full flex items-center justify-between gap-2 bg-background border-border text-foreground rounded-md h-12"
									onClick={() => {
										setLanguageOpen(!languageOpen);
										setThemeOpen(false);
									}}
								>
									<div className="flex items-center gap-2">
										<Globe size={18} className="shrink-0" />
										<span>{currentLanguage.shortLabel}</span>
									</div>
									<ChevronDown
										size={18}
										className={`shrink-0 transition-transform ${
											languageOpen ? 'rotate-180' : ''
										}`}
									/>
								</Button>

								<AnimatePresence>
									{languageOpen && (
										<motion.div
											initial="hidden"
											animate="visible"
											exit="hidden"
											variants={dropdownVariants}
											className="absolute z-50 mt-1 w-full rounded-md border border-border bg-background shadow-lg"
										>
											<div className="py-1">
												{languages.map((lang) => (
													<button
														key={lang.code}
														className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground ${
															language === lang.code ? 'bg-accent/50' : ''
														}`}
														onClick={() => {
															setLanguage(lang.code as 'en' | 'pt-BR');
															setLanguageOpen(false);
														}}
													>
														<div className="flex items-center gap-2">
															<span>{lang.flag}</span>
															<span>{lang.label}</span>
														</div>
														{language === lang.code && <Check size={16} />}
													</button>
												))}
											</div>
										</motion.div>
									)}
								</AnimatePresence>
							</motion.div>

							{/* Theme Selector */}
							<motion.div
								variants={itemVariants}
								className="w-full relative"
								style={{
									marginTop: languageOpen ? '80px' : '16px',
									transition: 'margin-top 0.2s ease-in-out'
								}}
							>
								<Button
									variant="outline"
									className="w-full flex items-center justify-between gap-2 bg-background border-border text-foreground rounded-md h-12"
									onClick={() => {
										setThemeOpen(!themeOpen);
										setLanguageOpen(false);
									}}
								>
									<div className="flex items-center gap-2">
										{mounted && currentTheme.icon}
										{mounted && <span>{t(`theme.${currentTheme.value}`)}</span>}
									</div>
									<ChevronDown
										size={18}
										className={`shrink-0 transition-transform ${
											themeOpen ? 'rotate-180' : ''
										}`}
									/>
								</Button>

								<AnimatePresence>
									{themeOpen && (
										<motion.div
											initial="hidden"
											animate="visible"
											exit="hidden"
											variants={dropdownVariants}
											className="absolute z-50 mt-1 w-full rounded-md border border-border bg-background shadow-lg"
										>
											<div className="py-1">
												{themes.map((themeOption) => (
													<button
														key={themeOption.value}
														className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground ${
															theme === themeOption.value ? 'bg-accent/50' : ''
														}`}
														onClick={() => {
															setTheme(themeOption.value);
															setThemeOpen(false);
														}}
													>
														<div className="flex items-center gap-2">
															{themeOption.icon}
															<span>{t(`theme.${themeOption.value}`)}</span>
														</div>
														{theme === themeOption.value && <Check size={16} />}
													</button>
												))}
											</div>
										</motion.div>
									)}
								</AnimatePresence>
							</motion.div>
						</div>
					</div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}
