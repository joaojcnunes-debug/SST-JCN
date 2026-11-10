import type { ModuloPermitido, Usuario } from "@/lib/supabase/types";
import { TODOS_MODULOS } from "@/lib/supabase/types";

/**
 * Permissões POR MÓDULO (pedido de 09/11/2026, 1ª etapa): no cadastro de usuário, cada módulo tem Visualizar, Criar,
 * Editar e Excluir, e a pessoa só faz o que estiver marcado.
 *
 *  - Visualizar = o módulo em `modulos_permitidos` (o mesmo de sempre: `useRequireModule` e a RLS de leitura).
 *  - Criar/Editar/Excluir = `usuarios.permissoes_modulos` (jsonb, v345), `{ "<modulo>": { criar, editar, excluir } }`,
 *    mais a entrada `geral` = as telas fora dos módulos que consultam essas permissões (Empresas e Validades).
 *    Conta sem a coluna preenchida (NULL — todas as antigas até alguém salvar no cadastro novo) usa as chaves gerais
 *    `pode_criar`/`pode_editar`/`pode_excluir` em todos os módulos e fora deles, como antes. Com a coluna preenchida,
 *    só vale o que estiver marcado.
 *  - As chaves gerais continuam gravadas como "pode em algum lugar" (`flagsGerais`: `geral` + módulos que vê): é o
 *    que as funções do banco que as leem (EPI, equipamentos, grupo de empresas…) consultam. A 2ª etapa leva a
 *    checagem por módulo para o banco.
 *  - Pedido do usuário ao publicar: ninguém pode perder acesso. Salvar uma conta sem mexer na grade grava o mesmo
 *    que ela já tinha (módulos e `geral`), e o teste "conta antiga" confere que a regra nova dá o mesmo que a antiga.
 *
 * Módulo **puro** (sem React/Next), testado em `permissoes-modulo.test.ts`; os hooks ficam em `lib/hooks/useUsuario.ts`.
 */

export type AcaoModulo = "criar" | "editar" | "excluir";
export const ACOES_MODULO: AcaoModulo[] = ["criar", "editar", "excluir"];
export type AcoesDoModulo = Record<AcaoModulo, boolean>;
/** As telas fora dos módulos que consultam Criar/Editar/Excluir: Empresas e Validades. */
export const GERAL = "geral" as const;
export type LinhaGrade = ModuloPermitido | typeof GERAL;
export type PermissoesModulos = Partial<Record<LinhaGrade, AcoesDoModulo>>;
export type GradeModulos = Record<LinhaGrade, AcoesDoModulo>;

type UsuarioComPermissoes = Pick<
  Usuario,
  "perfil" | "modulos_permitidos" | "pode_criar" | "pode_editar" | "pode_excluir" | "permissoes_modulos"
>;

export const NENHUMA_ACAO: AcoesDoModulo = { criar: false, editar: false, excluir: false };

/** Módulos que são só entrada, sem o que criar/editar/excluir: Transferências = poder transferir entre bases. */
export const MODULOS_SO_ACESSO: readonly ModuloPermitido[] = ["transferencias"];

/** As três caixas de uma linha (módulo ou `geral`) para a conta, sem olhar Visualizar nem perfil. */
export function acoesDoModulo(user: UsuarioComPermissoes, linha: LinhaGrade): AcoesDoModulo {
  if (!user.permissoes_modulos) {
    return { criar: user.pode_criar === true, editar: user.pode_editar === true, excluir: user.pode_excluir === true };
  }
  const p = user.permissoes_modulos[linha];
  return p ? { criar: p.criar === true, editar: p.editar === true, excluir: p.excluir === true } : NENHUMA_ACAO;
}

/**
 * A conta pode fazer `acao` no módulo? Admin sempre pode (como nos hooks de antes). `modulo` nulo = tela fora dos
 * módulos (Empresas, Validades): vale a linha `geral`. Lista = tela de mais de um módulo (a Sinalização): basta poder
 * em um que a conta veja.
 */
