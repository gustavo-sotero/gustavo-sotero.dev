import type React from "react"
import Header from "@/components/header-with-mobile-menu"
import Footer from "@/components/footer"

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <div className="pt-16">
        <main>{children}</main>
        <Footer />
      </div>
    </div>
  )
}
