import Header from "@/components/header-with-mobile-menu"
import Hero from "@/components/hero"
import About from "@/components/about"
import Projects from "@/components/projects"
import Skills from "@/components/skills"
import Experience from "@/components/experience"
import Education from "@/components/education"
import Blog from "@/components/blog"
import Contact from "@/components/contact"
import Footer from "@/components/footer"

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <div className="pt-16">
        {" "}
        {/* Espaço para o cabeçalho fixo */}
        <main className="container mx-auto px-4 sm:px-6 lg:px-8">
          <Hero />
          <About />
          <Projects />
          <Skills />
          <Experience />
          <Education />
          <Blog />
          <Contact />
        </main>
        <Footer />
      </div>
    </div>
  )
}
