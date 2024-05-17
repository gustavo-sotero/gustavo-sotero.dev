import Link from 'next/link';
import { JSX, SVGProps } from 'react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black">
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-white">Erro 404</h1>
      </header>
      <FileWarningIcon className="h-24 w-24 text-white mb-8" />
      <p className="text-lg text-white mb-8 px-4 text-center">
        Desculpe, mas a página que você está procurando não foi encontrada. Por
        favor, verifique o URL e tente novamente.
      </p>
      <Link
        className="inline-flex h-10 items-center justify-center rounded-md bg-slate-600 px-8 text-sm font-medium text-white shadow transition-colors hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-700 disabled:pointer-events-none disabled:opacity-50"
        href="/"
      >
        Voltar para a página inicial
      </Link>
    </div>
  );
}

function FileWarningIcon(
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
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}
