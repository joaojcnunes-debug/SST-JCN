"use client";

import { AlertTriangle, Building2, Info } from "lucide-react";
import { formatCNPJ } from "@/lib/utils";
import type { Duplicatas, EmpresaComparavel } from "@/lib/empresas/duplicatas";

interface Props<T extends EmpresaComparavel> {
  duplicatas: Duplicatas<T>;
  nomeUnidade: (id: string | null | undefined) => string;
  /** Clicar numa empresa listada: usar a existente em vez de cadastrar. */
  onUsar: (empresa: T) => void;
  /** Só quando há mesmo código: a pessoa insiste em cadastrar. */
  cadastrarMesmoAssim: boolean;
  onCadastrarMesmoAssim: (v: boolean) => void;
}

/**
 * Painel que aparece DENTRO do formulário de empresa enquanto a pessoa digita:
 * "esta empresa já existe — quer usar a que está lá?". É a trava contra o
 * cadastro em duplicidade (21 grupos de CNPJ repetido na base em 21/09/2026).
 */
export default function AlertaEmpresaDuplicada<T extends EmpresaComparavel>({
  duplicatas: d,
  nomeUnidade,
  onUsar,
  cadastrarMesmoAssim,
  onCadastrarMesmoAssim,
}: Props<T>) {
  if (d.mesmoCodigo.length === 0 && d.mesmoNome.length === 0 && d.parecidas.length === 0) return null;

  // Uma empresa chegou a ter 29 cópias: listar todas viraria uma parede. As
  // 5 primeiras bastam para "usar a existente"; o resto vira um número.
  const TETO = 5;
  const Sobra = ({ total }: { total: number }) =>
    total > TETO ? <li className="py-1 text-xs opacity-80">… e mais {total - TETO} iguais a estas.</li> : null;

  const Linha = ({ e, acao }: { e: T; acao: string }) => (
    <li className="flex flex-wrap items-center justify-between gap-2 py-1.5">
      <span className="flex min-w-0 items-center gap-2">
        <Building2 className="size-4 shrink-0 opacity-60" />
        <span className="min-w-0">
          <span className="block truncate font-medium">{e.nome_empresa}</span>
          <span className="block text-xs opacity-80">
            {e.cnpj ? formatCNPJ(e.cnpj) : e.cpf ? `CPF ${e.cpf}` : "sem CNPJ"} · {nomeUnidade(e.id_unidade)}
          </span>
        </span>
      </span>
      <button
        type="button"
        onClick={() => onUsar(e)}
        className="shrink-0 rounded-md border border-current/30 bg-white/70 px-2.5 py-1 text-xs font-semibold hover:bg-white"
      >
        {acao}
      </button>
    </li>
  );

  return (
    <div className="space-y-2">
      {d.mesmoCodigo.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="size-4" />
            Esta empresa já está cadastrada com este {d.mesmoCodigo.some((e) => e.cnpj) ? "CNPJ" : "CPF"}
          </p>
          <ul className="mt-1 divide-y divide-red-100">
            {d.mesmoCodigo.slice(0, TETO).map((e) => <Linha key={e.id_empresa} e={e} acao="Usar esta empresa" />)}
            <Sobra total={d.mesmoCodigo.length} />
          </ul>
          <label className="mt-2 flex items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={cadastrarMesmoAssim}
              onChange={(ev) => onCadastrarMesmoAssim(ev.target.checked)}
              className="mt-0.5 rounded border-red-300 text-red-600 focus:ring-red-300"
            />
            <span>
              Sei que é a mesma empresa e quero cadastrar de novo mesmo assim
              <span className="block opacity-75">Fica registrado na Auditoria. Se ela só não aparece na sua lista, é a Unidade — não um cadastro que faltou.</span>
            </span>
          </label>
        </div>
      )}

      {d.mesmoNome.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="size-4" />
            Já existe empresa com este mesmo nome
            <span className="font-normal opacity-80">— se for filial (outro CNPJ), pode seguir</span>
          </p>
          <ul className="mt-1 divide-y divide-amber-100">
            {d.mesmoNome.slice(0, TETO).map((e) => <Linha key={e.id_empresa} e={e} acao="Usar esta" />)}
            <Sobra total={d.mesmoNome.length} />
          </ul>
        </div>
      )}

      {d.parecidas.length > 0 && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
          <p className="flex items-center gap-2 font-semibold">
            <Info className="size-4" />
            Parecidas já cadastradas
          </p>
          <ul className="mt-1 divide-y divide-sky-100">
            {d.parecidas.map((e) => <Linha key={e.id_empresa} e={e} acao="Usar esta" />)}
          </ul>
        </div>
      )}
    </div>
  );
}
