"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Cog, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { useEmpresas } from "@/lib/hooks/useEmpresas";
import { useInventarioMaquinas } from "@/lib/hooks/useInventarioMaquinas";
import { useCriarApreciacaoMaquina } from "@/lib/hooks/useApreciacoesMaquinas";
import { useRequireCreate } from "@/lib/hooks/useUsuario";
import { useUserStore } from "@/lib/store";
import { CATALOGO_NR12 } from "@/lib/apreciacao-maquinas/catalogo-nr12";

export default function NovaApreciacaoPage() {
  useRequireCreate("/apreciacao-maquinas");
  const router = useRouter();
  const user = useUserStore((s) => s.user);
  const { data: empresas = [] } = useEmpresas();
  const { data: maquinas = [] } = useInventarioMaquinas();
  const criar = useCriarApreciacaoMaquina();

  const [idEmpresa, setIdEmpresa] = useState<string>("");
  const [idMaquina, setIdMaquina] = useState<string>(""); // "" = sem inventário
  const [maquinaDescricao, setMaquinaDescricao] = useState("");
  const [titulo, setTitulo] = useState("");
  const [setor, setSetor] = useState("");
  const [responsavel, setResponsavel] = useState(user?.nome ?? "");
  const [responsavelEmpresa, setResponsavelEmpresa] = useState("");
  const [cidade, setCidade] = useState("");
  const [dataApreciacao, setDataApreciacao] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });

  // Filtra máquinas pela empresa selecionada (mais máquinas Chabra sem empresa).
  const maquinasFiltradas = useMemo(() => {
    if (!idEmpresa) return [] as typeof maquinas;
    return maquinas.filter(
      (m) => m.id_empresa === idEmpresa || m.id_empresa === null
    );
  }, [maquinas, idEmpresa]);

  // Reset máquina se trocar empresa
  function handleEmpresaChange(v: string) {
    setIdEmpresa(v);
    setIdMaquina("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!idEmpresa) {
      toast.error("Selecione a empresa.");
      return;
    }
    if (!idMaquina && !maquinaDescricao.trim()) {
      toast.error("Selecione uma máquina do inventário ou descreva a máquina.");
      return;
    }
    try {
      const row = await criar.mutateAsync({
        id_empresa: idEmpresa,
        id_maquina: idMaquina || null,
        maquina_descricao: idMaquina ? null : maquinaDescricao.trim(),
        titulo: titulo.trim() || null,
        setor: setor.trim() || null,
        responsavel: responsavel.trim() || null,
        responsavel_empresa: responsavelEmpresa.trim() || null,
        cidade: cidade.trim() || null,
        data_apreciacao: dataApreciacao || null,
      });
      toast.success("Apreciação criada — checklist NR-12 snapshotado");
      router.push(`/apreciacao-maquinas/${row.id_apreciacao}`);
    } catch (err) {
      console.error(err);
      toast.error("Falha ao criar apreciação");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/apreciacao-maquinas"
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-verde-primary"
      >
        <ArrowLeft className="size-3.5" /> Voltar
      </Link>

      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
          <Cog className="size-5 text-orange-600" />
          Nova apreciação NR-12
        </h1>
        <p className="text-sm text-gray-600">
          Preencha os dados do laudo. Ao criar, o checklist da NR-12 é gerado
          automaticamente com <strong>{CATALOGO_NR12.length}</strong> itens
          agrupados por categoria, prontos pra avaliação.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
      >
        <Campo label="Empresa *" htmlFor="empresa">
          <select
            id="empresa"
            value={idEmpresa}
            onChange={(e) => handleEmpresaChange(e.target.value)}
            required
            className={inputClass}
          >
            <option value="">Selecione...</option>
            {empresas.map((e) => (
              <option key={e.id_empresa} value={e.id_empresa}>
                {e.nome_empresa}
              </option>
            ))}
          </select>
        </Campo>

        <div className="rounded-md border border-gray-200 bg-gray-50 p-3 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-600">
            Máquina avaliada *
          </p>
          <Campo label="Vincular do inventário" htmlFor="maquina">
            <select
              id="maquina"
              value={idMaquina}
              onChange={(e) => setIdMaquina(e.target.value)}
              disabled={!idEmpresa}
              className={inputClass}
            >
              <option value="">
                {idEmpresa
                  ? "— sem vínculo, descrever abaixo —"
                  : "Selecione uma empresa primeiro"}
              </option>
              {maquinasFiltradas.map((m) => (
                <option key={m.id_maquina} value={m.id_maquina}>
                  {m.nome}
                  {m.modelo ? ` (${m.modelo})` : ""}
                  {m.id_empresa === null ? " — Chabra" : ""}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Ou descreva a máquina" htmlFor="desc">
            <input
              id="desc"
              type="text"
              value={maquinaDescricao}
              onChange={(e) => setMaquinaDescricao(e.target.value)}
              disabled={!!idMaquina}
              placeholder={
                idMaquina
                  ? "(máquina selecionada acima)"
                  : "Ex: Prensa Hidráulica 50t, marca XYZ, série 12345"
              }
              className={inputClass}
            />
          </Campo>
        </div>

        <Campo label="Título do laudo" htmlFor="titulo">
          <input
            id="titulo"
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex: Apreciação Prensa Hidráulica setor B - jan/2026"
            className={inputClass}
          />
        </Campo>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo label="Setor" htmlFor="setor">
            <input
              id="setor"
              type="text"
              value={setor}
              onChange={(e) => setSetor(e.target.value)}
              placeholder="Ex: Produção, Manutenção"
              className={inputClass}
            />
          </Campo>
          <Campo label="Cidade" htmlFor="cidade">
            <input
              id="cidade"
              type="text"
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              className={inputClass}
            />
          </Campo>
          <Campo label="Responsável técnico (Chabra)" htmlFor="resp">
            <input
              id="resp"
              type="text"
              value={responsavel}
              onChange={(e) => setResponsavel(e.target.value)}
              className={inputClass}
            />
          </Campo>
          <Campo label="Responsável da empresa" htmlFor="respe">
            <input
              id="respe"
              type="text"
              value={responsavelEmpresa}
              onChange={(e) => setResponsavelEmpresa(e.target.value)}
              className={inputClass}
            />
          </Campo>
          <Campo label="Data da apreciação" htmlFor="data">
            <input
              id="data"
              type="date"
              value={dataApreciacao}
              onChange={(e) => setDataApreciacao(e.target.value)}
              className={inputClass}
            />
          </Campo>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={criar.isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {criar.isPending && <Loader2 className="size-4 animate-spin" />}
            Criar apreciação
          </button>
        </div>
      </form>
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:bg-gray-50 disabled:text-gray-500";

function Campo({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-600">
        {label}
      </span>
      {children}
    </label>
  );
}
