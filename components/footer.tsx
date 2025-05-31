"use client"

import { useLanguage } from "@/components/language-provider"

export default function Footer() {
  const { t } = useLanguage()
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t py-6 md:py-8">
      <div className="container flex flex-col items-center justify-center gap-4 text-center md:gap-6">
        <p className="text-sm text-muted-foreground">
          &copy; {currentYear} Gustavo Sotero. {t("footer.rightsReserved")}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("footer.builtWith")} <span className="text-primary">Next.js</span> &{" "}
          <span className="text-primary">Tailwind CSS</span>
        </p>
      </div>
    </footer>
  )
}
