"use client";

// Tela PÚBLICA do questionário anônimo da AEP (v273). Mobile-first: o
// trabalhador lê o QR Code e responde no celular, sem login. Nada aqui
// identifica quem responde — a rota não grava IP nem horário. O aviso "já
// respondido" fica só no próprio aparelho (localStorage).

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface Dados {
  setor: string;
  situacao: "aberta" | "encerrada" | "expirada" | "cheia";
  instrucoes: string;
  perguntas: { id: string; texto: string }[];
  escala: string[];
}

const chaveLocal = (t: string) => `qa-enviado-${t.slice(0, 16)}`;

export default function QuestionarioAnonimo({ token }: { token: string }) {
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [respostas, setRespostas] = useState<Record<string, number>>({});
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(chaveLocal(token))) setEnviado(true);
    } catch {
      // sem localStorage (modo privado): segue normalmente
    }
    fetch(`/api/publico/questionario?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error ?? "Link inválido.");
        setDados(j as Dados);
      })
      .catch((e: Error) => setErro(e.message));
  }, [token]);

  const faltam = dados ? dados.perguntas.filter((p) => !respostas[p.id]).length : 0;

  async function enviar() {
    if (!dados || faltam > 0) return;
    setEnviando(true);
    setErro(null);
    try {
      const r = await fetch("/api/publico/questionario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, respostas, comentario }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "Não foi possível enviar.");
      setEnviado(true);
      try {
        localStorage.setItem(chaveLocal(token), "1");
      } catch {
        // ignora
      }
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 text-gray-900">
      <div className="mx-auto max-w-xl space-y-4">
        <header className="rounded-2xl bg-emerald-700 px-5 py-4 text-white">
          <p className="text-xs uppercase tracking-wide text-emerald-100">JCN Consultoria</p>
          <h1 className="text-lg font-bold">Questionário anônimo</h1>
          {dados?.setor && <p className="text-sm text-emerald-100">Setor: {dados.setor}</p>}
        </header>

        {!dados && !erro && (
          <div className="flex justify-center py-10">
            <Loader2 className="size-6 animate-spin text-emerald-600" />
          </div>
        )}

        {erro && !dados && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{erro}</div>
        )}

        {dados && enviado && (
          <div className="rounded-2xl border border-emerald-200 bg-white p-6 text-center">
            <CheckCircle2 className="mx-auto size-10 text-emerald-600" />
            <p className="mt-2 text-base font-semibold">Obrigado! Sua resposta foi registrada.</p>
            <p className="mt-1 text-sm text-gray-500">Ela é anônima e não pode ser ligada a você.</p>
          </div>
        )}

        {dados && !enviado && dados.situacao !== "aberta" && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Este questionário não está mais recebendo respostas.
          </div>
        )}

        {dados && !enviado && dados.situacao === "aberta" && (
          <>
            <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-white p-4 text-sm text-gray-700">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" />
              <p>
                {dados.instrucoes ||
                  "Este questionário é anônimo. Não pedimos seu nome e ninguém da empresa terá acesso às respostas individuais. Responda pensando nos últimos 3 meses."}
              </p>
            </div>

            {dados.perguntas.map((p, i) => (
              <section key={p.id} className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-sm font-medium">
                  <span className="mr-1 text-gray-400">{i + 1}.</span>
                  {p.texto}
                </p>
                <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-5">
                  {dados.escala.map((rotulo, idx) => {
                    const v = idx + 1;
                    const sel = respostas[p.id] === v;
                    return (
                      <button
                        key={rotulo}
                        type="button"
                        onClick={() => setRespostas((r) => ({ ...r, [p.id]: v }))}
                        className={cn(
                          "rounded-lg border px-2 py-2.5 text-sm font-medium transition",
                          sel ? "border-emerald-600 bg-emerald-600 text-white" : "border-gray-200 bg-white text-gray-700 active:bg-gray-100",
                        )}
                      >
                        {rotulo}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}

            <section className="rounded-xl border border-gray-200 bg-white p-4">
              <label className="text-sm font-medium" htmlFor="qa-comentario">
                Quer comentar algo? <span className="font-normal text-gray-400">(opcional)</span>
              </label>
              <p className="mt-0.5 text-xs text-amber-700">Não escreva nomes de pessoas.</p>
              <textarea
                id="qa-comentario"
                rows={3}
                maxLength={1000}
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              />
            </section>

            {erro && <p className="text-sm text-red-600">{erro}</p>}

            <button
              type="button"
              disabled={faltam > 0 || enviando}
              onClick={enviar}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-base font-semibold text-white disabled:opacity-50"
            >
              {enviando && <Loader2 className="size-5 animate-spin" />}
              {faltam > 0 ? `Faltam ${faltam} resposta${faltam > 1 ? "s" : ""}` : "Enviar respostas"}
            </button>
            <p className="pb-6 text-center text-xs text-gray-400">
              Triagem complementar da avaliação ergonômica. Não substitui outros instrumentos de avaliação.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
