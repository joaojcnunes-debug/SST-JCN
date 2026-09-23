"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowLeftRight,
  Search,
  Loader2,
  FileDown,
  X,
  Package,
  CheckSquare,
  Square,
  Inbox,
  Check,
  Ban,
  PenLine,
} from "lucide-react";
import toast from "react-hot-toast";
import { useInventarioMaquinas } from "@/lib/hooks/useInventarioMaquinas";
import {
  useTransferencias,
  useCriarTransferenciaPendente,
  useUsuariosDestino,
  useAceitarTransferencia,
  useRecusarTransferencia,
  useCancelarTransferencia,
  type Transferencia,
} from "@/lib/hooks/useTransferencias";
import { useUnidades } from "@/lib/hooks/useUnidades";
import { useCurrentUser, useIsAdmin } from "@/lib/hooks/useUsuario";
import { categoriaInventario } from "@/lib/inventario/categorias";
import AssinaturaAceiteModal from "@/components/inventario-maquinas/AssinaturaAceiteModal";
import type { Maquina } from "@/lib/supabase/types";

function fmtDataHora(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  pendente: { label: "Pendente", cls: "bg-amber-100 text-amber-700" },
  aceita: { label: "Aceita", cls: "bg-emerald-100 text-emerald-700" },
  recusada: { label: "Recusada", cls: "bg-red-100 text-red-700" },
  cancelada: { label: "Cancelada", cls: "bg-gray-100 text-gray-600" },
};

const inputCls =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

