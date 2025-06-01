'use client';

import { useState, useEffect } from 'react';

export function useActiveSection(sections: string[], threshold = 0.3) {
	const [activeSection, setActiveSection] = useState<string | null>(null);

	useEffect(() => {
		const observers: IntersectionObserver[] = [];
		const sectionElements = new Map<string, Element>();

		// Função para verificar se está na hero section (topo da página)
		const checkIfAtTop = () => {
			// Considera-se no topo se o scroll for menor que 200px
			if (window.scrollY < 200) {
				setActiveSection(null);
				return true;
			}
			return false;
		};

		// Função para verificar se está no final da página
		const checkIfAtBottom = () => {
			const scrollHeight = document.documentElement.scrollHeight;
			const scrollTop =
				document.documentElement.scrollTop || document.body.scrollTop;
			const clientHeight = document.documentElement.clientHeight;

			// Se está a menos de 100px do final da página, considera a última seção como ativa
			return scrollHeight - scrollTop - clientHeight < 100;
		};

		// Função para encontrar a seção mais próxima do topo
		const findClosestSection = () => {
			if (checkIfAtTop()) return;

			// Se está no final da página, ativa a última seção
			if (checkIfAtBottom()) {
				const lastSection = sections[sections.length - 1];
				if (lastSection && lastSection !== activeSection) {
					setActiveSection(lastSection);
				}
				return;
			}

			let closestSection = null;
			let closestDistance = Number.POSITIVE_INFINITY;

			sections.forEach((sectionId) => {
				const element = document.getElementById(sectionId);
				if (!element) return;

				const rect = element.getBoundingClientRect();
				const elementTop = rect.top + window.scrollY;
				const elementBottom = elementTop + rect.height;
				const scrollPosition = window.scrollY + 120; // Offset para considerar o header

				// Verifica se a seção está visível na viewport
				if (scrollPosition >= elementTop && scrollPosition <= elementBottom) {
					const distanceFromTop = Math.abs(rect.top);

					// Se esta seção está mais próxima do topo, ela se torna a ativa
					if (distanceFromTop < closestDistance) {
						closestDistance = distanceFromTop;
						closestSection = sectionId;
					}
				}
			});

			// Se nenhuma seção foi encontrada usando o método acima,
			// encontra a seção que está mais próxima do centro da viewport
			if (!closestSection) {
				const viewportCenter = window.innerHeight / 2;

				sections.forEach((sectionId) => {
					const element = document.getElementById(sectionId);
					if (!element) return;

					const rect = element.getBoundingClientRect();

					// Verifica se a seção está pelo menos parcialmente visível
					if (rect.bottom > 0 && rect.top < window.innerHeight) {
						const sectionCenter = rect.top + rect.height / 2;
						const distanceFromCenter = Math.abs(sectionCenter - viewportCenter);

						if (distanceFromCenter < closestDistance) {
							closestDistance = distanceFromCenter;
							closestSection = sectionId;
						}
					}
				});
			}

			// Tratamento especial para a última seção (contato)
			if (!closestSection) {
				const lastSection = sections[sections.length - 1];
				const lastElement = document.getElementById(lastSection);

				if (lastElement) {
					const rect = lastElement.getBoundingClientRect();
					// Se a última seção está visível e não há outra seção ativa
					if (rect.top < window.innerHeight && rect.bottom > 0) {
						closestSection = lastSection;
					}
				}
			}

			if (closestSection && closestSection !== activeSection) {
				setActiveSection(closestSection);
			}
		};

		// Função para criar um observer para cada seção
		const createObserver = (sectionId: string) => {
			const element = document.getElementById(sectionId);
			if (!element) return;

			sectionElements.set(sectionId, element);

			const observer = new IntersectionObserver(
				(entries) => {
					entries.forEach((entry) => {
						if (entry.isIntersecting) {
							// Quando uma seção entra na viewport, recalcula qual deve ser ativa
							setTimeout(findClosestSection, 50);
						}
					});
				},
				{
					rootMargin: '-80px 0px -10% 0px', // Reduzindo a margem inferior para melhor detecção da última seção
					threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] // Múltiplos thresholds para melhor detecção
				}
			);

			observer.observe(element);
			observers.push(observer);
		};

		// Criar observers para todas as seções
		sections.forEach(createObserver);

		// Adicionar listener para o evento de scroll com throttling
		let scrollTimeout: NodeJS.Timeout;
		const handleScroll = () => {
			clearTimeout(scrollTimeout);
			scrollTimeout = setTimeout(findClosestSection, 10);
		};

		window.addEventListener('scroll', handleScroll, { passive: true });

		// Verificar inicialmente
		setTimeout(findClosestSection, 100);

		// Limpar observers e event listeners quando o componente for desmontado
		return () => {
			observers.forEach((observer) => observer.disconnect());
			window.removeEventListener('scroll', handleScroll);
			clearTimeout(scrollTimeout);
		};
	}, [sections, threshold, activeSection]);

	return activeSection;
}
