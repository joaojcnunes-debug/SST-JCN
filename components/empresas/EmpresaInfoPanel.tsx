"use client";

import type { Empresa } from "@/lib/supabase/types";
import {
  formatCNPJ,
  formatCPF,
  formatCEI,
  formatCAEPF,
  formatCNO,
  formatCEP,
  formatTelefone,
  cn,
} from "@/lib/utils";
import { montarEnderecoEmpresa } from "@/lib/textos-padrao/variaveis";

export type GrupoEmpresa = "identificacao" | "endereco" | "contatos" | "responsaveis";

export interface ResponsaveisEmpresa {
  /** Responsável técnico (vem do relatório, não da empresa). */
  tecnico?: string | null;
  formacao?: string | null;
  registro?: string | null;
  /** Responsável pela empresa (vem do relatório). */
  empresa?: string | null;
}

interface Props {
  empresa: Empresa | null | undefined;
  /** Grupos a exibir. "responsaveis" só aparece se `responsaveis` for passado. */
  grupos?: GrupoEmpresa[];
  variante?: "completo" | "compacto";
  responsaveis?: ResponsaveisEmpresa;
  className?: string;
}

const VAZIO = "Não informado";
const ouVazio = (v: string | null | undefined) => (v && v.trim() ? v : VAZIO);

/** Identificador principal da empresa (o primeiro preenchido). */
function identificadores(e: Empresa): { label: string; valor: string }[] {
  const out: { label: string; valor: string }[] = [];
  if (e.cnpj) out.push({ label: "CNPJ", valor: formatCNPJ(e.cnpj) });
  if (e.cpf) out.push({ label: "CPF", valor: formatCPF(e.cpf) });
  if (e.cei) out.push({ label: "CEI", valor: formatCEI(e.cei) });
  if (e.caepf) out.push({ label: "CAEPF", valor: formatCAEPF(e.caepf) });
  if (e.cno) out.push({ label: "CNO", valor: formatCNO(e.cno) });
  if (out.length === 0) out.push({ label: "CNPJ", valor: VAZIO });
  return out;
}

function Campo({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{label}</p>
      <p className="truncate text-sm text-gray-900" title={valor}>{valor}</p>
    </div>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-verde-primary">{titulo}</p>
      <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">{children}</div>
    </div>
  );
}

/**
 * Painel padronizado de dados da empresa (somente tela). Reutilizável em todos
 * os cards. Não altera PDF/assinatura (que seguem com CabecalhoLaudo/variáveis).
 */
export default function EmpresaInfoPanel({
  empresa,
  grupos = ["identificacao", "endereco", "contatos"],
  variante = "completo",
  responsaveis,
  className,
}: Props) {
  if (!empresa) {
    return (
      <div className={cn("rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500", className)}>
        {VAZIO}
      </div>
    );
  }

  const cnae = [empresa.cnae_principal, empresa.cnae_descricao].filter(Boolean).join(" — ");
  const endereco = montarEnderecoEmpresa(empresa);

  if (variante === "compacto") {
    const ident = identificadores(empresa)[0];
    const local = [empresa.municipio, empresa.uf].filter(Boolean).join("/");
    return (
      <div className={cn("min-w-0", className)}>
        <p className="truncate text-sm font-semibold text-gray-900">{ouVazio(empresa.nome_empresa)}</p>
        <p className="truncate text-xs text-gray-500">
          {ident.label}: {ident.valor}
          {local ? ` · ${local}` : ""}
        </p>
      </div>
    );
  }

  const mostrarResp = grupos.includes("responsaveis") && responsaveis;

  return (
    <div className={cn("space-y-4", className)}>
      {grupos.includes("identificacao") && (
        <Grupo titulo="Identificação">
          <Campo label="Razão social" valor={ouVazio(empresa.razao_social)} />
          <Campo label="Nome fantasia" valor={ouVazio(empresa.nome_empresa)} />
          {identificadores(empresa).map((id) => (
            <Campo key={id.label} label={id.label} valor={id.valor} />
          ))}
          <Campo label="CNAE / atividade" valor={ouVazio(cnae)} />
          <Campo label="Grau de risco" valor={empresa.grau_risco != null ? String(empresa.grau_risco) : VAZIO} />
        </Grupo>
      )}

      {grupos.includes("endereco") && (
        <Grupo titulo="Endereço">
          <div className="sm:col-span-2">
            <Campo label="Endereço completo" valor={endereco || VAZIO} />
          </div>
          <Campo label="Município / UF" valor={ouVazio([empresa.municipio, empresa.uf].filter(Boolean).join(" / "))} />
          <Campo label="CEP" valor={formatCEP(empresa.cep)} />
        </Grupo>
      )}

      {mostrarResp && (
        <Grupo titulo="Responsáveis">
          <Campo
            label="Responsável técnico"
            valor={
              [responsaveis!.tecnico, responsaveis!.formacao, responsaveis!.registro]
                .filter(Boolean)
                .join(" — ") || VAZIO
            }
          />
          <Campo label="Responsável da empresa" valor={ouVazio(responsaveis!.empresa)} />
        </Grupo>
      )}

      {grupos.includes("contatos") && (
        <Grupo titulo="Contatos">
          <Campo label="Telefone" valor={formatTelefone(empresa.telefone)} />
          <Campo label="E-mail" valor={ouVazio(empresa.email)} />
        </Grupo>
      )}
    </div>
  );
}
