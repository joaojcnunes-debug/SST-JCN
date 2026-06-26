"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Save } from "lucide-react";
import toast from "react-hot-toast";
import {
  useProdUnidades,
  useProdColaboradores,
  useProdRegistros,
  useSaveRegistro,
  TIPO_COLABORADOR_LABEL,
  type ProdColaborador,
  type ProdRegistroMensal,
} from "@/lib/hooks/useProdutividade";
import { useCanEdit } from "@/lib/hooks/useUsuario";

const MESES_LABEL = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function CelulaInput({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <input
      type="number"
      min={0}
      value={value || ""}
      placeholder="0"
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      className="w-16 rounded border border-gray-200 px-2 py-1 text-center text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
    />
  );
}

function RegistroUnidade({
  idUnidade,
  mes,
  ano,
}: {
  idUnidade: string;
  mes: number;
  ano: number;
}) {
  const canEdit = useCanEdit();
  const { data: colaboradores = [], isLoading: loadC } = useProdColaboradores(idUnidade);
  const { data: registros = [], isLoading: loadR }     = useProdRegistros(idUnidade);
  const saveRegistro = useSaveRegistro();

  // Estado local de edição: { [colaboradorId]: { docs, visitas, levantamentos, ssg } }
  const [local, setLocal] = useState<
    Record<string, { docs_gerados: number; visitas_realizadas: number; levantamentos_enviados: number; docs_ssg: number }>
  >({});
  const [saving, setSaving] = useState(false);

  function getExistente(idColab: string): ProdRegistroMensal | undefined {
    return registros.find((r) => r.id_colaborador === idColab && r.mes === mes && r.ano === ano);
  }

  function getValue(idColab: string, campo: keyof typeof local[string]): number {
    if (local[idColab] !== undefined) return local[idColab][campo];
    return getExistente(idColab)?.[campo as keyof ProdRegistroMensal] as number ?? 0;
  }

  function setValue(idColab: string, campo: keyof typeof local[string], val: number) {
    setLocal((prev) => {
      const cur = prev[idColab] ?? {
        docs_gerados: getExistente(idColab)?.docs_gerados ?? 0,
        visitas_realizadas: getExistente(idColab)?.visitas_realizadas ?? 0,
        levantamentos_enviados: getExistente(idColab)?.levantamentos_enviados ?? 0,
        docs_ssg: getExistente(idColab)?.docs_ssg ?? 0,
      };
      return { ...prev, [idColab]: { ...cur, [campo]: val } };
    });
  }

  async function handleSave() {
    if (Object.keys(local).length === 0) { toast("Nenhuma alteração para salvar", { icon: "ℹ️" }); return; }
    setSaving(true);
    try {
      const promises = Object.entries(local).map(([idColab, vals]) =>
        saveRegistro.mutateAsync({
          id_unidade:   idUnidade,
          id_colaborador: idColab,
          mes,
          ano,
          ...vals,
        })
      );
      await Promise.all(promises);
      setLocal({});
      toast.success("Registros salvos!");
    } catch {
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  if (loadC || loadR) {
    return (
      <div className="flex items-center gap-2 p-4 text-xs text-gray-400">
        <Loader2 className="size-3.5 animate-spin" /> Carregando…
      </div>
    );
  }

  if (colaboradores.length === 0) {
    return (
      <p className="p-4 text-xs text-gray-400 italic">
        Nenhum colaborador cadastrado nesta unidade. Acesse <strong>Unidades e Equipe</strong> para adicionar.
      </p>
    );
  }

  // Totais
  const totalDocs    = colaboradores.reduce((s, c) => s + getValue(c.id, "docs_gerados"), 0);
  const totalVisitas = colaboradores.reduce((s, c) => s + getValue(c.id, "visitas_realizadas"), 0);
  const totalLev     = colaboradores.reduce((s, c) => s + getValue(c.id, "levantamentos_enviados"), 0);
  const totalSsg     = colaboradores.reduce((s, c) => s + getValue(c.id, "docs_ssg"), 0);

  const temAlteracao = Object.keys(local).length > 0;

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-[11px] uppercase text-gray-400">
              <th className="px-4 py-2.5 text-left">Colaborador</th>
              <th className="px-4 py-2.5 text-left">Função</th>
              <th className="px-4 py-2.5 text-center">Docs Gerados</th>
              <th className="px-4 py-2.5 text-center">Visitas</th>
              <th className="px-4 py-2.5 text-center">Levantamentos</th>
              <th className="px-4 py-2.5 text-center">Docs SSG</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {colaboradores.map((c: ProdColaborador) => (
              <tr key={c.id} className="hover:bg-gray-50/50">
                <td className="px-4 py-2.5 font-medium text-gray-800">{c.nome}</td>
                <td className="px-4 py-2.5 text-xs text-gray-500">{TIPO_COLABORADOR_LABEL[c.tipo]}</td>
                <td className="px-4 py-2.5 text-center">
                  <CelulaInput value={getValue(c.id, "docs_gerados")} onChange={(v) => setValue(c.id, "docs_gerados", v)} disabled={!canEdit} />
                </td>
                <td className="px-4 py-2.5 text-center">
                  <CelulaInput value={getValue(c.id, "visitas_realizadas")} onChange={(v) => setValue(c.id, "visitas_realizadas", v)} disabled={!canEdit} />
                </td>
                <td className="px-4 py-2.5 text-center">
                  <CelulaInput value={getValue(c.id, "levantamentos_enviados")} onChange={(v) => setValue(c.id, "levantamentos_enviados", v)} disabled={!canEdit} />
                </td>
                <td className="px-4 py-2.5 text-center">
                  <CelulaInput value={getValue(c.id, "docs_ssg")} onChange={(v) => setValue(c.id, "docs_ssg", v)} disabled={!canEdit} />
                </td>
              </tr>
            ))}
            {/* Totais */}
            <tr className="border-t-2 border-gray-200 bg-gray-50 text-xs font-semibold text-gray-600">
              <td className="px-4 py-2 uppercase tracking-wide text-gray-400" colSpan={2}>Total da unidade</td>
              <td className="px-4 py-2 text-center">{totalDocs}</td>
              <td className="px-4 py-2 text-center">{totalVisitas}</td>
              <td className="px-4 py-2 text-center">{totalLev}</td>
              <td className="px-4 py-2 text-center">{totalSsg}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {canEdit && (
        <div className="flex justify-end border-t border-gray-100 px-4 py-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !temAlteracao}
            className="flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-40"
          >
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            Salvar registros
          </button>
        </div>
      )}
    </div>
  );
}

export default function RegistrosPage() {
  const today = new Date();
  const [mes, setMes]   = useState(today.getMonth() + 1);
  const [ano, setAno]   = useState(today.getFullYear());

  const { data: unidades = [], isLoading } = useProdUnidades();

  function prevMes() {
    if (mes === 1) { setMes(12); setAno((a) => a - 1); }
    else setMes((m) => m - 1);
  }
  function nextMes() {
    if (mes === 12) { setMes(1); setAno((a) => a + 1); }
    else setMes((m) => m + 1);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Registros Mensais</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Registre a produtividade real de cada colaborador por mês
          </p>
        </div>
        {/* Navegador mês/ano */}
        <div className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 shadow-sm ring-1 ring-black/5">
          <button type="button" onClick={prevMes} className="rounded p-1 hover:bg-gray-100">
            <ChevronLeft className="size-4 text-gray-500" />
          </button>
          <p className="min-w-[140px] text-center text-sm font-bold text-gray-800">
            {MESES_LABEL[mes - 1]} de {ano}
          </p>
          <button type="button" onClick={nextMes} className="rounded p-1 hover:bg-gray-100">
            <ChevronRight className="size-4 text-gray-500" />
          </button>
        </div>
      </div>

      <div className="rounded-xl bg-white p-4 text-xs text-gray-500 ring-1 ring-black/5 shadow-sm">
        <p>
          <strong>Como usar:</strong> Preencha os valores realizados por cada colaborador no mês selecionado.
          Os campos aceitam apenas números inteiros. Clique em <strong>Salvar registros</strong> ao final de cada unidade.
        </p>
        <div className="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-4">
          {[
            { campo: "Docs Gerados",     desc: "Documentos SST finalizados" },
            { campo: "Visitas",          desc: "Visitas técnicas realizadas" },
            { campo: "Levantamentos",    desc: "Levantamentos enviados ao SST JCN Consultoria" },
            { campo: "Docs SSG",         desc: "Documentos enviados ao SSG" },
          ].map((i) => (
            <div key={i.campo}>
              <span className="font-semibold text-gray-700">{i.campo}:</span> {i.desc}
            </div>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 className="size-4 animate-spin" /> Carregando unidades…
        </div>
      )}

      {!isLoading && unidades.length === 0 && (
        <div className="rounded-xl bg-white p-10 text-center shadow-sm ring-1 ring-black/5">
          <p className="text-sm text-gray-500">
            Nenhuma unidade cadastrada. Acesse <strong>Unidades e Equipe</strong> primeiro.
          </p>
        </div>
      )}

      {unidades.map((u) => (
        <div key={u.id} className="rounded-xl bg-white shadow-sm ring-1 ring-black/5 overflow-hidden">
          <div className="border-b border-gray-100 bg-gray-50 px-5 py-3">
            <h2 className="font-semibold text-gray-800">{u.nome}</h2>
            {u.cidade && <p className="text-xs text-gray-400">{u.cidade}</p>}
          </div>
          <RegistroUnidade idUnidade={u.id} mes={mes} ano={ano} />
        </div>
      ))}
    </div>
  );
}
