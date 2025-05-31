import type { Language } from "@/components/language-provider"

export interface EducationItem {
  id: number
  translations: {
    [key in Language]: {
      title: string
      institution: string
      period: string
      description: string
    }
  }
}

export const educationData: EducationItem[] = [
  {
    id: 1,
    translations: {
      en: {
        title: "Master's in Computer Science",
        institution: "Tech University",
        period: "2014 - 2016",
        description:
          "Specialized in Distributed Systems and Cloud Computing. Thesis on scalable microservices architecture.",
      },
      "pt-BR": {
        title: "Mestrado em Ciência da Computação",
        institution: "Universidade Tech",
        period: "2014 - 2016",
        description:
          "Especializado em Sistemas Distribuídos e Computação em Nuvem. Tese sobre arquitetura escalável de microsserviços.",
      },
    },
  },
  {
    id: 2,
    translations: {
      en: {
        title: "Bachelor's in Software Engineering",
        institution: "State University",
        period: "2010 - 2014",
        description: "Graduated with honors. Focused on software development methodologies and database systems.",
      },
      "pt-BR": {
        title: "Bacharelado em Engenharia de Software",
        institution: "Universidade Estadual",
        period: "2010 - 2014",
        description:
          "Graduado com honras. Foco em metodologias de desenvolvimento de software e sistemas de banco de dados.",
      },
    },
  },
]
