"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, Send } from "lucide-react";

const PRIORIDADES = [
  { value: "Baixa", label: "Baixa" },
  { value: "Media", label: "Média" },
  { value: "Alta", label: "Alta" },
  { value: "Urgente", label: "Urgente" },
];

interface FormDef {
  titulo: string;
  descricao: string | null;
  mostra_descricao: boolean;
  mostra_prazo: boolean;
  mostra_prioridade: boolean;
  prioridade_padrao: string;
  perguntas: { label: string; obrigatorio: boolean }[];
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const ENDPOINT = `${URL}/functions/v1/gestao-form-submit`;
const HEADERS = { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${ANON}` };

const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#0ea5e9] focus:outline-none focus:ring-1 focus:ring-[#0ea5e9]";

export default function FormularioPublico({ token }: { token: string }) {
  const [def, setDef] = useState<FormDef | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [prazo, setPrazo] = useState("");
  const [prioridade, setPrioridade] = useState("Media");
  const [respostas, setRespostas] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${ENDPOINT}?token=${encodeURIComponent(token)}`, { headers: HEADERS });
        const j = await r.json();
        if (!r.ok) { setErroCarga(j.error ?? "Formulário indisponível."); return; }
        setDef(j as FormDef);
        setPrioridade((j as FormDef).prioridade_padrao ?? "Media");
        setRespostas(new Array(((j as FormDef).perguntas ?? []).length).fill(""));
      } catch {
        setErroCarga("Não foi possível carregar o formulário.");
      } finally {
        setCarregando(false);
      }
    })();
  }, [token]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!titulo.trim()) { setErro("Informe o título da solicitação."); return; }
    setEnviando(true);
    try {
      const r = await fetch(ENDPOINT, {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify({ token, titulo, descricao, prazo, prioridade, respostas }),
      });
      const j = await r.json();
      if (!r.ok) { setErro(j.error ?? "Não foi possível enviar."); return; }
      setEnviado(true);
    } catch {
      setErro("Falha de conexão. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f0f7f0] px-4 py-10">
      <div className="mx-auto max-w-lg">
        <div className="mb-5 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#1e4d28] to-[#0ea5e9] text-2xl">🛡️</div>
          <p className="mt-2 text-sm font-semibold text-[#0c4a6e]">JCN Consultoria · Gestão</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          {carregando ? (
            <p className="flex items-center justify-center gap-2 py-8 text-sm text-gray-400"><Loader2 className="size-4 animate-spin" /> Carregando…</p>
          ) : erroCarga ? (
            <p className="py-8 text-center text-sm text-gray-500">{erroCarga}</p>
          ) : enviado ? (
            <div className="py-8 text-center">
              <CheckCircle2 className="mx-auto size-12 text-[#16a34a]" />
              <p className="mt-3 text-lg font-semibold text-gray-800">Solicitação enviada!</p>
              <p className="mt-1 text-sm text-gray-500">Recebemos sua solicitação. Obrigado.</p>
              <button type="button" onClick={() => { setEnviado(false); setTitulo(""); setDescricao(""); setPrazo(""); setRespostas((r) => r.map(() => "")); }} className="mt-4 text-sm font-medium text-[#0ea5e9] hover:underline">
                Enviar outra
              </button>
            </div>
          ) : def ? (
            <form onSubmit={enviar} className="space-y-4">
              <div>
                <h1 className="text-xl font-bold text-gray-900">{def.titulo}</h1>
                {def.descricao && <p className="mt-1 whitespace-pre-line text-sm text-gray-500">{def.descricao}</p>}
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Título / Assunto *</label>
                <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Resuma sua solicitação" className={inputCls} />
              </div>

              {def.mostra_descricao && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Detalhes</label>
                  <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} className={inputCls} />
                </div>
              )}

              {def.perguntas.map((p, i) => (
                <div key={i}>
                  <label className="mb-1 block text-xs font-medium text-gray-600">{p.label} {p.obrigatorio && "*"}</label>
                  <input value={respostas[i] ?? ""} onChange={(e) => setRespostas((r) => r.map((x, j) => (j === i ? e.target.value : x)))} className={inputCls} />
                </div>
              ))}

              <div className="grid grid-cols-2 gap-3">
                {def.mostra_prazo && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Prazo desejado</label>
                    <input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} className={inputCls} />
                  </div>
                )}
                {def.mostra_prioridade && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Prioridade</label>
                    <select value={prioridade} onChange={(e) => setPrioridade(e.target.value)} className={inputCls}>
                      {PRIORIDADES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{erro}</p>}

              <button type="submit" disabled={enviando} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0ea5e9] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#00553f] disabled:opacity-60">
                {enviando ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Enviar solicitação
              </button>
            </form>
          ) : null}
        </div>
        <p className="mt-4 text-center text-xs text-gray-400">SST JCN Consultoria · JCN Consultoria</p>
      </div>
    </div>
  );
}
