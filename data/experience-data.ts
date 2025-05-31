import type { Language } from "@/components/language-provider"

export interface ExperienceItem {
  id: number
  type: string // e.g., "work"
  translations: {
    [key in Language]: {
      title: string
      company: string
      period: string
      description: string
    }
  }
}

export const experiencesData: ExperienceItem[] = [
  {
    id: 1,
    type: "work",
    translations: {
      en: {
        title: "Senior Back-End Developer",
        company: "Tech Innovations Inc.",
        period: "2021 - Present",
        description:
          "Leading the development of scalable microservices architecture for enterprise applications. Mentoring junior developers and implementing best practices for code quality and performance.",
      },
      "pt-BR": {
        title: "Desenvolvedor Back-End Sênior",
        company: "Tech Innovations Inc.",
        period: "2021 - Presente",
        description:
          "Liderando o desenvolvimento de arquitetura de microsserviços escaláveis para aplicações empresariais. Mentorando desenvolvedores juniores e implementando melhores práticas para qualidade e desempenho de código.",
      },
    },
  },
  {
    id: 2,
    type: "work",
    translations: {
      en: {
        title: "Full-Stack Developer",
        company: "Digital Solutions Ltd.",
        period: "2018 - 2021",
        description:
          "Developed and maintained multiple web applications using Node.js, React, and MongoDB. Collaborated with cross-functional teams to deliver high-quality software solutions.",
      },
      "pt-BR": {
        title: "Desenvolvedor Full-Stack",
        company: "Digital Solutions Ltda.",
        period: "2018 - 2021",
        description:
          "Desenvolvi e mantive múltiplas aplicações web usando Node.js, React e MongoDB. Colaborei com equipes multifuncionais para entregar soluções de software de alta qualidade.",
      },
    },
  },
  {
    id: 3,
    type: "work",
    translations: {
      en: {
        title: "Junior Developer",
        company: "WebTech Startup",
        period: "2016 - 2018",
        description:
          "Assisted in the development of web applications using JavaScript, HTML, and CSS. Participated in code reviews and implemented responsive designs.",
      },
      "pt-BR": {
        title: "Desenvolvedor Júnior",
        company: "WebTech Startup",
        period: "2016 - 2018",
        description:
          "Auxiliei no desenvolvimento de aplicações web usando JavaScript, HTML e CSS. Participei de revisões de código e implementei designs responsivos.",
      },
    },
  },
]
