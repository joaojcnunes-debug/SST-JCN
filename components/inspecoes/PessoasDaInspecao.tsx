"use client";

// Responsável e Associados da lista de Inspeções no formato da Gestão (0.3.304, 19/11/2026 — pedido do João):
// só as fotos/iniciais em círculos, nome ao passar o mouse, "+N" quando passa do limite. Clicando, abre a caixinha
// com os nomes; o supervisor troca o responsável e associa/tira gente ali mesmo (antes: lápis + janela).

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import AlocadosCompactos, { type PessoaAlocada } from "@/components/gestao/AlocadosCompactos";
import {
  useAssociarUsuario,
  useDesassociarUsuario,
  useUsuariosParaAssociar,
} from "@/lib/hooks/useInspecaoAssociados";
import { useCurrentUser } from "@/lib/hooks/useUsuario";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Inspecao, InspecaoAssociado } from "@/lib/supabase/types";

const mesmoNome = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Técnicos/Admins ativos (nome) — quem pode ser o responsável da inspeção. */
function useTecnicosAtivos(habilitado: boolean) {
  return useQuery({
    queryKey: ["usuarios-tecnicos"],
    enabled: habilitado,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("usuarios")
        .select("nome, perfil, ativo_sistema")
        .in("perfil", ["Admin", "Tecnico"])
        .order("nome");
      if (error) throw error;
      return ((data ?? []) as Array<{ nome: string; ativo_sistema: boolean | null }>)
        .filter((u) => u.ativo_sistema !== false && (u.nome ?? "").trim())
        .map((u) => u.nome.trim());
    },
  });
}

/** Coluna Responsável: o técnico da inspeção num círculo; o supervisor troca pela caixinha. */
export function ResponsavelCelula({ insp, podeEditar, campo }: { insp: Inspecao; podeEditar: boolean; campo?: string | null }) {
  const qc = useQueryClient();
  const { data: tecnicos = [] } = useTecnicosAtivos(podeEditar);
  const atual = insp.responsavel?.trim() ?? "";

  const salvar = useMutation({
    mutationFn: async (responsavel: string) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("inspecoes")
        .update({ responsavel, updated_at: new Date().toISOString() } as never)
        .eq("id_inspecao", insp.id_inspecao);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inspecoes-lista"] });
      qc.invalidateQueries({ queryKey: ["inspecoes-tecnico"] });
      qc.invalidateQueries({ queryKey: ["inspecoes-por-mes"] });
      qc.invalidateQueries({ queryKey: ["dashboard-concluidas-detalhe"] });
      qc.invalidateQueries({ queryKey: ["inspecao", insp.id_inspecao] });
      toast.success("Responsável atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pessoas: PessoaAlocada[] = atual
    ? [{ nome: atual, tiravel: false, nota: campo ? `campo: ${campo}` : null }]
    : [];
  // O combobox trabalha com {nome, email}: aqui o "email" é o próprio nome (inspecoes.responsavel guarda o nome).
  const opcoes = tecnicos.filter((t) => !mesmoNome(t, atual)).map((t) => ({ nome: t, email: t }));

  return (
    <AlocadosCompactos
      pessoas={pessoas}
      rotulo={`Responsável da inspeção ${insp.id_inspecao}`}
      titulo="Responsável"
      textoVazio="Sem responsável."
      textoAdicionar={atual ? "Trocar" : "Definir"}
      dicaVazio="Definir o responsável"
      podeEditar={podeEditar}
      usuarios={opcoes}
      onAdicionar={(nome) => salvar.mutate(nome)}
      ocupado={salvar.isPending}
      max={1}
    />
  );
}

/**
 * Coluna Associados: quem elabora o documento (tabela inspecao_associados) + quem assumiu pelo fluxo de status
 * (elaboracao_responsavel), como antes. Tirar o responsável do documento limpa também o nome dele (mesma regra
 * do bloco Associados da inspeção).
 */
export function AssociadosCelula({
  insp,
  associados,
  podeEditar,
}: {
  insp: Inspecao;
  associados: InspecaoAssociado[];
  podeEditar: boolean;
}) {
  const qc = useQueryClient();
  const user = useCurrentUser();
  const { data: usuarios = [] } = useUsuariosParaAssociar();
  const associar = useAssociarUsuario();
  const desassociar = useDesassociarUsuario();

  const resp = insp.elaboracao_responsavel?.trim() ?? "";
  const ehResponsavel = (nome: string) => !!resp && mesmoNome(nome, resp);
  const emailDe = (idUsuario: string) => usuarios.find((u) => u.id_usuario === idUsuario)?.email ?? null;
  const limpar = { status: insp.elaboracao_status ?? null, concluidaEm: insp.elaboracao_concluida_em ?? null };

  const pessoas: PessoaAlocada[] = associados.map((a) => ({
    nome: a.nome,
    email: emailDe(a.id_usuario),
    chave: `assoc:${a.id}`,
    nota: ehResponsavel(a.nome) ? "assumiu o documento" : null,
  }));
  if (resp && !associados.some((a) => mesmoNome(a.nome, resp))) {
    pessoas.push({ nome: resp, chave: "resp", nota: "assumiu o documento" });
  }

  const jaAssociados = new Set(associados.map((a) => a.id_usuario));
  // Mesmo truque do Responsável: o "email" do combobox leva o id_usuario.
  const opcoes = usuarios.filter((u) => !jaAssociados.has(u.id_usuario)).map((u) => ({ nome: u.nome, email: u.id_usuario }));

  function tirar(chave: string) {
    const a = chave.startsWith("assoc:") ? associados.find((x) => x.id === chave.slice(6)) : null;
    const limparResp = chave === "resp" || (a ? ehResponsavel(a.nome) : false);
    desassociar.mutate(
      { id_inspecao: insp.id_inspecao, id: a?.id ?? null, limparResponsavel: limparResp ? limpar : null },
      // Tirar o responsável muda a própria inspeção (elaboracao_*), não só os associados.
      { onSuccess: () => { if (limparResp) qc.invalidateQueries({ queryKey: ["inspecoes-lista"] }); } },
    );
  }

  function adicionar(idUsuario: string) {
    const u = usuarios.find((x) => x.id_usuario === idUsuario);
    if (!u) return;
    associar.mutate({ id_inspecao: insp.id_inspecao, id_usuario: u.id_usuario, nome: u.nome, created_by: user?.nome ?? null });
  }

  return (
    <AlocadosCompactos
      pessoas={pessoas}
      rotulo={`Associados da inspeção ${insp.id_inspecao}`}
      titulo="Associados"
      textoVazio="Ninguém associado."
      textoAdicionar="Associar"
      dicaVazio="Associar alguém"
      podeEditar={podeEditar}
      usuarios={opcoes}
      onAdicionar={adicionar}
      onTirar={tirar}
      ocupado={associar.isPending || desassociar.isPending}
    />
  );
}