export function podeNoModulo(
  user: UsuarioComPermissoes | null | undefined,
  modulo: ModuloPermitido | readonly ModuloPermitido[] | null,
  acao: AcaoModulo,
): boolean {
  if (!user) return false;
  if (user.perfil === "Admin") return true;
  if (!modulo) return acoesDoModulo(user, GERAL)[acao];
  const permitidos = user.modulos_permitidos ?? [];
  const lista: readonly ModuloPermitido[] = typeof modulo === "string" ? [modulo] : modulo;
  return lista.some((m) => permitidos.includes(m) && acoesDoModulo(user, m)[acao]);
}

// ─── Cadastro ────────────────────────────────────────────────────────────────
// Na grade do cadastro, módulo sem Visualizar fica com as três ações desmarcadas, sempre: marcar só o Visualizar
// de um módulo novo não traz Criar/Editar de carona. A linha `geral` não depende de Visualizar.

/** Zera as ações dos módulos sem Visualizar (e dos que são só entrada); `geral` fica como está. */
export function normalizarGrade(modulos: readonly string[], grade: GradeModulos): GradeModulos {
  const out = Object.fromEntries(
    TODOS_MODULOS.map((m) => [
      m,
      modulos.includes(m) && !MODULOS_SO_ACESSO.includes(m) ? { ...(grade[m] ?? NENHUMA_ACAO) } : { ...NENHUMA_ACAO },
    ]),
  ) as GradeModulos;
  out[GERAL] = { ...(grade[GERAL] ?? NENHUMA_ACAO) };
  return out;
}

/** A grade da conta para o cadastro: o que ela tem hoje em cada módulo que vê e em Empresas/Validades. */
export function gradeDaConta(user: UsuarioComPermissoes): GradeModulos {
  const crua = Object.fromEntries(
    [...TODOS_MODULOS, GERAL].map((l) => [l, acoesDoModulo(user, l)]),
  ) as GradeModulos;
  return normalizarGrade(user.modulos_permitidos ?? [], crua);
}

/** Conta nova pelo perfil, ou padrão da função: cada chave definida vale em todas as linhas; `null` mantém. */
export function gradeComChaves(
  modulos: readonly string[],
  base: GradeModulos | null,
  chaves: Partial<Record<AcaoModulo, boolean | null>>,
): GradeModulos {
  const crua = Object.fromEntries(
    [...TODOS_MODULOS, GERAL].map((l) => [
      l,
      {
        criar: chaves.criar ?? base?.[l]?.criar ?? false,
        editar: chaves.editar ?? base?.[l]?.editar ?? false,
        excluir: chaves.excluir ?? base?.[l]?.excluir ?? false,
      },
    ]),
  ) as GradeModulos;
  return normalizarGrade(modulos, crua);
}

export type ColunaGrade = "ver" | AcaoModulo;
export const TODAS_AS_COLUNAS: ColunaGrade[] = ["ver", "criar", "editar", "excluir"];

/**
 * Marca ou desmarca colunas de uma lista de linhas. Marcar Criar/Editar/Excluir de um módulo marca o Visualizar
 * junto; tirar o Visualizar limpa os três. `geral` só tem as três ações. `modulos` pode trazer módulos que não
 * existem mais (46 contas têm "inventario_maquinas"): ficam como estão.
 */
export function marcarNaGrade<T extends string>(
  modulos: readonly T[],
  grade: GradeModulos,
  alvo: readonly LinhaGrade[],
  colunas: readonly ColunaGrade[],
  valor: boolean,
): { modulos: T[]; grade: GradeModulos } {
  const vistos = new Set<string>(modulos);
  const nova = { ...grade };
  for (const l of alvo) {
    const acoes = { ...(nova[l] ?? NENHUMA_ACAO) };
    if (valor) {
      if (l !== GERAL) vistos.add(l);
      for (const c of colunas) if (c !== "ver") acoes[c] = true;
    } else if (colunas.includes("ver") && l !== GERAL) {
      vistos.delete(l);
    } else {
      for (const c of colunas) if (c !== "ver") acoes[c] = false;
    }
    nova[l] = acoes;
  }
  const novos = alvo.filter(
    (l): l is ModuloPermitido => l !== GERAL && vistos.has(l) && !(modulos as readonly string[]).includes(l),
  );
  const lista = [...modulos.filter((m) => vistos.has(m)), ...novos] as T[];
  return { modulos: lista, grade: normalizarGrade(lista, nova) };
}

