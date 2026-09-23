"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, Send, Paperclip } from "lucide-react";
import { faltando, perguntaVisivel, ordemExibicao, type PerguntaBase } from "@/lib/gestao/formularios";

const PRIORIDADES = [
  { value: "Baixa", label: "Baixa" },
  { value: "Media", label: "Média" },
  { value: "Alta", label: "Alta" },
  { value: "Urgente", label: "Urgente" },
];

// F1.5: id/ajuda/condicao/pendente_anexo vêm da rota; regras puras em lib/gestao/formularios.ts.
type Pergunta = PerguntaBase;
interface FormDef {
  titulo: string;
  descricao: string | null;
  mostra_descricao: boolean;
  mostra_prazo: boolean;
  mostra_prioridade: boolean;
  prioridade_padrao: string;
  titulo_composto?: boolean;
  perguntas: Pergunta[];
}

// Rota Next same-origin (porta a Edge Function gestao-form-submit p/ a .107).
const ENDPOINT = "/api/gestao/form";
const HEADERS = { "Content-Type": "application/json" };

const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#0ea5e9] focus:outline-none focus:ring-1 focus:ring-[#0ea5e9]";

export default function FormularioPublico({ token }: { token: string }) {
  const [def, setDef] = useState<FormDef | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [prazo, setPrazo] = useState("");
  const [prioridade, setPrioridade] = useState("Media");
  const [respostas, setRespostas] = useState<(string | string[])[]>([]);
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
        setRespostas(((j as FormDef).perguntas ?? []).map((p) => (p.tipo === "multipla" ? [] : "")));
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
    if (!def?.titulo_composto && !titulo.trim()) { setErro("Informe o título da solicitação."); return; }
    // Obrigatórias só entre as visíveis (mesma regra do servidor) — erro claro antes do POST.
    const faltam = def ? faltando(def.perguntas, respostas) : [];
    if (faltam.length) { setErro(`Responda: ${faltam[0].label}`); return; }
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
    // Formulário aberto a gente de fora, como o login e o portal do cliente:
    // continua claro sempre. O tema é preferência de quem usa o painel interno.
    <div className="force-light min-h-screen bg-[#f0f7f0] px-4 py-10">
      <div className="mx-auto max-w-lg">
        <div className="mb-5 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#1e4d28] to-[#0ea5e9] text-2xl">🛡️</div>
          <p className="mt-2 text-sm font-semibold text-[#00432F]">JCN Consultoria · Gestão</p>
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
              <button type="button" onClick={() => { setEnviado(false); setTitulo(""); setDescricao(""); setPrazo(""); setRespostas((def?.perguntas ?? []).map((p) => (p.tipo === "multipla" ? [] : ""))); }} className="mt-4 text-sm font-medium text-[#0ea5e9] hover:underline">
                Enviar outra
              </button>
            </div>
          ) : def ? (
            <form onSubmit={enviar} className="space-y-4">
              <div>
                <h1 className="text-xl font-bold text-gray-900">{def.titulo}</h1>
                {def.descricao && <p className="mt-1 whitespace-pre-line text-sm text-gray-500">{def.descricao}</p>}
              </div>

              {!def.titulo_composto && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Título / Assunto *</label>
                  <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Resuma sua solicitação" className={inputCls} />
                </div>
              )}

              {def.mostra_descricao && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Detalhes</label>
                  <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} className={inputCls} />
                </div>
              )}

              {ordemExibicao(def.perguntas).map((i) => {
                const p = def.perguntas[i];
                const tipo = p.tipo ?? "texto";
                const val = respostas[i];
                const setVal = (v: string | string[]) => setRespostas((r) => r.map((x, j) => (j === i ? v : x)));
                // Pergunta condicional: só aparece quando a de origem tem a opção escolhida.
                if (!perguntaVisivel(p, def.perguntas, respostas)) return null;
                return (
                  <div key={p.id ?? i}>
                    <label className="mb-1 block text-xs font-medium text-gray-600">{p.label} {p.obrigatorio && "*"}</label>
                    {p.ajuda && <p className="mb-1 text-[11px] text-gray-400">{p.ajuda}</p>}
                    {p.pendente_anexo && (
                      <p className="mb-1 inline-flex items-center gap-1 text-[11px] text-amber-700"><Paperclip className="size-3" /> Descreva os documentos ou cole links; os arquivos serão solicitados pela equipe.</p>
                    )}
                    {tipo === "texto_longo" ? (
                      <textarea value={(val as string) ?? ""} onChange={(e) => setVal(e.target.value)} rows={3} className={inputCls} />
                    ) : tipo === "selecao" ? (
                      <select value={(val as string) ?? ""} onChange={(e) => setVal(e.target.value)} className={inputCls}>
                        <option value="">Selecione…</option>
                        {(p.opcoes ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : tipo === "multipla" ? (
                      <div className="space-y-1 rounded-lg border border-gray-300 p-2">
                        {(p.opcoes ?? []).map((o) => {
                          const arr = Array.isArray(val) ? val : [];
                          return (
                            <label key={o} className="flex items-center gap-2 text-sm text-gray-700">
                              <input type="checkbox" checked={arr.includes(o)} onChange={(e) => setVal(e.target.checked ? [...arr, o] : arr.filter((x) => x !== o))} /> {o}
                            </label>
                          );
                        })}
                        {(p.opcoes ?? []).length === 0 && <p className="text-xs text-gray-400">Sem opções.</p>}
                      </div>
                    ) : (
                      <input
                        type={tipo === "data" ? "date" : tipo === "data_hora" ? "datetime-local" : tipo === "email" ? "email" : tipo === "telefone" ? "tel" : "text"}
                        inputMode={tipo === "cnpj" || tipo === "cpf" || tipo === "telefone" ? "numeric" : undefined}
                        value={(val as string) ?? ""} onChange={(e) => setVal(e.target.value)} className={inputCls}
                      />
                    )}
                  </div>
                );
              })}

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
        <p className="mt-4 text-center text-xs text-gray-400">Painel SST · JCN Consultoria</p>
      </div>
    </div>
  );
}
