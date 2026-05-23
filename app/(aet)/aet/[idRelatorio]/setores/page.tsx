"use client";

import { useEffect, useState, use } from "react";
import { Plus, Trash2, Save, Loader2, ChevronDown, ChevronUp, X, Camera, Sparkles } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import {
  useAetRelatorio,
  useSalvarAet,
  setorVazio,
  useAetOwasConfig,
  useAetOwasSelects,
  useAetChecklistPerguntas,
  useAetPerfisOwas,
  SLUG_TO_DEFAULT_IMAGE,
  SLUG_TO_OWAS_FIELD,
  CHECKLIST_PERGUNTAS_PADRAO,
} from "@/lib/hooks/useAet";
import { useCanEdit } from "@/lib/hooks/useUsuario";
import RichTextEditor from "@/components/drps/RichTextEditor";
import { cn } from "@/lib/utils";
import type {
  AetSetor,
  AetRisco,
  AetCargo,
  AetChecklist,
  AetOwas,
  AetOwasCategoria,
  RespostaChecklist,
  TipoRiscoAET,
  ClassificacaoRiscoAET,
} from "@/lib/supabase/types";

const TIPOS_RISCO: TipoRiscoAET[] = ["Acidentes", "Ergonômico", "Físico", "Químico", "Biológico"];
const CLASSIFICACOES: ClassificacaoRiscoAET[] = ["Trivial", "De Atenção", "Moderado", "Alto", "Crítico"];
const CLASS_COLOR: Record<ClassificacaoRiscoAET, string> = {
  Trivial: "bg-green-100 text-green-800",
  "De Atenção": "bg-yellow-100 text-yellow-800",
  Moderado: "bg-orange-100 text-orange-800",
  Alto: "bg-red-100 text-red-800",
  Crítico: "bg-red-200 text-red-900",
};

const SLUGS_PADRAO = new Set([
  "levantamento_acima_limite", "trabalho_predominante", "pausas_descanso",
  "uso_cadeira", "cadeira_adequada", "monitor", "organizacao_trabalho",
  "exigencia_levantamento", "ritmo_por_demanda", "pausas_formais", "rodizios_sistematizados",
]);

