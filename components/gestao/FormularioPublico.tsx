"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, CheckCircle2, Send, Paperclip, Upload, X, ChevronDown, Check } from "lucide-react";
import { normalizarTexto } from "@/lib/busca/texto";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { faltando, perguntaVisivel, ordemExibicao, type PerguntaBase } from "@/lib/gestao/formularios";

const MAX_ANEXO = 50 * 1024 * 1024; // = MAX_BYTES_ANEXO_FORM (limite de upload do Storage no JCN)
const MAX_ARQUIVOS = 10; // = MAX_ANEXOS_FORM da rota /api/gestao/form/anexo

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

function fmtBytes(n: number): string {
  if (n < 1048576) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

/** Área "solte aqui os arquivos" da pergunta tipo anexo. */
function CampoAnexo({ arquivos, onChange }: { arquivos: File[]; onChange: (f: File[]) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  function adicionar(lista: FileList | null) {
    if (!lista?.length) return;
    const todos = Array.from(lista);
    const grandes = todos.filter((f) => f.size > MAX_ANEXO);
    const cabem = todos.filter((f) => f.size <= MAX_ANEXO);
    const novos = [...arquivos, ...cabem].slice(0, MAX_ARQUIVOS);
    const avisos: string[] = [];
    if (grandes.length) avisos.push(`Acima de 50 MB, não incluído: ${grandes.map((g) => g.name).join(", ")}`);
    if (arquivos.length + cabem.length > MAX_ARQUIVOS) avisos.push(`Máximo de ${MAX_ARQUIVOS} arquivos.`);
    setAviso(avisos.length ? avisos.join(" ") : null);
    onChange(novos);
    if (ref.current) ref.current.value = "";
  }
  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => ref.current?.click()}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ref.current?.click(); } }}
        onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => { e.preventDefault(); setArrastando(false); adicionar(e.dataTransfer.files); }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-3 py-6 text-center transition-colors ${arrastando ? "border-[#0ea5e9] bg-sky-50" : "border-gray-300 hover:border-[#0ea5e9]"}`}
      >
        <Upload className="size-5 text-gray-400" />
        <p className="text-sm font-medium text-gray-600">Solte aqui os arquivos</p>
        <p className="text-xs text-gray-400">Insira arquivos clicando aqui ou arraste e solte eles nesta área</p>
        <p className="text-[11px] text-gray-400">Fotos, imagens, vídeos e documentos de qualquer formato · até {MAX_ARQUIVOS} arquivos de 50 MB</p>
        {/* image/* e video/* fazem o celular oferecer câmera e galeria; o "*\/*" mantém qualquer outro formato. */}
        <input ref={ref} type="file" multiple accept="image/*,video/*,*/*" className="hidden" onChange={(e) => adicionar(e.target.files)} />
      </div>
      {aviso && <p className="mt-1 text-[11px] text-amber-700">{aviso}</p>}
      {arquivos.length > 0 && (
        <ul className="mt-2 space-y-1">
          {arquivos.map((f, k) => (
            <li key={k} className="flex items-center gap-2 rounded-md bg-gray-50 px-2 py-1 text-xs text-gray-700">
              <Paperclip className="size-3.5 shrink-0 text-gray-400" />
              <span className="flex-1 truncate">{f.name}</span>
              <span className="text-gray-400">{fmtBytes(f.size)}</span>
              <button type="button" onClick={() => onChange(arquivos.filter((_, j) => j !== k))} className="text-gray-400 hover:text-red-600" title="Remover"><X className="size-3.5" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#0ea5e9] focus:outline-none focus:ring-1 focus:ring-[#0ea5e9]";

/**
 * Múltipla escolha como lista fechada (ex.: "Produtos (T.I)"): as opções só aparecem ao abrir,
 * dá para filtrar digitando, e na caixa ficam apenas as escolhidas (com X para tirar).
 */
function CampoMultipla({ opcoes, valor, onChange }: { opcoes: string[]; valor: string[]; onChange: (v: string[]) => void }) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const buscaRef = useRef<HTMLInputElement>(null);

  // Fecha ao clicar fora.
  useEffect(() => {
    if (!aberto) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) { setAberto(false); setBusca(""); }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [aberto]);

  useEffect(() => { if (aberto) buscaRef.current?.focus(); }, [aberto]);

  const q = normalizarTexto(busca);
  const filtradas = q ? opcoes.filter((o) => normalizarTexto(o).includes(q)) : opcoes;
  const alternar = (o: string) => onChange(valor.includes(o) ? valor.filter((x) => x !== o) : [...valor, o]);

  if (opcoes.length === 0) return <p className="text-xs text-gray-400">Sem opções.</p>;
  return (
    <div ref={wrapRef} className="relative">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={aberto}
        onClick={() => setAberto((a) => !a)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setAberto((a) => !a); } else if (e.key === "Escape") setAberto(false); }}
        className={`${inputCls} flex min-h-[38px] cursor-pointer items-center gap-2 bg-white`}
      >
        <div className="flex flex-1 flex-wrap gap-1.5">
          {valor.length === 0 && <span className="text-gray-400">Selecione…</span>}
          {valor.map((o) => (
            <span key={o} className="inline-flex items-center gap-1 rounded-full bg-[#0ea5e9]/10 py-0.5 pl-2 pr-1 text-xs font-medium text-[#0ea5e9]">
              {o}
              <button type="button" aria-label={`Remover ${o}`} onClick={(e) => { e.stopPropagation(); alternar(o); }} className="rounded-full p-0.5 hover:bg-[#0ea5e9]/15">
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
        <ChevronDown className={`size-4 shrink-0 text-gray-400 transition ${aberto ? "rotate-180" : ""}`} />
      </div>
      {aberto && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 p-2">
            <input
              ref={buscaRef}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") { setAberto(false); setBusca(""); }
                else if (e.key === "Enter") { e.preventDefault(); if (filtradas.length === 1) { alternar(filtradas[0]); setBusca(""); } }
              }}
              placeholder="Buscar…"
              className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm focus:border-[#0ea5e9] focus:outline-none"
            />
          </div>
          <ul className="max-h-60 overflow-y-auto py-1">
            {filtradas.map((o) => {
              const marcado = valor.includes(o);
              return (
                <li key={o}>
                  <button type="button" onClick={() => alternar(o)} className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-50 ${marcado ? "font-medium text-[#0ea5e9]" : "text-gray-700"}`}>
                    <span className={`flex size-4 shrink-0 items-center justify-center rounded border ${marcado ? "border-[#0ea5e9] bg-[#0ea5e9] text-white" : "border-gray-300"}`}>
                      {marcado && <Check className="size-3" />}
                    </span>
                    {o}
                  </button>
                </li>
              );
            })}
            {filtradas.length === 0 && <li className="px-3 py-2 text-xs text-gray-400">Nada encontrado.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function FormularioPublico({ token }: { token: string }) {
  const [def, setDef] = useState<FormDef | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [prazo, setPrazo] = useState("");
  const [prioridade, setPrioridade] = useState("Media");
  const [respostas, setRespostas] = useState<(string | string[])[]>([]);
  // Arquivos por índice de pergunta (tipo "anexo"); a resposta enviada é a lista de nomes.
  const [arquivos, setArquivos] = useState<Record<number, File[]>>({});
  const [avisoEnvio, setAvisoEnvio] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${ENDPOINT}?token=${encodeURIComponent(token)}`, { headers: HEADERS });
        const j = await r.json();
        if (!r.ok) { setErroCarga(j.error ?? "Formulário indisponível."); return; }        setDef(j as FormDef);
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
      // A solicitação já existe; agora sobem os anexos, um a um, direto ao Storage (URL assinada):
      // preparar → enviar → confirmar. Na Vercel o arquivo não cabe no corpo de uma rota (4,5 MB).
      const falhas: string[] = [];
      const base = { token, id_tarefa: j.id_tarefa, ticket: j.ticket_anexo ?? "" };
      const sb = createSupabaseBrowserClient();
      for (const lista of Object.values(arquivos)) {
        for (const arq of lista) {
          try {
            const rp = await fetch(`${ENDPOINT}/anexo`, {
              method: "POST", headers: HEADERS,
              body: JSON.stringify({ ...base, acao: "preparar", nome: arq.name, tamanho: arq.size }),
            });
            if (!rp.ok) { falhas.push(arq.name); continue; }
            const { path, token_upload } = (await rp.json()) as { path: string; token_upload: string };
            const { error: upErr } = await sb.storage.from("anexos").uploadToSignedUrl(path, token_upload, arq, { contentType: arq.type || undefined });
            if (upErr) { falhas.push(arq.name); continue; }
            const rc = await fetch(`${ENDPOINT}/anexo`, {
              method: "POST", headers: HEADERS,
              body: JSON.stringify({ ...base, acao: "confirmar", path, nome: arq.name }),
            });
            if (!rc.ok) falhas.push(arq.name);
          } catch {
            falhas.push(arq.name);
          }
        }
      }
      setAvisoEnvio(falhas.length ? `A solicitação foi registrada, mas não conseguimos enviar: ${falhas.join(", ")}. Avise a equipe ou anexe pelo card da tarefa.` : null);
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
              {avisoEnvio && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-left text-sm text-amber-800">{avisoEnvio}</p>}
              <button type="button" onClick={() => { setEnviado(false); setAvisoEnvio(null); setArquivos({}); setTitulo(""); setDescricao(""); setPrazo(""); setRespostas((def?.perguntas ?? []).map((p) => (p.tipo === "multipla" ? [] : ""))); }} className="mt-4 text-sm font-medium text-[#0ea5e9] hover:underline">
                Enviar outra
              </button>
            </div>
          ) : def ? (
            <form onSubmit={enviar} className="space-y-4">
              <div>
                <h1 className="text-xl font-bold text-gray-900">{def.titulo}</h1>
                {def.descricao && <p className="mt-1 whitespace-pre-line text-sm text-gray-500">{def.descricao}</p>}
                <p className="mt-2 text-xs text-red-600">* Pergunta obrigatória</p>
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
                    <label className="mb-1 block text-xs font-medium text-gray-600">{p.label} {p.obrigatorio && <span className="text-red-600">*</span>}</label>
                    {p.ajuda && <p className="mb-1 text-[11px] text-gray-400">{p.ajuda}</p>}
                    {p.pendente_anexo && (
                      <p className="mb-1 inline-flex items-center gap-1 text-[11px] text-amber-700"><Paperclip className="size-3" /> Descreva os documentos ou cole links; os arquivos serão solicitados pela equipe.</p>
                    )}
                    {tipo === "anexo" ? (
                      <CampoAnexo
                        arquivos={arquivos[i] ?? []}
                        onChange={(lista) => { setArquivos((a) => ({ ...a, [i]: lista })); setVal(lista.map((x) => x.name)); }}
                      />
                    ) : tipo === "texto_longo" ? (
                      <textarea value={(val as string) ?? ""} onChange={(e) => setVal(e.target.value)} rows={3} className={inputCls} />
                    ) : tipo === "selecao" ? (
                      <select value={(val as string) ?? ""} onChange={(e) => setVal(e.target.value)} className={inputCls}>
                        <option value="">Selecione…</option>
                        {(p.opcoes ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : tipo === "multipla" ? (
                      <CampoMultipla opcoes={p.opcoes ?? []} valor={Array.isArray(val) ? val : []} onChange={setVal} />
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
