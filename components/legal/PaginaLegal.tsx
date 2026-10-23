import type { ReactNode } from "react";

/** Moldura das páginas públicas de Privacidade e Termos (abertas sem login; o Google lê na tela de consentimento). */
export default function PaginaLegal({ titulo, atualizado, children }: { titulo: string; atualizado: string; children: ReactNode }) {
  return (
    <main className="force-light min-h-screen bg-slate-50 px-4 py-10 text-slate-800">
      <article className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <header className="mb-8 flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-jcn.svg" alt="JCN Consultoria" className="h-12 w-auto self-start" />
          <div className="sm:text-right">
            <h1 className="text-2xl font-bold text-[#0284c7]">{titulo}</h1>
            <p className="text-xs text-slate-500">SST JCN Consultoria · atualizado em {atualizado}</p>
          </div>
        </header>
        <div className="space-y-6 text-sm leading-relaxed [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-slate-900 [&_li]:ml-5 [&_li]:list-disc [&_a]:text-[#0284c7] [&_a]:underline">
          {children}
        </div>
        <footer className="mt-10 flex flex-wrap gap-4 border-t border-slate-200 pt-6 text-xs text-slate-500">
          <a href="/privacidade" className="hover:text-[#0284c7]">Política de Privacidade</a>
          <a href="/termos" className="hover:text-[#0284c7]">Termos de Serviço</a>
          <a href="/login" className="hover:text-[#0284c7]">Entrar no sistema</a>
        </footer>
      </article>
    </main>
  );
}
