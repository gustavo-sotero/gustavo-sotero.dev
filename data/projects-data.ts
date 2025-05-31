import type { Language } from "@/components/language-provider"

export interface Project {
  id: number
  githubUrl: string | null
  liveUrl: string | null
  translations: {
    [key in Language]: {
      title: string
      description: string
      impact: string
      technologies: string[]
    }
  }
}

export const projectsData: Project[] = [
  {
    id: 1,
    githubUrl: "https://github.com/gustavosotero/ecommerce-platform",
    liveUrl: "https://ecommerce-platform-demo.vercel.app",
    translations: {
      en: {
        title: "E-commerce Platform",
        description:
          "Developed a full-featured e-commerce platform with a microservices architecture using Node.js, Express, and MongoDB. Implemented secure payment processing, inventory management, and a responsive React frontend.",
        impact: "Increased sales by 35% and reduced page load time by 40%.",
        technologies: ["Node.js", "Express", "MongoDB", "React"],
      },
      "pt-BR": {
        title: "Plataforma de E-commerce",
        description:
          "Desenvolvi uma plataforma de e-commerce completa com arquitetura de microsserviços usando Node.js, Express e MongoDB. Implementei processamento seguro de pagamentos, gerenciamento de estoque e um frontend responsivo em React.",
        impact: "Aumentou as vendas em 35% e reduziu o tempo de carregamento da página em 40%.",
        technologies: ["Node.js", "Express", "MongoDB", "React"],
      },
    },
  },
  {
    id: 2,
    githubUrl: "https://github.com/gustavosotero/realtime-chat",
    liveUrl: "https://realtime-chat-demo.vercel.app",
    translations: {
      en: {
        title: "Real-time Chat Application",
        description:
          "Built a scalable real-time chat application using Socket.io, Node.js, and React. Features include private messaging, group chats, file sharing, and end-to-end encryption.",
        impact: "Supported 10,000+ concurrent users with minimal latency.",
        technologies: ["Socket.io", "Node.js", "React", "Redis"],
      },
      "pt-BR": {
        title: "Aplicativo de Chat em Tempo Real",
        description:
          "Construí um aplicativo de chat em tempo real escalável usando Socket.io, Node.js e React. Os recursos incluem mensagens privadas, chats em grupo, compartilhamento de arquivos e criptografia de ponta a ponta.",
        impact: "Suportou mais de 10.000 usuários simultâneos com latência mínima.",
        technologies: ["Socket.io", "Node.js", "React", "Redis"],
      },
    },
  },
  {
    id: 3,
    githubUrl: null,
    liveUrl: "https://cms-demo.vercel.app",
    translations: {
      en: {
        title: "Content Management System",
        description:
          "Created a custom CMS with a headless architecture using NestJS and GraphQL. Implemented role-based access control, content versioning, and a Next.js frontend with SSR.",
        impact: "Reduced content publishing time by 60% for a major media company.",
        technologies: ["NestJS", "GraphQL", "Next.js", "PostgreSQL"],
      },
      "pt-BR": {
        title: "Sistema de Gerenciamento de Conteúdo",
        description:
          "Criei um CMS personalizado com arquitetura headless usando NestJS e GraphQL. Implementei controle de acesso baseado em funções, versionamento de conteúdo e um frontend Next.js com SSR.",
        impact: "Reduziu o tempo de publicação de conteúdo em 60% para uma grande empresa de mídia.",
        technologies: ["NestJS", "GraphQL", "Next.js", "PostgreSQL"],
      },
    },
  },
  {
    id: 4,
    githubUrl: "https://github.com/gustavosotero/financial-dashboard",
    liveUrl: "https://financial-dashboard-demo.vercel.app",
    translations: {
      en: {
        title: "Financial Dashboard",
        description:
          "Developed a comprehensive financial dashboard for tracking investments, expenses, and financial goals. Used Django REST framework for the backend and Vue.js for the frontend.",
        impact: "Helped users manage over $5M in assets with detailed analytics.",
        technologies: ["Django", "REST API", "Vue.js", "Chart.js"],
      },
      "pt-BR": {
        title: "Painel Financeiro",
        description:
          "Desenvolvi um painel financeiro abrangente para rastrear investimentos, despesas e metas financeiras. Usei Django REST framework para o backend e Vue.js para o frontend.",
        impact: "Ajudou usuários a gerenciar mais de R$25M em ativos com análises detalhadas.",
        technologies: ["Django", "REST API", "Vue.js", "Chart.js"],
      },
    },
  },
  {
    id: 5,
    githubUrl: null,
    liveUrl: "https://healthcare-system-demo.vercel.app",
    translations: {
      en: {
        title: "Healthcare Management System",
        description:
          "Built a secure healthcare management system for patient records, appointment scheduling, and billing. Used Java Spring Boot, PostgreSQL, and Angular with strict HIPAA compliance.",
        impact: "Streamlined operations for a network of 5 clinics serving 20,000+ patients.",
        technologies: ["Java", "Spring Boot", "PostgreSQL", "Angular"],
      },
      "pt-BR": {
        title: "Sistema de Gestão de Saúde",
        description:
          "Construí um sistema seguro de gestão de saúde para registros de pacientes, agendamento de consultas e faturamento. Usei Java Spring Boot, PostgreSQL e Angular com estrita conformidade com normas de privacidade.",
        impact: "Otimizou operações para uma rede de 5 clínicas atendendo mais de 20.000 pacientes.",
        technologies: ["Java", "Spring Boot", "PostgreSQL", "Angular"],
      },
    },
  },
  {
    id: 6,
    githubUrl: "https://github.com/gustavosotero/devops-platform",
    liveUrl: null,
    translations: {
      en: {
        title: "DevOps Automation Platform",
        description:
          "Created a DevOps automation platform to streamline CI/CD pipelines, infrastructure provisioning, and monitoring. Used Python, Terraform, Docker, and Kubernetes.",
        impact: "Reduced deployment time by 75% and infrastructure costs by 30%.",
        technologies: ["Python", "Terraform", "Docker", "Kubernetes"],
      },
      "pt-BR": {
        title: "Plataforma de Automação DevOps",
        description:
          "Criei uma plataforma de automação DevOps para otimizar pipelines de CI/CD, provisionamento de infraestrutura e monitoramento. Usei Python, Terraform, Docker e Kubernetes.",
        impact: "Reduziu o tempo de implantação em 75% e os custos de infraestrutura em 30%.",
        technologies: ["Python", "Terraform", "Docker", "Kubernetes"],
      },
    },
  },
]
