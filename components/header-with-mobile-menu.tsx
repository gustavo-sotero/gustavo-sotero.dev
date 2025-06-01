'use client';

import { useLanguage } from '@/components/language-provider';
import { LanguageSelector } from '@/components/language-selector';
import MobileMenu from '@/components/mobile-menu';
import { ResumeButton } from '@/components/resume-button';
import { ThemeSelector } from '@/components/theme-selector';
import { useActiveSection } from '@/hooks/use-active-section';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Menu } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Header() {
	const { t } = useLanguage();
	const pathname = usePathname();
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const [isScrolled, setIsScrolled] = useState(false);
	const [windowWidth, setWindowWidth] = useState(0);
	const [isMobile, setIsMobile] = useState(false);

	// Verificar se está em uma página de blog
	const isOnHomePage = pathname === '/';

	const navItems = [
		{ href: '#about', label: t('nav.about') },
		{ href: '#projects', label: t('nav.projects') },
		{ href: '#skills', label: t('nav.skills') },
		{ href: '#experience', label: t('nav.experience') },
		{ href: '#education', label: t('nav.education') },
		{ href: '#blog', label: t('nav.blog') },
		{ href: '#contact', label: t('nav.contact') }
	];

	// Use o hook para rastrear a seção ativa apenas na página inicial
	const activeSection = useActiveSection(
		isOnHomePage ? navItems.map((item) => item.href.replace('#', '')) : []
	);

	// Detectar quando a página é rolada
	useEffect(() => {
		const handleScroll = () => {
			setIsScrolled(window.scrollY > 10);
		};

		window.addEventListener('scroll', handleScroll);
		return () => window.removeEventListener('scroll', handleScroll);
	}, []);

	// Track window width for responsive adjustments and set mobile state
	useEffect(() => {
		const handleResize = () => {
			const width = window.innerWidth;
			setWindowWidth(width);
			setIsMobile(width < 880);
		};

		// Set initial width and mobile state
		handleResize();

		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	}, []);

	// Fechar o menu quando a tela for redimensionada para desktop
	useEffect(() => {
		const handleResize = () => {
			if (window.innerWidth >= 880 && isMenuOpen) {
				setIsMenuOpen(false);
			}
		};

		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	}, [isMenuOpen]);

	// Função para rolar para o topo da página ou navegar para home
	const handleLogoClick = () => {
		if (isOnHomePage) {
			// Se está na página inicial, rola para o topo
			window.scrollTo({ top: 0, behavior: 'smooth' });
		}
		// Se não está na página inicial, o Link do Next.js cuidará da navegação
	};

	// Função para lidar com cliques nos itens de navegação
	const handleNavClick = (href: string) => {
		if (isOnHomePage) {
			// Se está na página inicial, rola para a seção
			const element = document.querySelector(href);
			if (element) {
				element.scrollIntoView({ behavior: 'smooth' });
			}
		}
		// Se não está na página inicial, o Link do Next.js navegará para home + hash
	};

	// Determine if we should use compact mode based on screen width
	const useCompactMode = windowWidth > 0 && windowWidth < 1200;

	// Componente do logo que muda baseado na página atual
	const LogoComponent = () => {
		if (isOnHomePage) {
			return (
				<button
					onClick={handleLogoClick}
					className="text-xl font-bold bg-transparent border-none cursor-pointer hover:text-primary transition-colors"
				>
					Gustavo Sotero
				</button>
			);
		} else {
			return (
				<Link
					href="/"
					className="text-xl font-bold hover:text-primary transition-colors"
				>
					Gustavo Sotero
				</Link>
			);
		}
	};

	return (
		<>
			<header
				className={cn(
					'fixed top-0 z-40 w-full transition-all duration-300',
					isScrolled
						? 'bg-background/90 backdrop-blur-md shadow-sm'
						: 'bg-background/50 backdrop-blur-sm'
				)}
			>
				<div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
					<LogoComponent />

					{/* Mobile menu button - visible below 870px */}
					{isMobile && (
						<motion.button
							className="z-50"
							onClick={() => setIsMenuOpen(true)}
							aria-label="Open menu"
							whileHover={{ scale: 1.1 }}
							whileTap={{ scale: 0.9 }}
						>
							<Menu size={24} />
						</motion.button>
					)}

					{/* Desktop navigation - visible at 870px and above */}
					{!isMobile && (
						<nav className="flex items-center gap-1 xl:gap-4">
							{navItems.map((item) => {
								const isActive =
									isOnHomePage && activeSection === item.href.replace('#', '');

								return (
									<Link
										key={item.href}
										href={isOnHomePage ? item.href : `/${item.href}`}
										className={cn(
											'text-sm font-medium transition-colors relative py-1 px-1 xl:px-2',
											isActive ? 'text-primary' : 'hover:text-primary'
										)}
										onClick={(e) => {
											if (isOnHomePage) {
												e.preventDefault();
												handleNavClick(item.href);
											}
										}}
									>
										{item.label}
										{isActive && (
											<motion.div
												className="absolute bottom-0 left-0 h-0.5 w-full bg-primary"
												layoutId="activeSection"
												transition={{
													type: 'spring',
													stiffness: 380,
													damping: 30
												}}
											/>
										)}
									</Link>
								);
							})}
							<div className="flex items-center gap-1 ml-1">
								<ResumeButton size="sm" compact={useCompactMode} />
								<LanguageSelector variant="ghost" compact={useCompactMode} />
								<ThemeSelector variant="ghost" compact={useCompactMode} />
							</div>
						</nav>
					)}
				</div>
			</header>

			{/* Mobile Menu Component */}
			<MobileMenu
				isOpen={isMenuOpen}
				onClose={() => setIsMenuOpen(false)}
				activeSection={activeSection}
				navItems={navItems}
				isOnHomePage={isOnHomePage}
			/>
		</>
	);
}
