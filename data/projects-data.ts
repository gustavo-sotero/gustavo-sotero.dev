import type { Language } from '@/components/language-provider';

export interface Project {
	id: number;
	githubUrl: string | null;
	liveUrl: string | null;
	translations: {
		[key in Language]: {
			title: string;
			description: string;
			impact: string;
			technologies: string[];
		};
	};
}

export const projectsData: Project[] = [
	{
		id: 1,
		githubUrl: null,
		liveUrl: 'https://t.me/NotzSMSBot',
		translations: {
			en: {
				title: 'Notz - SMS | Bot for Telegram',
				description:
					'Developed a Telegram bot that allows users to generate temporary phone numbers to receive SMS, ideal for account verification and online services.',
				impact: 'The bot currently has over 25,000 active users monthly.',
				technologies: [
					'Node.js',
					'MongoDB',
					'React',
					'TypeScript',
					'Docker',
					'Git',
					'PHP',
					'PostgreSQL'
				]
			},
			'pt-BR': {
				title: 'Notz - SMS | Bot para Telegram',
				description:
					'Desenvolvi um bot para Telegram que permite gerar números de telefone temporários para receber SMS, ideal para verificação de contas e serviços online.',
				impact:
					'O bot conta atualmente com mais de 25.000 usuários ativos mensalmente.',
				technologies: [
					'Node.js',
					'MongoDB',
					'React',
					'TypeScript',
					'Docker',
					'Git',
					'PHP',
					'PostgreSQL'
				]
			}
		}
	},
	{
		id: 2,
		githubUrl: 'https://github.com/gustavo-sotero/anonshare',
		liveUrl: 'https://anonshare.dev',
		translations: {
			en: {
				title: 'AnonShare - Anonymous File Sharing',
				description:
					'Developed an anonymous file sharing platform that allows users to upload and download files without registration, ensuring privacy and security.',
				impact:
					'Platform is receiving around 15,000 monthly visits and over 1,000 unique visits per month.',
				technologies: [
					'Next.js',
					'Node.js',
					'TypeScript',
					'Docker',
					'PostgreSQL',
					'Prisma',
					'Docker',
					'GitHub Actions',
					'Git',
					'Cloudflare R2'
				]
			},
			'pt-BR': {
				title: 'AnonShare - Compartilhamento de Arquivos Anônimos',
				description:
					'Desenvolvi uma plataforma de compartilhamento de arquivos anônimos que permite aos usuários fazer upload e download de arquivos sem necessidade de registro, garantindo privacidade e segurança.',
				impact:
					'Plataforma está recebendo cerca de 15.000 acessos mensais e mais de 1.000 acessos únicos por mês.',
				technologies: [
					'Next.js',
					'Node.js',
					'TypeScript',
					'Docker',
					'PostgreSQL',
					'Prisma',
					'Docker',
					'GitHub Actions',
					'Git',
					'Cloudflare R2'
				]
			}
		}
	}
];