export default function TransferenciaPage() {
  const user = useCurrentUser();
  const isAdmin = useIsAdmin();
  const podeTransferir = isAdmin || (user?.modulos_permitidos ?? []).includes("transferencias");
  const meuEmail = (user?.email ?? "").toLowerCase();

  const { data: maquinas = [] } = useInventarioMaquinas();
  const { data: unidades = [] } = useUnidades();
  const { data: transferencias = [], isLoading: loadingHist } = useTransferencias();
  const criar = useCriarTransferenciaPendente();
  const aceitar = useAceitarTransferencia();
  const recusar = useRecusarTransferencia();
  const cancelar = useCancelarTransferencia();

  // Só equipamentos (material interno da JCN Consultoria) são transferíveis.
  const equipamentos = useMemo(
    () => maquinas.filter((m) => categoriaInventario(m) === "equipamentos"),
    [maquinas],
  );

  // Destino: todas as bases, mesmo as ainda sem equipamento. O painel exclui
  // daqui o cadastro "Conselho/Conselheiro" (particularidade da Chabra), que
  // não existe no JCN.
  const unidadesDestino = unidades;

  // ── Registro (cria PENDENTE) ─────────────────────────────────────────────────
  const [busca, setBusca] = useState("");
  const [sel, setSel] = useState<Maquina | null>(null);
  const [paraIdUnidade, setParaIdUnidade] = useState("");
  const [destinatarioEmail, setDestinatarioEmail] = useState("");
  const [paraLocal, setParaLocal] = useState("");
  const [motivo, setMotivo] = useState("");
  const [obs, setObs] = useState("");

  const { data: destinatarios = [], isLoading: loadingDest } = useUsuariosDestino(paraIdUnidade || null);

  const encontrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return [];
    return equipamentos
      .filter((m) =>
        [m.nome, m.id_maquina, m.codigo_interno, m.tag, m.modelo]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(q)),
      )
      .slice(0, 8);
  }, [equipamentos, busca]);

  function limparForm() {
    setSel(null);
    setBusca("");
    setParaIdUnidade("");
    setDestinatarioEmail("");
    setParaLocal("");
    setMotivo("");
    setObs("");
  }

  async function handleRegistrar() {
    if (!sel) return toast.error("Selecione o equipamento a transferir.");
    if (!paraIdUnidade) return toast.error("Escolha a unidade de destino.");
    const dest = destinatarios.find((d) => (d.email ?? "").toLowerCase() === destinatarioEmail);
    if (!dest || !dest.email) return toast.error("Escolha quem vai aceitar a transferência no destino.");
    const uni = unidades.find((u) => u.id_unidade === paraIdUnidade);
    try {
      await criar.mutateAsync({
        maquina: sel,
        para_id_unidade: paraIdUnidade,
        para_unidade: uni?.nome ?? "",
        para_usuario_email: dest.email,
        para_usuario_nome: dest.nome ?? dest.email,
        para_localizacao: paraLocal.trim() || null,
        motivo: motivo.trim() || null,
        observacoes: obs.trim() || null,
      });
      toast.success("Transferência enviada — aguardando aceite no destino");
      limparForm();
    } catch {
      /* toast tratado no hook */
    }
  }

  // ── Caixa de aceite (pendentes para MIM) ─────────────────────────────────────
  const pendentesParaMim = useMemo(
    () =>
      transferencias.filter(
        (t) =>
          t.status === "pendente" &&
          (isAdmin || (t.para_usuario_email ?? "").toLowerCase() === meuEmail),
      ),
    [transferencias, isAdmin, meuEmail],
  );

  const [assinando, setAssinando] = useState<Transferencia | null>(null);

  async function handleRecusar(t: Transferencia) {
    const m = window.prompt("Motivo da recusa (opcional):", "");
    if (m === null) return; // cancelou o prompt
    try {
      await recusar.mutateAsync({ id: t.id_transferencia, motivo: m });
      toast.success("Transferência recusada");
    } catch { /* hook */ }
  }

  async function handleCancelar(t: Transferencia) {
    if (!window.confirm(`Cancelar a transferência de "${t.maquina_nome ?? ""}"?`)) return;
    try {
      await cancelar.mutateAsync({ id: t.id_transferencia });
      toast.success("Transferência cancelada");
    } catch { /* hook */ }
  }

  // ── Histórico + PDF ──────────────────────────────────────────────────────────
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const todasMarcadas = transferencias.length > 0 && selecionadas.size === transferencias.length;

  function toggle(id: string) {
    setSelecionadas((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function toggleTodas() {
    setSelecionadas((prev) =>
      prev.size === transferencias.length ? new Set() : new Set(transferencias.map((t) => t.id_transferencia)),
    );
  }
  function gerarPdf() {
    if (selecionadas.size === 0) return toast.error("Selecione ao menos uma transferência.");
    const ids = Array.from(selecionadas).join(",");
    window.open(`/api/pdf/transferencias?ids=${encodeURIComponent(ids)}`, "_blank");
  }

  const souCriador = (t: Transferencia) => (t.responsavel_email ?? "").toLowerCase() === meuEmail;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/inventario-maquinas"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-verde-primary"
        >
          <ArrowLeft className="size-3.5" /> Inventário
        </Link>
      </div>

      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
          <ArrowLeftRight className="size-5 text-blue-600" />
          Transferência de Equipamentos
        </h1>
        <p className="text-sm text-gray-600">
          Envie um equipamento interno para outra base. A transferência só se efetiva
          quando o destinatário <strong>aceita e assina</strong> o recebimento.
        </p>
      </div>

      {/* ── Caixa de aceite: pendentes para mim ── */}
      {pendentesParaMim.length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-amber-700">
            <Inbox className="size-4" /> Aguardando seu aceite ({pendentesParaMim.length})
          </h2>
          <ul className="space-y-2">
            {pendentesParaMim.map((t) => (
              <li key={t.id_transferencia} className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-white p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900">{t.maquina_nome ?? "—"}</p>
                  <p className="text-xs text-gray-500">
                    {[t.maquina_codigo_interno, t.maquina_tag, t.maquina_modelo].filter(Boolean).join(" · ") || "—"}
                  </p>
                  <p className="mt-1 text-xs text-gray-600">
                    <span className="text-gray-400">{t.de_unidade ?? "origem"}</span>
                    <span className="mx-1 text-blue-500">→</span>
                    <span className="font-medium">{t.para_unidade ?? "destino"}</span>
                    {t.responsavel_nome ? <span className="text-gray-400"> · enviado por {t.responsavel_nome}</span> : null}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => setAssinando(t)}
                    className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
                  >
                    <Check className="size-4" /> Aceitar e assinar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRecusar(t)}
                    disabled={recusar.isPending}
                    className="inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Ban className="size-4" /> Recusar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Registrar transferência (cria pendente) ── */}
      {podeTransferir && (
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-gray-600">
            Enviar equipamento para outra base
          </h2>

          {!sel ? (
            <div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="search"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar equipamento por nome, ID, código interno, tag ou modelo..."
                  className={`${inputCls} pl-9`}
                />
              </div>
              {busca.trim() && (
                <ul className="mt-2 divide-y divide-gray-100 rounded-md border border-gray-200">
                  {encontrados.length === 0 ? (
                    <li className="px-3 py-2 text-sm text-gray-500">Nenhum equipamento encontrado.</li>
                  ) : (
                    encontrados.map((m) => (
                      <li key={m.id_maquina}>
                        <button
                          type="button"
                          onClick={() => setSel(m)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-blue-50"
                        >
                          <Package className="size-4 shrink-0 text-blue-500" />
                          <span className="font-medium text-gray-900">{m.nome}</span>
                          <span className="text-xs text-gray-500">
                            {[m.codigo_interno, m.tag, m.modelo].filter(Boolean).join(" · ")}
                          </span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Equipamento selecionado */}
              <div className="flex items-start justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50/50 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{sel.nome}</p>
                  <p className="text-xs text-gray-600">
                    {[sel.codigo_interno && `Cód. ${sel.codigo_interno}`, sel.tag && `TAG ${sel.tag}`, sel.modelo, sel.numero_serie && `Série ${sel.numero_serie}`]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    <strong>Base atual:</strong>{" "}
                    {sel.unidade || "não definida"}
                    {sel.localizacao ? ` · ${sel.localizacao}` : ""}
                  </p>
                </div>
                <button type="button" onClick={() => setSel(null)} className="shrink-0 rounded p-1 text-gray-400 hover:bg-white hover:text-gray-600">
                  <X className="size-4" />
                </button>
              </div>

              {/* Destino: unidade + destinatário (seletores) */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Campo label="Para — Base de destino *">
                  <select
                    value={paraIdUnidade}
                    onChange={(e) => { setParaIdUnidade(e.target.value); setDestinatarioEmail(""); }}
                    className={inputCls}
                  >
                    <option value="">— Selecione a base —</option>
                    {unidadesDestino
                      .filter((u) => u.id_unidade !== sel.id_unidade) // não transferir para a mesma base
                      .map((u) => (
                        <option key={u.id_unidade} value={u.id_unidade}>{u.nome}</option>
                      ))}
                  </select>
                </Campo>
                <Campo label="Quem vai aceitar no destino *">
                  <select
                    value={destinatarioEmail}
                    onChange={(e) => setDestinatarioEmail(e.target.value)}
                    disabled={!paraIdUnidade || loadingDest}
                    className={inputCls}
                  >
                    <option value="">
                      {!paraIdUnidade ? "Escolha a base primeiro" : loadingDest ? "Carregando..." : "— Selecione o destinatário —"}
                    </option>
                    {destinatarios.map((d) => (
                      <option key={d.email} value={(d.email ?? "").toLowerCase()}>
                        {d.nome ?? d.email}
                      </option>
                    ))}
                  </select>
                  {paraIdUnidade && !loadingDest && destinatarios.length === 0 && (
                    <span className="mt-1 block text-[11px] text-amber-600">
                      Nenhum usuário cadastrado nessa base além de você. Um admin pode aceitar.
                    </span>
                  )}
                </Campo>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Campo label="Localização no destino">
                  <input type="text" value={paraLocal} onChange={(e) => setParaLocal(e.target.value)} placeholder="Ex: Sala técnica" className={inputCls} />
                </Campo>
                <Campo label="Motivo">
                  <input type="text" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex: Empréstimo, realocação..." className={inputCls} />
                </Campo>
                <Campo label="Observações">
                  <input type="text" value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Detalhes adicionais" className={inputCls} />
                </Campo>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-3">
                <button type="button" onClick={limparForm} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleRegistrar}
                  disabled={criar.isPending}
                  className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {criar.isPending ? <Loader2 className="size-4 animate-spin" /> : <ArrowLeftRight className="size-4" />}
                  Enviar para aceite
                </button>
              </div>
              <p className="text-[11px] text-gray-400">
                O equipamento só muda de base quando o destinatário aceitar e assinar. Até lá, permanece na base atual.
              </p>
            </div>
          )}
        </section>
      )}

      {/* ── Registro de transferências (histórico) ── */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-600">
            Registro de transferências
          </h2>
          <button
            type="button"
            onClick={gerarPdf}
            disabled={selecionadas.size === 0}
            className="inline-flex items-center gap-1.5 rounded-md border border-blue-300 bg-white px-3 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-40"
          >
            <FileDown className="size-4" /> Gerar PDF{selecionadas.size > 0 ? ` (${selecionadas.size})` : ""}
          </button>
        </div>

        {loadingHist ? (
          <div className="flex items-center justify-center py-8 text-gray-500">
            <Loader2 className="size-4 animate-spin" />
          </div>
        ) : transferencias.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
            Nenhuma transferência registrada ainda.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wider text-gray-500">
                  <th className="w-8 py-2">
                    <button type="button" onClick={toggleTodas} className="text-gray-500 hover:text-blue-600" title="Selecionar tudo">
                      {todasMarcadas ? <CheckSquare className="size-4" /> : <Square className="size-4" />}
                    </button>
                  </th>
                  <th className="py-2 pr-3">Equipamento</th>
                  <th className="py-2 pr-3">De → Para</th>
                  <th className="py-2 pr-3">Situação</th>
                  <th className="py-2 pr-3">Data / hora</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transferencias.map((t) => {
                  const marcada = selecionadas.has(t.id_transferencia);
                  const de = t.de_unidade || t.de_localizacao || "—";
                  const para = t.para_unidade || t.para_localizacao || "—";
                  const st = STATUS_META[t.status ?? "aceita"] ?? STATUS_META.aceita;
                  return (
                    <tr key={t.id_transferencia} className={marcada ? "bg-blue-50/50" : undefined}>
                      <td className="py-2">
                        <button type="button" onClick={() => toggle(t.id_transferencia)} className="text-gray-500 hover:text-blue-600">
                          {marcada ? <CheckSquare className="size-4 text-blue-600" /> : <Square className="size-4" />}
                        </button>
                      </td>
                      <td className="py-2 pr-3">
                        <p className="font-medium text-gray-900">{t.maquina_nome ?? "—"}</p>
                        <p className="text-xs text-gray-500">
                          {[t.maquina_codigo_interno, t.maquina_tag, t.maquina_modelo].filter(Boolean).join(" · ")}
                        </p>
                      </td>
                      <td className="py-2 pr-3 text-xs text-gray-600">
                        <span className="text-gray-400">{de}</span>
                        <span className="mx-1 text-blue-500">→</span>
                        <span className="font-medium text-gray-800">{para}</span>
                      </td>
                      <td className="py-2 pr-3">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.cls}`}>
                          {st.label}
                        </span>
                        {t.assinado_em ? (
                          <span className="ml-1 inline-flex items-center gap-0.5 text-[10px] text-emerald-600" title={`Assinado por ${t.assinante_nome ?? ""}`}>
                            <PenLine className="size-3" /> assinada
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap text-xs text-gray-600">{fmtDataHora(t.data_hora)}</td>
                      <td className="py-2 text-right">
                        {t.status === "pendente" && (isAdmin || souCriador(t)) && (
                          <button
                            type="button"
                            onClick={() => handleCancelar(t)}
                            disabled={cancelar.isPending}
                            className="rounded border border-gray-300 bg-white px-2 py-0.5 text-[11px] font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                          >
                            Cancelar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Modal de assinatura do aceite ── */}
      {assinando && (
        <AssinaturaAceiteModal
          transferencia={assinando}
          pending={aceitar.isPending}
          onConfirmar={async (png) => {
            try {
              await aceitar.mutateAsync({ id: assinando.id_transferencia, assinaturaPng: png });
              toast.success("Recebimento confirmado — equipamento transferido");
              setAssinando(null);
            } catch { /* hook */ }
          }}
          onFechar={() => setAssinando(null)}
        />
      )}
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-600">{label}</span>
      {children}
    </label>
  );
}
