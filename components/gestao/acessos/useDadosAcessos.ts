"use client";

import { useMemo } from "react";
import { useEspacos, usePastas } from "@/lib/hooks/useGestao";
import {
  useEquipeMembros,
  useEquipes,
  useGestaoMembros,
  useQuadrosAcesso,
  useTodosAcessosGestao,
  useUsuariosParaMembro,
} from "@/lib/hooks/useGestaoAcesso";
import { chaveRecurso, indiceRecursos, montarArvore } from "@/lib/gestao/acessos";

/** Tudo o que as abas de Membros e acessos leem, carregado uma vez (só gestor abre o modal). */
export function useDadosAcessos(ativo: boolean) {
  const { data: espacos = [] } = useEspacos();
  const { data: pastas = [] } = usePastas();
  const { data: quadros = [] } = useQuadrosAcesso(ativo);
  const { data: acessos = [] } = useTodosAcessosGestao(ativo);
  const { data: usuarios = [] } = useUsuariosParaMembro();
  const { data: membros = [] } = useGestaoMembros();
  const { data: equipes = [] } = useEquipes();
  const { data: equipeMembros = [] } = useEquipeMembros();

  const arvore = useMemo(() => montarArvore(espacos, pastas, quadros), [espacos, pastas, quadros]);
  const indice = useMemo(() => indiceRecursos(arvore), [arvore]);
  const nomePorEmail = useMemo(() => new Map(usuarios.map((u) => [u.email.toLowerCase(), u.nome])), [usuarios]);
  const perfilPorEmail = useMemo(() => new Map(usuarios.map((u) => [u.email.toLowerCase(), u.perfil])), [usuarios]);
  const nomeEquipe = useMemo(() => new Map(equipes.map((e) => [e.id, e.nome])), [equipes]);
  const membrosAtivos = useMemo(() => new Set(membros.filter((m) => m.ativo).map((m) => m.usuario_email.toLowerCase())), [membros]);

  /** Nome e caminho de um grant; recurso apagado aparece com o id. */
  const recursoDe = (tipo: string | null | undefined, id: string | null | undefined) =>
    (tipo && id ? indice.get(chaveRecurso(tipo as "space" | "folder" | "list", id)) : undefined) ?? { nome: id ?? "?", caminho: id ?? "?", tipo: (tipo ?? "list") as "list" };

  return { arvore, indice, acessos, usuarios, equipes, equipeMembros, nomePorEmail, perfilPorEmail, nomeEquipe, membrosAtivos, recursoDe };
}

export type DadosAcessos = ReturnType<typeof useDadosAcessos>;