/** O que o cadastro grava: os módulos com Visualizar marcado e a linha `geral`. */
export function permissoesParaGravar(modulosPermitidos: readonly string[], grade: GradeModulos): PermissoesModulos {
  const out: PermissoesModulos = {};
  for (const m of TODOS_MODULOS) {
    if (!modulosPermitidos.includes(m)) continue;
    const a = grade[m] ?? NENHUMA_ACAO;
    out[m] = { criar: a.criar, editar: a.editar, excluir: a.excluir };
  }
  const g = grade[GERAL] ?? NENHUMA_ACAO;
  out[GERAL] = { criar: g.criar, editar: g.editar, excluir: g.excluir };
  return out;
}

/** As chaves gerais derivadas da grade: "pode em algum lugar" (Empresas/Validades ou um módulo que vê). */
export function flagsGerais(
  modulosPermitidos: readonly string[],
  grade: GradeModulos,
): { pode_criar: boolean; pode_editar: boolean; pode_excluir: boolean } {
  const linhas: LinhaGrade[] = [GERAL, ...TODOS_MODULOS.filter((m) => modulosPermitidos.includes(m))];
  const algum = (acao: AcaoModulo) => linhas.some((l) => grade[l]?.[acao] === true);
  return { pode_criar: algum("criar"), pode_editar: algum("editar"), pode_excluir: algum("excluir") };
}

// ─── Módulo da tela ──────────────────────────────────────────────────────────

/**
 * Primeiro pedaço do endereço → módulo da tela. Espelha o `useRequireModule(...)` do layout de cada grupo de rotas
 * (o teste confere contra o disco: pasta nova num grupo de módulo sem entrada aqui quebra o teste).
 */
export const MODULO_DA_ROTA: Readonly<Record<string, ModuloPermitido | readonly ModuloPermitido[]>> = {
  // app/(app) — Painel SST
  acoes: "painel",
  "aep-psicossocial": "painel",
  certificados: "painel",
  dashboard: "painel",
  inspecoes: "painel",
  relatorios: "painel",
  "riscos-psicossociais": "painel",
  "texto-padrao": "painel",
  aep: "aep",
  aet: "aet",
  "analise-quimicos": "analise_quimicos",
  "apreciacao-maquinas": "apreciacao_maquinas",
  comercial: "comercial",
  "comercial-matriz-aiha": "comercial",
  "relatorio-conformidade": "conformidade",
  "consolidacao-grupo": "consolidacao_psicossocial",
  dimensionamento: "dimensionamento",
  epi: "epi",
  equipamentos: "equipamentos",
  escala: "escala_supervisores",
  frota: "frota",
  "gestao-gerencial": "gestao_gerencial",
  "investigacao-acidente": "investigacao_acidente",
  "relatorio-nao-conformidade": "nao_conformidade",
  psicossocial: "psicossocial",
  "questionarios-psicossociais": "questionarios_psicossociais",
  "sinalizacao-matriz-aiha": ["aep", "psicossocial"],
  "sinalizacao-psicossocial": ["aep", "psicossocial"],
};

export function moduloDaRota(pathname: string): ModuloPermitido | readonly ModuloPermitido[] | null {
  const primeiro = pathname.split("/")[1] ?? "";
  return Object.prototype.hasOwnProperty.call(MODULO_DA_ROTA, primeiro) ? MODULO_DA_ROTA[primeiro] : null;
}
