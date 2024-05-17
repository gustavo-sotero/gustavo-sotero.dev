import { Button } from '@/components/ui/button';
import Image from 'next/image';
import Link from 'next/link';
import { JSX, SVGProps } from 'react';

export default function Home() {
  return (
    <div key="1" className="flex flex-col min-h-screen">
      <header className="bg-[#000000] h-screen flex items-center justify-center text-center text-white">
        <div className="space-y-6">
          <h1 className="text-4xl font-bold">
            Portfólio <br />
            Gustavo Sotero
          </h1>
          <p className="text-xl">
            Desenvolvedor FullStack com experiência em tecnologias web modernas
          </p>
          <div className="flex justify-center gap-4 mt-4">
            <Link
              className="text-white transition ease-in-out hover:-translate-y-1 hover:scale-110 hover:text-slate-500 duration-300"
              href="https://github.com/gustavo-sotero"
              target="_blank"
            >
              <GithubIcon className="h-6 w-6" />
            </Link>
            <Link
              className="text-white transition ease-in-out hover:-translate-y-1 hover:scale-110 hover:text-blue-500 duration-300"
              href="https://linkedin.com/in/gustavo-sotero"
              target="_blank"
            >
              <LinkedInIcon className="h-6 w-6" />
            </Link>
            <Link
              className="text-white transition ease-in-out hover:-translate-y-1 hover:scale-110 hover:text-red-500 duration-300"
              href="mailto:contato@gustavo-sotero.dev"
              target="_blank"
            >
              <MailIcon className="h-6 w-6" />
            </Link>

            <Link
              href="/curriculo.pdf"
              className="text-white transition ease-in-out hover:-translate-y-1 hover:scale-110 hover:text-emerald-500 duration-300"
              target="_blank"
            >
              <FileIcon className="h-6 w-6" />
            </Link>
          </div>
        </div>
        <Link className="absolute bottom-0 mb-8" href="#main">
          <ArrowDownIcon className="h-6 w-6 animate-bounce" />
        </Link>
      </header>
      <main className="flex-1" id="main">
        <section className="py-12 px-4 md:px-6">
          <h2 className="text-3xl font-bold text-center">Skills</h2>
          <div className="grid gap-6 mt-8 md:grid-cols-3">
            <div className="flex flex-col items-center text-center">
              <CodeIcon className="h-12 w-12 text-gray-900" />
              <h3 className="mt-2 text-lg font-medium">
                Desenvolvimento FrontEnd
              </h3>
              <p className="mt-2 text-gray-500">
                Experiencia com HTML, CSS, JavaScript, React e Next.JS
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <ServerIcon className="h-12 w-12 text-gray-900" />
              <h3 className="mt-2 text-lg font-medium">
                Desenvolvimento BackEnd
              </h3>
              <p className="mt-2 text-gray-500">
                Proficiente em Node.js, Express and Prisma.
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <DatabaseIcon className="h-12 w-12 text-gray-900" />
              <h3 className="mt-2 text-lg font-medium">Banco de Dados</h3>
              <p className="mt-2 text-gray-500">
                Experiente com MongoDB, PostgreSQL, and MySQL
              </p>
            </div>
          </div>
        </section>
        <section className="py-12 px-4 md:px-6 bg-gray-100">
          <h2 className="text-3xl font-bold text-center">Projetos</h2>
          <div className="grid gap-6 mt-8 md:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col items-center text-center">
              <Image
                alt="Logo Notz - SMS (Projeto 1)"
                className="w-80 h-80 object-cover rounded-md"
                height={512}
                src="/notzsmsbot.jpg"
                width={512}
              />
              <h3 className="mt-2 text-lg font-medium">Notz - SMS</h3>
              <p className="mt-2 text-gray-500">
                Bot para Telegram que gera números virtuais temporários, feito
                em TypeScript e MongoDB
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <Image
                alt="Project 2"
                className="w-80 h-80 object-cover rounded-md"
                height={512}
                src="/placeholder.svg"
                width={512}
              />
              <h3 className="mt-2 text-lg font-medium">Projeto 2</h3>
              <p className="mt-2 text-gray-500">Descrição projeto 2</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <Image
                alt="Project 3"
                className="w-80 h-80 object-cover rounded-md"
                height={512}
                src="/placeholder.svg"
                width={512}
              />
              <h3 className="mt-2 text-lg font-medium">Projeto 3</h3>
              <p className="mt-2 text-gray-500">A Descrição projeto 3.</p>
            </div>
          </div>
        </section>
        <section className="py-12 px-4 md:px-6">
          <h2 className="text-3xl font-bold text-center">Currículo</h2>
          <div className="mt-8 max-w-md mx-auto text-center">
            <p className="mb-4">
              Clique no botão abaixo para ver meu currículo.
            </p>
            <Button>
              <Link href="/curriculo.pdf" target="_blank">
                Meu Currículo
              </Link>
            </Button>
          </div>
        </section>
        <section className="py-12 px-4 md:px-6 bg-gray-100">
          <h2 className="text-3xl font-bold text-center">Redes Sociais</h2>
          <div className="mt-8 flex justify-center gap-4">
            <Link
              className="transition ease-in-out hover:-translate-y-1 hover:scale-110 hover:text-slate-700 duration-300"
              href="https://github.com/gustavo-sotero"
              target="_blank"
            >
              <GithubIcon className="h-6 w-6" />
            </Link>
            <Link
              className="transition ease-in-out hover:-translate-y-1 hover:scale-110 hover:text-blue-500 duration-300"
              href="https://linkedin.com/in/gustavo-sotero"
              target="_blank"
            >
              <LinkedInIcon className="h-6 w-6" />
            </Link>
            <Link
              className="transition ease-in-out hover:-translate-y-1 hover:scale-110 hover:text-red-500 duration-300"
              href="mailto:contato@gustavo-sotero.dev"
              target="_blank"
            >
              <MailIcon className="h-6 w-6" />
            </Link>

            <Link
              href="/curriculo.pdf"
              className="transition ease-in-out hover:-translate-y-1 hover:scale-110 hover:text-emerald-500 duration-300"
              target="_blank"
            >
              <FileIcon className="h-6 w-6" />
            </Link>
          </div>
        </section>
      </main>
      <footer className="h-20 flex items-center justify-between text-gray-500 mx-8">
        <p>© {new Date().getFullYear()}</p>
        <p>Gustavo Sotero</p>
      </footer>
    </div>
  );
}

function CodeIcon(props: JSX.IntrinsicAttributes & SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function DatabaseIcon(
  props: JSX.IntrinsicAttributes & SVGProps<SVGSVGElement>
) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5V19A9 3 0 0 0 21 19V5" />
      <path d="M3 12A9 3 0 0 0 21 12" />
    </svg>
  );
}

function FileIcon(props: JSX.IntrinsicAttributes & SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function GithubIcon(props: JSX.IntrinsicAttributes & SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

function LinkedInIcon(
  props: JSX.IntrinsicAttributes & SVGProps<SVGSVGElement>
) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

function MailIcon(props: JSX.IntrinsicAttributes & SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function ServerIcon(props: JSX.IntrinsicAttributes & SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
      <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
      <line x1="6" x2="6.01" y1="6" y2="6" />
      <line x1="6" x2="6.01" y1="18" y2="18" />
    </svg>
  );
}

function ArrowDownIcon(
  props: JSX.IntrinsicAttributes & SVGProps<SVGSVGElement>
) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 5v14" />
      <path d="m19 12-7 7-7-7" />
    </svg>
  );
}