export default function AetSetoresPage({
  params,
}: {
  params: Promise<{ idRelatorio: string }>;
}) {
  const { idRelatorio } = use(params);
  const { data: rel, isLoading } = useAetRelatorio(idRelatorio);
  const salvar = useSalvarAet();
  const canEdit = useCanEdit();

  // OWAS / Checklist
  const { data: owasConfig = [] } = useAetOwasConfig();
  const { data: perfisOwas = [] } = useAetPerfisOwas();
  const { data: owasSelects = [] } = useAetOwasSelects();
  const { data: checklistPerguntas = [] } = useAetChecklistPerguntas();

  const [setores, setSetores] = useState<AetSetor[]>([]);
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [uploadingFoto, setUploadingFoto] = useState<string | null>(null);
  const [gerandoIA, setGerandoIA] = useState<string | null>(null); // "setorId:campo"

  async function gerarTextoIA(
    setorId: string,
    campo: "parecer_tecnico" | "recomendacoes" | "demais_condicoes"
  ) {
    const setor = setores.find((s) => s.id === setorId);
    if (!setor) return;
    const key = `${setorId}:${campo}`;
    setGerandoIA(key);
    try {
      const sb = createSupabaseBrowserClient();
      const empresa = rel?.empresas as { nome_empresa?: string } | null;
      const { data, error } = await sb.functions.invoke("gerar-analise-setor-aet-ia", {
        body: {
          campo,
          empresa_nome: empresa?.nome_empresa ?? null,
          setor_nome: setor.nome_setor || "Setor",
          cargos: setor.cargos.map((c) => c.nome).filter(Boolean),
          descricao_atividade: setor.descricao_atividade ?? null,
          maquinas_equipamentos: setor.maquinas_equipamentos ?? null,
          riscos: setor.riscos.map((r) => ({
            tipo: r.tipo,
            risco: r.risco,
            classificacao: r.classificacao_risco,
            intensidade: r.intensidade_concentracao ?? null,
          })),
          checklist: setor.checklist as unknown as Record<string, string>,
          textoAtual: (setor[campo] as string) || null,
        },
      });
      if (error) {
        const msg = (error as { message?: string })?.message ?? JSON.stringify(error);
        toast.error(`IA: ${msg}`);
        return;
      }
      const texto: string = data?.data?.texto ?? data?.texto ?? "";
      if (!texto) { toast.error("IA não retornou texto"); return; }
      updateSetor(setorId, { [campo]: texto });
    } catch (err) {
      toast.error(`IA: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setGerandoIA(null);
    }
  }

  useEffect(() => {
    if (rel) {
      setSetores(rel.setores ?? []);
      if (rel.setores?.length) setAbertos(new Set([rel.setores[0].id]));
    }
  }, [rel]);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const selectOpts = (slug: string): string[] =>
    owasSelects.find((s) => s.slug === slug)?.opcoes ?? [];

  const pergunta = (slug: string) =>
    checklistPerguntas.find((p) => p.slug === slug)?.label ??
    CHECKLIST_PERGUNTAS_PADRAO.find((p) => p.slug === slug)?.label ?? "";

  const perguntasCustomDaSecao = (secao: string) =>
    checklistPerguntas.filter(
      (p) => p.secao === secao && !SLUGS_PADRAO.has(p.slug) && p.tipo === "tristate"
    );

  // ── State mutators ────────────────────────────────────────────────────────

  function toggle(id: string) {
    setAbertos((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function addSetor() {
    const novo = setorVazio();
    setSetores((s) => [...s, novo]);
    setAbertos((prev) => new Set([...prev, novo.id]));
  }

  function removeSetor(id: string) {
    setSetores((s) => s.filter((x) => x.id !== id));
  }

  function updateSetor(id: string, patch: Partial<AetSetor>) {
    setSetores((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  function addRisco(setorId: string) {
    const risco: AetRisco = {
      id: crypto.randomUUID(),
      tipo: "Acidentes",
      risco: "",
      intensidade_concentracao: "N/A",
      tecnica_metodologia: "Qualitativa",
      epi_ca: "N/A",
      epi_eficaz: "N/A",
      classificacao_risco: "Moderado",
    };
    updateSetor(setorId, {
      riscos: [...(setores.find((s) => s.id === setorId)?.riscos ?? []), risco],
    });
  }

  function removeRisco(setorId: string, riscoId: string) {
    const setor = setores.find((s) => s.id === setorId);
    if (!setor) return;
    updateSetor(setorId, { riscos: setor.riscos.filter((r) => r.id !== riscoId) });
  }

  function updateRisco(setorId: string, riscoId: string, patch: Partial<AetRisco>) {
    const setor = setores.find((s) => s.id === setorId);
    if (!setor) return;
    updateSetor(setorId, {
      riscos: setor.riscos.map((r) => (r.id === riscoId ? { ...r, ...patch } : r)),
    });
  }

  function toggleOwas(setorId: string, field: keyof AetOwas, value: number) {
    const setor = setores.find((s) => s.id === setorId);
    if (!setor) return;
    const current = setor.owas[field] as number[];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    updateSetor(setorId, { owas: { ...setor.owas, [field]: next } as AetOwas });
  }

  function updateChecklist(setorId: string, patch: Partial<AetChecklist>) {
    const setor = setores.find((s) => s.id === setorId);
    if (!setor) return;
    updateSetor(setorId, { checklist: { ...setor.checklist, ...patch } });
  }

  function updateRespostaExtra(setorId: string, slug: string, value: RespostaChecklist) {
    const setor = setores.find((s) => s.id === setorId);
    if (!setor) return;
    updateSetor(setorId, { respostas_extras: { ...(setor.respostas_extras ?? {}), [slug]: value } });
  }

  function aplicarPerfil(setorId: string, perfilId: string) {
    const perfil = perfisOwas.find((p) => p.id === perfilId);
    if (!perfil) return;
    updateSetor(setorId, {
      owas: {
        posturas_costas: perfil.posturas_costas,
        posturas_bracos: perfil.posturas_bracos,
        posturas_pernas: perfil.posturas_pernas,
        esforco: perfil.esforco,
      },
    });
  }

  async function addFoto(setorId: string, file: File) {
    if (uploadingFoto) return;
    setUploadingFoto(setorId);
    const loadId = toast.loading("Enviando foto...");
    try {
      const supabase = createSupabaseBrowserClient();
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `aet-setores/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("fotos")
        .upload(path, file, { cacheControl: "31536000", upsert: false });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("fotos").getPublicUrl(path);
      if (!pub?.publicUrl) throw new Error("URL pública não retornada");
      const setor = setores.find((s) => s.id === setorId);
      if (!setor) return;
      updateSetor(setorId, { fotos: [...(setor.fotos ?? []), pub.publicUrl] });
      toast.success("Foto adicionada", { id: loadId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no upload", { id: loadId });
    } finally {
      setUploadingFoto(null);
    }
  }

  function removeFoto(setorId: string, url: string) {
    const setor = setores.find((s) => s.id === setorId);
    if (!setor) return;
    updateSetor(setorId, { fotos: (setor.fotos ?? []).filter((f) => f !== url) });
  }

  function handleSave() {
    salvar.mutate(
      { id: idRelatorio, patch: { setores } },
      {
        onSuccess: () => toast.success("Salvo com sucesso"),
        onError: (e: Error) => toast.error(e.message),
      }
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Setores / Riscos</h1>
          <p className="text-xs text-gray-500">Seções 9 e 13 — agentes ambientais, OWAS, checklist e recomendações por setor</p>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <>
              <button
                type="button"
                onClick={addSetor}
                className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Plus className="size-4" /> Setor
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={salvar.isPending}
                className="inline-flex items-center gap-2 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-50"
              >
                {salvar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Salvar
              </button>
            </>
          )}
        </div>
      </div>

      {setores.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500">
          Nenhum setor adicionado. {canEdit && "Clique em \"+ Setor\" para começar."}
        </div>
      ) : (
        setores.map((setor, idx) => (
          <div key={setor.id} className="rounded-xl border border-gray-200 bg-white shadow-sm">
            {/* Header */}
            <button
              type="button"
              onClick={() => toggle(setor.id)}
              className="flex w-full items-center justify-between px-5 py-3 text-left"
            >
              <span className="font-semibold text-gray-900">
                Setor {idx + 1}: {setor.nome_setor || <span className="italic text-gray-400">Sem nome</span>}
                {setor.cargos.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    — {setor.cargos.map((c) => c.nome).filter(Boolean).join(", ")}
                  </span>
                )}
              </span>
              <div className="flex items-center gap-2">
                {canEdit && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); removeSetor(setor.id); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); removeSetor(setor.id); } }}
                    className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="size-4" />
                  </span>
                )}
                {abertos.has(setor.id) ? <ChevronUp className="size-4 text-gray-400" /> : <ChevronDown className="size-4 text-gray-400" />}
              </div>
            </button>

            {abertos.has(setor.id) && (
              <div className="border-t border-gray-100 px-5 pb-6 pt-4 space-y-6">

                {/* ── Dados do setor ── */}
                <div className="space-y-3">
                  <TextInput label="Nome do Setor" value={setor.nome_setor} disabled={!canEdit} onChange={(v) => updateSetor(setor.id, { nome_setor: v })} />
                  <CargoList cargos={setor.cargos} disabled={!canEdit} onChange={(v) => updateSetor(setor.id, { cargos: v })} />
                  <TagInput label="Máquinas e Equipamentos" value={setor.maquinas_equipamentos} disabled={!canEdit} onChange={(v) => updateSetor(setor.id, { maquinas_equipamentos: v })} />
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Descrição Geral da Atividade</label>
                    <textarea
                      value={setor.descricao_atividade}
                      disabled={!canEdit}
                      rows={2}
                      onChange={(e) => updateSetor(setor.id, { descricao_atividade: e.target.value })}
                      className="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none disabled:bg-gray-50"
                    />
                  </div>
                </div>

                {/* ── Riscos (Seção 9) ── */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Agentes / Riscos (Seção 9)</h3>
                    {canEdit && (
                      <button type="button" onClick={() => addRisco(setor.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">
                        <Plus className="size-3" /> Risco
                      </button>
                    )}
                  </div>
                  {setor.riscos.length === 0 ? (
                    <p className="text-xs italic text-gray-400">Nenhum risco cadastrado.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-md border border-gray-200">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 text-gray-500">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">Tipo</th>
                            <th className="px-3 py-2 text-left font-medium">Risco</th>
                            <th className="px-3 py-2 text-left font-medium">Intensidade</th>
                            <th className="px-3 py-2 text-left font-medium">Técnica</th>
                            <th className="px-3 py-2 text-left font-medium">EPI CA</th>
                            <th className="px-3 py-2 text-left font-medium">EPI Eficaz</th>
                            <th className="px-3 py-2 text-center font-medium">Classificação</th>
                            {canEdit && <th className="px-3 py-2" />}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {setor.riscos.map((risco) => (
                            <tr key={risco.id}>
                              <td className="px-3 py-1.5">
                                <select value={risco.tipo} disabled={!canEdit}
                                  onChange={(e) => updateRisco(setor.id, risco.id, { tipo: e.target.value as TipoRiscoAET })}
                                  className="rounded border border-gray-300 bg-white px-1.5 py-1 text-xs disabled:bg-gray-50">
                                  {TIPOS_RISCO.map((t) => <option key={t}>{t}</option>)}
                                </select>
                              </td>
                              <td className="px-3 py-1.5">
                                <input type="text" value={risco.risco} disabled={!canEdit}
                                  onChange={(e) => updateRisco(setor.id, risco.id, { risco: e.target.value })}
                                  className="w-36 rounded border border-gray-300 px-1.5 py-1 text-xs disabled:bg-gray-50" />
                              </td>
                              <td className="px-3 py-1.5">
                                <input type="text" value={risco.intensidade_concentracao} disabled={!canEdit}
                                  onChange={(e) => updateRisco(setor.id, risco.id, { intensidade_concentracao: e.target.value })}
                                  className="w-20 rounded border border-gray-300 px-1.5 py-1 text-xs disabled:bg-gray-50" />
                              </td>
                              <td className="px-3 py-1.5">
                                <input type="text" value={risco.tecnica_metodologia} disabled={!canEdit}
                                  onChange={(e) => updateRisco(setor.id, risco.id, { tecnica_metodologia: e.target.value })}
                                  className="w-24 rounded border border-gray-300 px-1.5 py-1 text-xs disabled:bg-gray-50" />
                              </td>
                              <td className="px-3 py-1.5">
                                <input type="text" value={risco.epi_ca} disabled={!canEdit}
                                  onChange={(e) => updateRisco(setor.id, risco.id, { epi_ca: e.target.value })}
                                  className="w-16 rounded border border-gray-300 px-1.5 py-1 text-xs disabled:bg-gray-50" />
                              </td>
                              <td className="px-3 py-1.5">
                                <input type="text" value={risco.epi_eficaz} disabled={!canEdit}
                                  onChange={(e) => updateRisco(setor.id, risco.id, { epi_eficaz: e.target.value })}
                                  className="w-24 rounded border border-gray-300 px-1.5 py-1 text-xs disabled:bg-gray-50" />
                              </td>
                              <td className="px-3 py-1.5 text-center">
                                <select value={risco.classificacao_risco} disabled={!canEdit}
                                  onChange={(e) => updateRisco(setor.id, risco.id, { classificacao_risco: e.target.value as ClassificacaoRiscoAET })}
                                  className={cn("rounded border px-1.5 py-1 text-xs font-medium", CLASS_COLOR[risco.classificacao_risco])}>
                                  {CLASSIFICACOES.map((c) => <option key={c}>{c}</option>)}
                                </select>
                              </td>
                              {canEdit && (
                                <td className="px-3 py-1.5">
                                  <button type="button" onClick={() => removeRisco(setor.id, risco.id)} className="text-red-400 hover:text-red-600">
                                    <Trash2 className="size-3.5" />
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* ── Fotos do Setor ── */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Fotos do Setor (máx. 6)</h3>
                    {canEdit && (setor.fotos ?? []).length < 6 && (
                      <label
                        className={cn(
                          "inline-flex cursor-pointer items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50",
                          uploadingFoto === setor.id && "cursor-not-allowed opacity-50"
                        )}
                      >
                        {uploadingFoto === setor.id ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <Camera className="size-3" />
                        )}
                        Adicionar Foto
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={uploadingFoto === setor.id}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void addFoto(setor.id, f);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    )}
                  </div>
                  {(setor.fotos ?? []).length === 0 ? (
                    <p className="text-xs italic text-gray-400">Nenhuma foto adicionada.</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {(setor.fotos ?? []).slice(0, 6).map((url, fIdx) => (
                        <div key={fIdx} className="group relative aspect-video overflow-hidden rounded-md border border-gray-200">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt={`Foto ${fIdx + 1}`} className="h-full w-full object-cover" />
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => removeFoto(setor.id, url)}
                              className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                            >
                              <X className="size-3" />
                            </button>
                          )}
                          <span className="absolute bottom-1 left-1 rounded bg-black/40 px-1 text-[10px] text-white">
                            {fIdx + 1}/6
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── OWAS (Seção 13) ── */}
                <div>
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-500">OWAS — Análise de Posturas (Seção 13)</h3>

                  {canEdit && perfisOwas.length > 0 && (
                    <div className="mb-3 flex items-center gap-2">
                      <span className="text-xs text-gray-500">Aplicar perfil OWAS:</span>
                      <select defaultValue=""
                        onChange={(e) => { if (e.target.value) aplicarPerfil(setor.id, e.target.value); e.target.value = ""; }}
                        className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 focus:border-verde-primary focus:outline-none">
                        <option value="" disabled>Selecionar perfil...</option>
                        {perfisOwas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                      </select>
                      <span className="text-[10px] text-gray-400">Preenche os campos abaixo</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {owasConfig.map((cat) => {
                      const field = SLUG_TO_OWAS_FIELD[cat.slug];
                      if (!field) return null;
                      return (
                        <OwasGroup
                          key={cat.id}
                          categoria={cat}
                          selected={(setor.owas[field] ?? []) as number[]}
                          disabled={!canEdit}
                          onToggle={(v) => toggleOwas(setor.id, field, v)}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* ── Checklist ── */}
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Postura / Organização do Trabalho</h3>
                    <div className="flex gap-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider pr-1">
                      <span className="w-7 text-center">Sim</span>
                      <span className="w-7 text-center">Não</span>
                      <span className="w-7 text-center">N/A</span>
                    </div>
                  </div>

                  <TriStateRow label={pergunta("levantamento_acima_limite")} value={setor.checklist.levantamento_acima_limite} disabled={!canEdit} onChange={(v) => updateChecklist(setor.id, { levantamento_acima_limite: v })} />

                  <div className="flex items-start gap-3">
                    <span className="flex-1 text-xs text-gray-700">
                      {owasSelects.find((s) => s.slug === "trabalho_predominante")?.label ?? "O trabalho executado durante aos chamados decorrentes do dia-dia, são realizados preponderantemente de qual forma?"}
                    </span>
                    <select
                      value={setor.checklist.trabalho_predominante}
                      disabled={!canEdit}
                      onChange={(e) => updateChecklist(setor.id, { trabalho_predominante: e.target.value as AetChecklist["trabalho_predominante"] })}
                      className="rounded border border-gray-300 bg-white px-2 py-1 text-xs disabled:bg-gray-50"
                    >
                      {selectOpts("trabalho_predominante").map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </div>

                  <TriStateRow label={pergunta("pausas_descanso")} value={setor.checklist.pausas_descanso} disabled={!canEdit} onChange={(v) => updateChecklist(setor.id, { pausas_descanso: v })} />
                  <TriStateRow label={pergunta("uso_cadeira")} value={setor.checklist.uso_cadeira} disabled={!canEdit} onChange={(v) => updateChecklist(setor.id, { uso_cadeira: v })} />
                  <TriStateRow label={pergunta("cadeira_adequada")} value={setor.checklist.cadeira_adequada} disabled={!canEdit} onChange={(v) => updateChecklist(setor.id, { cadeira_adequada: v })} />
                  <TriStateRow label={pergunta("monitor")} value={setor.checklist.monitor} disabled={!canEdit} onChange={(v) => updateChecklist(setor.id, { monitor: v })} />
                  {perguntasCustomDaSecao("Postura").map((p) => (
                    <TriStateRow key={p.slug} label={p.label} value={setor.respostas_extras?.[p.slug] ?? "nao"} disabled={!canEdit} onChange={(v) => updateRespostaExtra(setor.id, p.slug, v)} />
                  ))}

                  <div className="mt-1 border-t border-gray-200 pt-3">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Exigência de Tempo</p>
                    <TriStateRow label={pergunta("exigencia_levantamento")} value={setor.checklist.exigencia_levantamento} disabled={!canEdit} onChange={(v) => updateChecklist(setor.id, { exigencia_levantamento: v })} />
                    {perguntasCustomDaSecao("Exigência de Tempo").map((p) => (
                      <TriStateRow key={p.slug} label={p.label} value={setor.respostas_extras?.[p.slug] ?? "nao"} disabled={!canEdit} onChange={(v) => updateRespostaExtra(setor.id, p.slug, v)} />
                    ))}
                  </div>

                  <div className="border-t border-gray-200 pt-3">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Ritmo de Trabalho</p>
                    <TriStateRow label={pergunta("ritmo_por_demanda")} value={setor.checklist.ritmo_por_demanda} disabled={!canEdit} onChange={(v) => updateChecklist(setor.id, { ritmo_por_demanda: v })} />
                    {perguntasCustomDaSecao("Ritmo de Trabalho").map((p) => (
                      <TriStateRow key={p.slug} label={p.label} value={setor.respostas_extras?.[p.slug] ?? "nao"} disabled={!canEdit} onChange={(v) => updateRespostaExtra(setor.id, p.slug, v)} />
                    ))}
                  </div>

                  <div className="border-t border-gray-200 pt-3">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Adoção de Rodízios — Ergonômico</p>
                    <TriStateRow label={pergunta("pausas_formais")} value={setor.checklist.pausas_formais} disabled={!canEdit} onChange={(v) => updateChecklist(setor.id, { pausas_formais: v })} />
                    <div className="mt-2">
                      <TriStateRow label={pergunta("rodizios_sistematizados")} value={setor.checklist.rodizios_sistematizados} disabled={!canEdit} onChange={(v) => updateChecklist(setor.id, { rodizios_sistematizados: v })} />
                    </div>
                    {perguntasCustomDaSecao("Adoção de Rodízios - Ergonômico").map((p) => (
                      <div key={p.slug} className="mt-2">
                        <TriStateRow label={p.label} value={setor.respostas_extras?.[p.slug] ?? "nao"} disabled={!canEdit} onChange={(v) => updateRespostaExtra(setor.id, p.slug, v)} />
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-gray-200 pt-3">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Organização do Trabalho</p>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      {checklistPerguntas.find((p) => p.slug === "organizacao_trabalho")?.label ??
                        "As normas de produção contemplando equipamentos, modo operatório, aspectos de segurança e qualidade deverão estar descritos nas instruções internas de trabalho, elaboradas pela empresa."}
                    </p>
                  </div>
                </div>

                {/* ── Parecer, Recomendações, Demais Condições ── */}
                <div className="space-y-4">
                  {(
                    [
                      { campo: "parecer_tecnico", label: "Parecer Técnico", placeholder: "Descreva o parecer técnico para este setor..." },
                      { campo: "recomendacoes", label: "Recomendações", placeholder: "Liste as recomendações para este setor..." },
                      { campo: "demais_condicoes", label: "Demais Condições Avaliadas", placeholder: "Descreva demais condições avaliadas..." },
                    ] as const
                  ).map(({ campo, label, placeholder }) => {
                    const key = `${setor.id}:${campo}`;
                    const gerando = gerandoIA === key;
                    return (
                      <div key={campo}>
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <label className="text-xs font-bold uppercase tracking-wider text-gray-500">{label}</label>
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => gerarTextoIA(setor.id, campo)}
                              disabled={!!gerandoIA}
                              className="inline-flex items-center gap-1.5 rounded-md border border-purple-300 bg-gradient-to-r from-purple-50 to-pink-50 px-2 py-1 text-[11px] font-semibold text-purple-700 hover:from-purple-100 hover:to-pink-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {gerando ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
                              {gerando ? "Gerando…" : "Gerar com IA"}
                            </button>
                          )}
                        </div>
                        <RichTextEditor
                          value={setor[campo] as string}
                          onChange={(html) => updateSetor(setor.id, { [campo]: html })}
                          onBlur={() => {}}
                          readOnly={!canEdit}
                          uploadPathPrefix="aet-analise"
                          placeholder={placeholder}
                        />
                      </div>
                    );
                  })}
                </div>

              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

// ─── OwasGroup ────────────────────────────────────────────────────────────────

function OwasGroup({
  categoria,
  selected,
  disabled,
  onToggle,
}: {
  categoria: AetOwasCategoria;
  selected: number[];
  disabled: boolean;
  onToggle: (v: number) => void;
}) {
  const imageSrc = categoria.imagem_url ?? SLUG_TO_DEFAULT_IMAGE[categoria.slug];
  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
      <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-500">{categoria.titulo}</h4>
      <div className="flex gap-3">
        <div className="flex-1 space-y-1.5">
          {categoria.opcoes.map((opt) => (
            <label key={opt.value} className={cn("flex items-center gap-2 text-xs text-gray-700", disabled && "cursor-not-allowed opacity-60")}>
              <input
                type="checkbox"
                checked={selected.includes(opt.value)}
                disabled={disabled}
                onChange={() => onToggle(opt.value)}
                className="size-3.5 rounded border-gray-300 text-verde-primary focus:ring-verde-primary"
              />
              {opt.label}
            </label>
          ))}
        </div>
        {imageSrc && (
          <div className="w-36 shrink-0 self-start">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageSrc} alt={`Referência OWAS: ${categoria.titulo}`} className="h-auto w-full rounded border border-gray-200" />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TriStateRow ──────────────────────────────────────────────────────────────

function TriStateRow({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: RespostaChecklist;
  disabled: boolean;
  onChange: (v: RespostaChecklist) => void;
}) {
  const opts: { v: RespostaChecklist; label: string }[] = [
    { v: "sim", label: "Sim" },
    { v: "nao", label: "Não" },
    { v: "nao_aplica", label: "N/A" },
  ];
  return (
    <div className="flex items-center gap-2">
      <span className="flex-1 text-xs text-gray-700">{label}</span>
      <div className="flex shrink-0 gap-1">
        {opts.map(({ v, label: lbl }) => (
          <button
            key={v}
            type="button"
            disabled={disabled}
            onClick={() => onChange(v)}
            className={cn(
              "w-7 rounded py-0.5 text-[11px] font-semibold transition-colors",
              value === v
                ? "bg-gray-800 text-white ring-1 ring-gray-700"
                : "bg-white text-gray-400 ring-1 ring-gray-200 hover:bg-gray-50 hover:text-gray-700",
              disabled && "cursor-not-allowed opacity-60"
            )}
          >
            {lbl}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── TextInput ────────────────────────────────────────────────────────────────

function TextInput({ label, value, disabled, onChange }: { label: string; value: string; disabled: boolean; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      <input type="text" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-verde-primary focus:outline-none disabled:bg-gray-50" />
    </div>
  );
}

// ─── CargoList ────────────────────────────────────────────────────────────────

function CargoList({ cargos, disabled, onChange }: { cargos: AetCargo[]; disabled: boolean; onChange: (cargos: AetCargo[]) => void }) {
  function addCargo() { onChange([...cargos, { nome: "", descricao: "" }]); }
  function removeCargo(idx: number) { onChange(cargos.filter((_, i) => i !== idx)); }
  function updateCargo(idx: number, patch: Partial<AetCargo>) { onChange(cargos.map((c, i) => (i === idx ? { ...c, ...patch } : c))); }

  return (
    <div className="sm:col-span-2">
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-xs font-medium text-gray-600">Cargo(s)</label>
        {!disabled && (
          <button type="button" onClick={addCargo}
            className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-0.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
            <Plus className="size-3" /> Cargo
          </button>
        )}
      </div>
      {cargos.length === 0 ? (
        <p className="text-xs italic text-gray-400">{disabled ? "Nenhum cargo cadastrado." : "Clique em \"+ Cargo\" para adicionar."}</p>
      ) : (
        <div className="space-y-2">
          {cargos.map((cargo, idx) => (
            <div key={idx} className="rounded-md border border-gray-200 bg-gray-50/70 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <input type="text" value={cargo.nome} disabled={disabled} onChange={(e) => updateCargo(idx, { nome: e.target.value })}
                  placeholder="Nome do cargo"
                  className="flex-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm font-medium focus:border-verde-primary focus:outline-none disabled:bg-white" />
                {!disabled && (
                  <button type="button" onClick={() => removeCargo(idx)} className="text-red-400 hover:text-red-600">
                    <X className="size-4" />
                  </button>
                )}
              </div>
              <textarea value={cargo.descricao} disabled={disabled} rows={2} onChange={(e) => updateCargo(idx, { descricao: e.target.value })}
                placeholder="Descrição da atividade deste cargo..."
                className="w-full resize-none rounded-md border border-gray-300 px-2.5 py-1.5 text-xs focus:border-verde-primary focus:outline-none disabled:bg-white" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── TagInput ─────────────────────────────────────────────────────────────────

function TagInput({ label, value, disabled, onChange }: { label: string; value: string; disabled: boolean; onChange: (v: string) => void }) {
  const items = value ? value.split("\n").filter((s) => s.trim().length > 0) : [];
  const [input, setInput] = useState("");

  function addItem(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed || items.includes(trimmed)) return;
    onChange([...items, trimmed].join("\n"));
    setInput("");
  }

  function removeItem(idx: number) { onChange(items.filter((_, i) => i !== idx).join("\n")); }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") { e.preventDefault(); addItem(input); }
    else if (e.key === "Backspace" && !input && items.length > 0) { removeItem(items.length - 1); }
  }

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      <div className={cn("flex min-h-[38px] flex-wrap items-center gap-1.5 rounded-md border border-gray-300 px-2 py-1.5 focus-within:border-verde-primary focus-within:ring-2 focus-within:ring-verde-primary/20", disabled && "bg-gray-50")}>
        {items.map((item, idx) => (
          <span key={idx} className="inline-flex items-center gap-1 rounded-full bg-verde-light px-2.5 py-0.5 text-xs font-medium text-verde-primary">
            {item}
            {!disabled && (
              <button type="button" onClick={() => removeItem(idx)} className="text-verde-primary/50 hover:text-verde-primary">
                <X className="size-3" />
              </button>
            )}
          </span>
        ))}
        {!disabled && (
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
            onBlur={() => { if (input.trim()) addItem(input); }}
            className="flex-1 min-w-[100px] bg-transparent text-sm outline-none placeholder:text-gray-400"
            placeholder={items.length === 0 ? "Digite e pressione Enter..." : "+"} />
        )}
      </div>
    </div>
  );
}
