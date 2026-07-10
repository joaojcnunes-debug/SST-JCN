"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Users, Fingerprint, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import EpiModal, { inputCls, labelCls } from "./EpiModal";
import {
  useEpiColaboradores,
  useSalvarColaborador,
  useExcluirColaborador,
} from "@/lib/hooks/useEpi";
import { agentDisponivel, capturarTemplate } from "@/lib/epi/biometricAgent";
import { formatCPF } from "@/lib/utils";
import type { EpiColaborador } from "@/lib/epi/types";

type FormState = Partial<EpiColaborador> & { empresa_id: string };

export default function EpiColaboradoresTab({
  empresaId,
  canEdit,
}: {
  empresaId: string;
  canEdit: boolean;
}) {
  const { data: colaboradores = [], isLoading } = useEpiColaboradores(empresaId);
  const salvar = useSalvarColaborador();
  const excluir = useExcluirColaborador();
  const [form, setForm] = useState<FormState | null>(null);
  const [confirmar, setConfirmar] = useState<EpiColaborador | null>(null);
  const [agenteOk, setAgenteOk] = useState<boolean | null>(null);
  const [bioConsent, setBioConsent] = useState(false);
  const [enrolling, setEnrolling] = useState(false);

  // Detecta o companion de biometria quando o modal abre.
  useEffect(() => {
    if (!form) return;
    setAgenteOk(null);
    setBioConsent(!!form.biometria_consentimento_em);
    let vivo = true;
    agentDisponivel().then((ok) => vivo && setAgenteOk(ok));
    return () => {
      vivo = false;
    };
  }, [form?.id, form]);

  function novo() {
    setForm({ empresa_id: empresaId, nome: "", ativo: true });
  }
  function editar(c: EpiColaborador) {
    setForm({ ...c });
  }

  async function cadastrarBiometria() {
    if (!bioConsent) {
      toast.error("Aceite o consentimento para cadastrar a biometria.");
      return;
    }
    setEnrolling(true);
    try {
      const cap = await capturarTemplate();
      const agora = new Date().toISOString();
      setForm((f) =>
        f
          ? {
              ...f,
              biometria_template: cap.template,
              biometria_cadastrada_em: agora,
              biometria_consentimento_em: agora,
            }
          : f
      );
      toast.success("Biometria cadastrada — salve o colaborador.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao cadastrar a digital.");
    } finally {
      setEnrolling(false);
    }
  }
  function submit() {
    if (!form?.nome?.trim()) return;
    salvar.mutate(
      { ...form, nome: form.nome!.trim() },
      { onSuccess: () => setForm(null) }
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          <strong>{colaboradores.length}</strong> colaborador(es)
        </p>
        {canEdit && (
          <button
            type="button"
            onClick={novo}
            className="inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-verde-accent"
          >
            <Plus className="size-4" /> Novo colaborador
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="p-6 text-center text-sm text-gray-400">Carregando…</div>
        ) : colaboradores.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center text-sm text-gray-400">
            <Users className="size-6" />
            Nenhum colaborador cadastrado.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Nome</th>
                <th className="px-4 py-2.5 text-left font-medium">CPF</th>
                <th className="px-4 py-2.5 text-left font-medium">Matrícula</th>
                <th className="px-4 py-2.5 text-left font-medium">Cargo / Setor</th>
                <th className="px-4 py-2.5 text-left font-medium">Situação</th>
                {canEdit && <th className="px-4 py-2.5 text-right font-medium">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {colaboradores.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-900">{c.nome}</td>
                  <td className="px-4 py-2.5 font-mono text-gray-700">
                    {c.cpf ? formatCPF(c.cpf) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-gray-700">{c.matricula ?? "—"}</td>
                  <td className="px-4 py-2.5 text-gray-700">
                    {[c.cargo, c.setor].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        c.ativo
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {c.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  {canEdit && (
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => editar(c)}
                          aria-label="Editar"
                          className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-verde-primary"
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmar(c)}
                          aria-label="Excluir"
                          className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {form && (
        <EpiModal
          titulo={form.id ? "Editar colaborador" : "Novo colaborador"}
          onClose={() => setForm(null)}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={labelCls}>Nome *</label>
              <input
                className={inputCls}
                value={form.nome ?? ""}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                autoFocus
              />
            </div>
            <div>
              <label className={labelCls}>CPF</label>
              <input
                className={inputCls}
                value={form.cpf ?? ""}
                onChange={(e) => setForm({ ...form, cpf: e.target.value })}
              />
            </div>
            <div>
              <label className={labelCls}>Matrícula</label>
              <input
                className={inputCls}
                value={form.matricula ?? ""}
                onChange={(e) => setForm({ ...form, matricula: e.target.value })}
              />
            </div>
            <div>
              <label className={labelCls}>Cargo</label>
              <input
                className={inputCls}
                value={form.cargo ?? ""}
                onChange={(e) => setForm({ ...form, cargo: e.target.value })}
              />
            </div>
            <div>
              <label className={labelCls}>Setor</label>
              <input
                className={inputCls}
                value={form.setor ?? ""}
                onChange={(e) => setForm({ ...form, setor: e.target.value })}
              />
            </div>
            <label className="col-span-2 flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.ativo ?? true}
                onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
              />
              Colaborador ativo
            </label>

            {/* Biometria (Fase 4D) — cadastro do template p/ verificação 1:1 */}
            <div className="col-span-2 rounded-lg border border-gray-200 p-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                  <Fingerprint className="size-4 text-verde-primary" /> Biometria
                  (digital)
                </span>
                {form.biometria_template ? (
                  <span className="text-[11px] font-medium text-green-700">
                    ✓ Cadastrada
                  </span>
                ) : (
                  <span className="text-[11px] text-gray-400">Não cadastrada</span>
                )}
              </div>
              <label className="mt-2 flex items-start gap-2 text-[11px] leading-relaxed text-gray-600">
                <input
                  type="checkbox"
                  className="mt-0.5 size-3.5 shrink-0"
                  checked={bioConsent}
                  onChange={(e) => setBioConsent(e.target.checked)}
                />
                <span>
                  Autorizo o cadastro da minha impressão digital, exclusivamente
                  para <strong>verificar minha identidade</strong> ao assinar
                  fichas de EPI. Ciente de que é guardado apenas um gabarito
                  (template) protegido, conforme a LGPD.
                </span>
              </label>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={cadastrarBiometria}
                  disabled={enrolling || !bioConsent || agenteOk === false}
                  className="inline-flex items-center gap-1.5 rounded-md border border-sky-300 bg-white px-3 py-1.5 text-xs font-semibold text-verde-accent hover:bg-sky-50 disabled:opacity-50"
                >
                  {enrolling ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" /> Encoste o
                      dedo…
                    </>
                  ) : (
                    <>
                      <Fingerprint className="size-3.5" />{" "}
                      {form.biometria_template
                        ? "Recadastrar digital"
                        : "Cadastrar digital"}
                    </>
                  )}
                </button>
              </div>
              {agenteOk === false && (
                <p className="mt-1.5 text-[11px] text-amber-700">
                  Agente de biometria não detectado neste PC. Instale o
                  “EpiBiometricAgent” e conecte o leitor.
                </p>
              )}
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setForm(null)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={salvar.isPending || !form.nome?.trim()}
              className="rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-50"
            >
              {salvar.isPending ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </EpiModal>
      )}

      {confirmar && (
        <EpiModal titulo="Remover colaborador" onClose={() => setConfirmar(null)}>
          <p className="text-sm text-gray-600">
            Remover <strong>{confirmar.nome}</strong>? Esta ação não pode ser
            desfeita.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmar(null)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() =>
                excluir.mutate(
                  { id: confirmar.id, empresa_id: empresaId },
                  { onSuccess: () => setConfirmar(null) }
                )
              }
              disabled={excluir.isPending}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {excluir.isPending ? "Removendo…" : "Remover"}
            </button>
          </div>
        </EpiModal>
      )}
    </div>
  );
}
