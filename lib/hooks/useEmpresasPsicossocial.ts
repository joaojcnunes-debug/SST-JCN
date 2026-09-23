"use client";

// Empresas que têm trabalho do PSICOSSOCIAL — e só elas.
//
// Pedido dos psicólogos em 2026-09-10: puxar o documento de uma empresa sem a
// inspeção de segurança vir junto. Este hook é metade da resposta; a outra é a
// régua em `lib/psicossocial/documentos.ts`.
//
// 🔑 A trava é POR CONSTRUÇÃO, não por filtro: este arquivo consulta
// `drps_relatorios` e `qps_aplicacoes`. Não existe consulta a `inspecoes` aqui,
// nem a nenhuma outra tabela de módulo. Não há como uma inspeção aparecer —
// não por engano, não por configuração trocada depois.
//
// Medido em 2026-09-10, antes de escrever: 772 empresas no cadastro, **137**
// com relatório DRPS e 21 com aplicação de questionário. Ou seja: a lista desta
// tela nasce com ~140 empresas em vez de 772 — 82% do cadastro é ruído para
// quem trabalha no psicossocial.

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// `qps_*` não está nos tipos gerados do Supabase (mesmo motivo em
// `useQpsResumo`), e `drps_relatorios` exige cast nas escritas. Um cliente
// solto para as duas leituras evita espalhar `as never` por linha.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db() { return createSupabaseBrowserClient() as any; }

export interface RelatorioDrpsDaEmpresa {
  id: string;
  revisao: number | null;
  status: string | null;
  dataElaboracao: string | null;
  responsavel: string | null;
  atualizadoEm: string | null;
}

export interface AplicacaoQpsDaEmpresa {
  id: string;
  titulo: string;
  status: string | null;
  atualizadoEm: string | null;
}

export interface EmpresaPsicossocial {
  idEmpresa: string;
  nome: string;
  cnpj: string | null;
  municipio: string | null;
  uf: string | null;
  drps: RelatorioDrpsDaEmpresa[];
  questionarios: AplicacaoQpsDaEmpresa[];
  /** Data mais recente entre relatórios e aplicações — ordena a lista. */
  ultimaAtividade: string | null;
}

function maisRecente(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

export function useEmpresasPsicossocial() {
  return useQuery({
    queryKey: ["empresas-psicossocial"],
    staleTime: 60_000,
    queryFn: async (): Promise<EmpresaPsicossocial[]> => {
      const sb = db();

      // DELETADO é exclusão suave nas duas tabelas: fica no banco e não deve
      // aparecer. `DELETADA` existe em outros módulos e entra na conta por
      // segurança — custa nada e evita fantasma.
      const [drpsRes, qpsRes] = await Promise.all([
        sb
          .from("drps_relatorios")
          // ⚠️ `drps_relatorios` NÃO TEM `titulo`. Conferido lendo as colunas
          // reais da tabela em 10/09, depois de a tela quebrar com
          // `42703 column drps_relatorios.titulo does not exist`: o relatório
          // DRPS é identificado por REVISÃO + data, não por título — é assim
          // que o Dashboard Geral sempre mostrou ("Rev. 1 · 08/09/2026").
          // O repo referencia `r.titulo` em `useDrps` (rótulo da lixeira) num
          // `as string` que sempre foi `undefined` e cai no fallback; foi de lá
          // que veio meu palpite errado. O cliente é `any`, então `tsc` não
          // pega nada disso: nome de coluna só se prova consultando.
          .select("id_relatorio, id_empresa, revisao, status, data_elaboracao, responsavel_tecnico, updated_at, created_at")
          .order("updated_at", { ascending: false, nullsFirst: false }),
        sb
          .from("qps_aplicacoes")
          .select("id_aplicacao, id_empresa, titulo, status, criado_em, atualizado_em")
          .order("criado_em", { ascending: false }),
      ]);
      if (drpsRes.error) throw drpsRes.error;
      if (qpsRes.error) throw qpsRes.error;

      const apagado = (s: unknown) => s === "DELETADO" || s === "DELETADA";

      interface LinhaDrps {
        id_relatorio: string; id_empresa: string;
        revisao: number | null; status: string | null; data_elaboracao: string | null;
        responsavel_tecnico: string | null; updated_at: string | null; created_at: string | null;
      }
      interface LinhaQps {
        id_aplicacao: string; id_empresa: string; titulo: string;
        status: string | null; criado_em: string; atualizado_em: string | null;
      }

      const drps = ((drpsRes.data ?? []) as LinhaDrps[]).filter((r) => !apagado(r.status));
      const qps = ((qpsRes.data ?? []) as LinhaQps[]).filter((a) => !apagado(a.status));

      const porEmpresa = new Map<string, EmpresaPsicossocial>();
      const vazia = (id: string): EmpresaPsicossocial => ({
        idEmpresa: id, nome: "—", cnpj: null, municipio: null, uf: null,
        drps: [], questionarios: [], ultimaAtividade: null,
      });

      for (const r of drps) {
        if (!r.id_empresa) continue;
        const e = porEmpresa.get(r.id_empresa) ?? vazia(r.id_empresa);
        e.drps.push({
          id: r.id_relatorio,
          revisao: r.revisao,
          status: r.status,
          dataElaboracao: r.data_elaboracao,
          responsavel: r.responsavel_tecnico,
          atualizadoEm: r.updated_at ?? r.created_at,
        });
        e.ultimaAtividade = maisRecente(e.ultimaAtividade, r.updated_at ?? r.created_at);
        porEmpresa.set(r.id_empresa, e);
      }

      for (const a of qps) {
        if (!a.id_empresa) continue;
        const e = porEmpresa.get(a.id_empresa) ?? vazia(a.id_empresa);
        e.questionarios.push({
          id: a.id_aplicacao,
          titulo: a.titulo,
          status: a.status,
          atualizadoEm: a.atualizado_em ?? a.criado_em,
        });
        e.ultimaAtividade = maisRecente(e.ultimaAtividade, a.atualizado_em ?? a.criado_em);
        porEmpresa.set(a.id_empresa, e);
      }

      // Nomes: só das empresas citadas. O cadastro tem 772 e não faz sentido
      // trazer inteiro — nem deixar a tela mostrar empresa sem nome.
      const ids = [...porEmpresa.keys()];
      if (ids.length > 0) {
        const { data: emps } = await sb
          .from("empresas")
          .select("id_empresa, nome_empresa, razao_social, cnpj, municipio, uf")
          .in("id_empresa", ids);
        interface LinhaEmpresa {
          id_empresa: string; nome_empresa: string | null; razao_social: string | null;
          cnpj: string | null; municipio: string | null; uf: string | null;
        }
        for (const emp of (emps ?? []) as LinhaEmpresa[]) {
          const e = porEmpresa.get(emp.id_empresa);
          if (!e) continue;
          e.nome = emp.nome_empresa || emp.razao_social || "—";
          e.cnpj = emp.cnpj;
          e.municipio = emp.municipio;
          e.uf = emp.uf;
        }
      }

      // Empresa cujo cadastro não respondeu continua na lista, com "—" no
      // nome: o documento existe, e sumir com ele seria pior que mostrá-lo sem
      // nome. Ordena pelo trabalho mais recente.
      return [...porEmpresa.values()].sort((a, b) => {
        const ta = a.ultimaAtividade ? new Date(a.ultimaAtividade).getTime() : 0;
        const tb = b.ultimaAtividade ? new Date(b.ultimaAtividade).getTime() : 0;
        return tb - ta;
      });
    },
  });
}
