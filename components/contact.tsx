"use client"

import { useLanguage } from "@/components/language-provider"
import { motion } from "framer-motion"
import { useInView } from "framer-motion"
import { useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Github, Linkedin, Send } from "lucide-react"
import Link from "next/link"

export default function Contact() {
  const { t } = useLanguage()
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, amount: 0.1 })

  const socialLinks = [
    {
      name: "GitHub",
      icon: <Github size={24} />,
      url: "https://github.com/gustavosotero",
      color: "hover:text-[#333]",
    },
    {
      name: "LinkedIn",
      icon: <Linkedin size={24} />,
      url: "https://linkedin.com/in/gustavosotero",
      color: "hover:text-[#0077B5]",
    },
    {
      name: "Telegram",
      icon: <Send size={24} />,
      url: "https://t.me/gustavosotero",
      color: "hover:text-[#0088cc]",
    },
  ]

  return (
    <section id="contact" className="py-16 md:py-24" ref={ref}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl mb-8">{t("contact.title")}</h2>

        <Card>
          <CardContent className="p-6">
            <div className="text-center mb-6">
              <p className="text-lg mb-4">{t("contact.description")}</p>
            </div>

            <div className="flex justify-center space-x-6">
              {socialLinks.map((link, index) => (
                <Link
                  key={index}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`transition-colors duration-200 ${link.color} dark:hover:text-white`}
                >
                  <Button variant="ghost" size="icon" aria-label={link.name}>
                    {link.icon}
                  </Button>
                  <span className="sr-only">{link.name}</span>
                </Link>
              ))}
            </div>

            <div className="mt-8">
              <h3 className="text-lg font-semibold mb-4 text-center">{t("contact.orSendMessage")}</h3>
              <form className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="name" className="text-sm font-medium">
                      {t("contact.form.name")}
                    </label>
                    <input
                      id="name"
                      type="text"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      placeholder={t("contact.form.namePlaceholder")}
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="email" className="text-sm font-medium">
                      {t("contact.form.email")}
                    </label>
                    <input
                      id="email"
                      type="email"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      placeholder={t("contact.form.emailPlaceholder")}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label htmlFor="message" className="text-sm font-medium">
                    {t("contact.form.message")}
                  </label>
                  <textarea
                    id="message"
                    rows={4}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    placeholder={t("contact.form.messagePlaceholder")}
                  ></textarea>
                </div>
                <Button type="submit" className="w-full">
                  {t("contact.form.send")}
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </section>
  )
}
