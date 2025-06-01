'use client';

import { useLanguage } from '@/components/language-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle
} from '@/components/ui/card';
import { projectsData } from '@/data/projects-data'; // Importar dados
import { motion, useInView } from 'framer-motion';
import { ChevronDown, ChevronUp, ExternalLink, Github } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState } from 'react';

export default function Projects() {
	const { t, language } = useLanguage(); // Adicionar language
	const ref = useRef(null);
	const isInView = useInView(ref, { once: true, amount: 0.1 });
	const [showAll, setShowAll] = useState(false);

	// Usar projectsData e acessar a tradução correta
	const projects = projectsData.map((p) => ({
		...p,
		...p.translations[language]
	}));

	const displayedProjects = showAll ? projects : projects.slice(0, 3);

	const container = {
		hidden: { opacity: 0 },
		show: {
			opacity: 1,
			transition: {
				staggerChildren: 0.1
			}
		}
	};

	const item = {
		hidden: { opacity: 0, y: 20 },
		show: { opacity: 1, y: 0, transition: { duration: 0.5 } }
	};

	return (
		<section id="projects" className="py-16 md:py-24" ref={ref}>
			<h2 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl mb-8">
				{t('projects.title')}
			</h2>

			<motion.div
				variants={container}
				initial="hidden"
				animate={isInView ? 'show' : 'hidden'}
				className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
			>
				{displayedProjects.map((project, index) => (
					<motion.div key={index} variants={item}>
						<Card className="h-full flex flex-col">
							<CardHeader>
								<CardTitle>{project.title}</CardTitle>
							</CardHeader>
							<CardContent className="flex-grow">
								<p className="mb-4">{project.description}</p>
								<CardDescription className="text-primary mb-4">
									{project.impact}
								</CardDescription>

								<div className="flex flex-wrap gap-2 mt-4">
									{project.technologies.map((tech, index) => (
										<Badge key={index} variant="secondary" className="text-xs">
											{tech}
										</Badge>
									))}
								</div>
							</CardContent>
							<CardFooter className="flex gap-2">
								{project.githubUrl && (
									<Link
										href={project.githubUrl}
										target="_blank"
										rel="noopener noreferrer"
									>
										<Button variant="outline" size="sm" className="gap-1">
											<Github size={16} />
											{t('projects.viewRepo')}
										</Button>
									</Link>
								)}
								{project.liveUrl && (
									<Link
										href={project.liveUrl}
										target="_blank"
										rel="noopener noreferrer"
									>
										<Button variant="default" size="sm" className="gap-1">
											<ExternalLink size={16} />
											{t('projects.viewProject')}
										</Button>
									</Link>
								)}
							</CardFooter>
						</Card>
					</motion.div>
				))}
			</motion.div>
			{projects.length > 3 && (
				<div className="mt-8 flex justify-center">
					<Button
						variant="outline"
						onClick={() => setShowAll(!showAll)}
						className="gap-1"
					>
						{showAll ? (
							<>
								<ChevronUp size={16} />
								{t('projects.showLess')}
							</>
						) : (
							<>
								<ChevronDown size={16} />
								{t('projects.seeMore')}
							</>
						)}
					</Button>
				</div>
			)}
		</section>
	);
}
