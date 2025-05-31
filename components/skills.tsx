"use client"

import { useLanguage } from "@/components/language-provider"
import { motion } from "framer-motion"
import { useInView } from "framer-motion"
import { useRef } from "react"
import { Badge } from "@/components/ui/badge"

export default function Skills() {
  const { t } = useLanguage()
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, amount: 0.1 })

  const skillCategories = [
    {
      name: t("skills.backEnd.title"),
      skills: [
        "Node.js",
        "Express",
        "NestJS",
        "TypeScript",
        "Python",
        "Django",
        "Flask",
        "Java",
        "Spring Boot",
        "C#",
        ".NET Core",
        "GraphQL",
        "REST API",
      ],
    },
    {
      name: t("skills.frontEnd.title"),
      skills: [
        "React",
        "Next.js",
        "Vue.js",
        "Angular",
        "JavaScript",
        "TypeScript",
        "HTML",
        "CSS",
        "Tailwind CSS",
        "SASS",
        "Redux",
        "Zustand",
      ],
    },
    {
      name: t("skills.devOps.title"),
      skills: [
        "Docker",
        "Kubernetes",
        "AWS",
        "Azure",
        "GCP",
        "CI/CD",
        "GitHub Actions",
        "Jenkins",
        "Terraform",
        "Linux",
        "Nginx",
        "Apache",
      ],
    },
    {
      name: t("skills.databases.title"),
      skills: [
        "PostgreSQL",
        "MySQL",
        "MongoDB",
        "Redis",
        "Elasticsearch",
        "DynamoDB",
        "SQLite",
        "Firebase",
        "Supabase",
        "SQL",
        "NoSQL",
      ],
    },
  ]

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  }

  const item = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  }

  return (
    <section id="skills" className="py-16 md:py-24" ref={ref}>
      <h2 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl mb-8">{t("skills.title")}</h2>

      <div className="space-y-8">
        {skillCategories.map((category, index) => (
          <div key={index}>
            <h3 className="text-xl font-semibold mb-4">{category.name}</h3>
            <motion.div
              variants={container}
              initial="hidden"
              animate={isInView ? "show" : "hidden"}
              className="flex flex-wrap gap-2"
            >
              {category.skills.map((skill, skillIndex) => (
                <motion.div key={skillIndex} variants={item}>
                  <Badge variant="secondary" className="text-sm py-1 px-3">
                    {skill}
                  </Badge>
                </motion.div>
              ))}
            </motion.div>
          </div>
        ))}
      </div>
    </section>
  )
}
