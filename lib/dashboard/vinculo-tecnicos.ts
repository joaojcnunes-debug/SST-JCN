/**
 * O PLANO de gravar o vínculo entre o técnico digitado e a conta do painel.
 *
 * ─── Por que isto existe ───────────────────────────────────────────────────
 *
 * Hoje `responsaveis.tecnico_responsavel` é texto digitado na recepção do
 * cliente, e quem é essa pessoa é **recalculado a cada abertura de tela** por
 * `canonicalizarTecnico`. Funciona — cobre 41 das 43 grafias — mas a contagem
 * do dashboard depende, para sempre, de acertar um texto que gente digita à
 * mão. Grafia nova amanhã escapa de novo, e ninguém percebe.
 *
 * Gravar `id_usuario` troca isso por um fato: a partir da gravação, quem é o
 * técnico não é mais uma dedução, é um dado.
 *
 * ─── A decisão de desenho que importa ──────────────────────────────────────
 *
 * A REGRA NÃO É REESCRITA AQUI, e muito menos em SQL. Este arquivo chama
 * `canonicalizarTecnico` — a mesma função que a tela usa, com os mesmos testes.
 * A alternativa seria um backfill em SQL reimplementando casamento por conjunto
 * de palavras, e essa casa já pagou esse preço: a mesma conta copiada em quatro
 * telas divergiu em duas ([[qps-resposta-orfa-zona-divergente]]). Migration que
 * repete regra é a mesma armadilha com outro nome.
 *
 * Por isso o SQL da v204 só CRIA A COLUNA. Quem decide o conteúdo é este
 * arquivo, rodando por `scripts/vincular-responsaveis.mjs`.
 *
 * ─── O que ele se recusa a fazer ───────────────────────────────────────────
 *
 * Não liga nada que a regra não afirme. Nome ambíguo e nome de fora do painel
 * ficam **sem vínculo, com o motivo à mostra** — porque os dois casos são
 * diferentes e pedem coisas diferentes: um pede decisão de gente, o outro já
 * está certo assim (técnico de unidade sem login continua sendo o técnico).
 * Ver a mesma disciplina em `lib/dashboard/tecnicos.ts`.
 */

import { APELIDOS, candidatosDoTecnico, canonicalizarTecnico, normalizarNome } from "./tecnicos";

export interface UsuarioDoCadastro {
  id_usuario: string;
  nome: string;
}

export interface LinhaResponsavel {
  id_responsavel: string;
  tecnico_responsavel: string | null;
  /** Já preenchido por uma execução anterior, ou pela tela. */
  id_usuario?: string | null;
}

export type MotivoSemVinculo =
  /** Campo em branco no documento. Não há o que ligar. */
  | "vazio"
  /** Vários cadastros casam. A regra recusa — precisa de gente. */
  | "ambiguo"
  /** Nenhum cadastro casa: pessoa real sem login no painel. */
  | "fora_do_painel"
  /** O nome canônico existe, mas não achei o usuário dele na lista. */
  | "cadastro_incompleto";

export interface Ligacao {
  id_responsavel: string;
  id_usuario: string;
  digitado: string;
  cadastro: string;
  /** true quando veio da tabela de apelidos (decisão humana), não da regra. */
  porApelido: boolean;
}

export interface SemVinculo {
  id_responsavel: string;
  digitado: string;
  motivo: MotivoSemVinculo;
  /** Nos ambíguos, quem disputou — é o que a pessoa precisa ver para decidir. */
  candidatos?: string[];
}

export interface PlanoVinculo {
  ligar: Ligacao[];
  semVinculo: SemVinculo[];
  /** Linhas que já tinham vínculo e não são tocadas. Roda de novo sem estragar. */
  jaVinculadas: number;
}

/**
 * @param linhas    as linhas de `responsaveis`
 * @param cadastro  usuários do painel com `perfil <> 'Cliente'` — a MESMA lista
 *                  que o dashboard usa (ver `fetchNomesDoCadastro`). Mudar o
 *                  recorte aqui faria o gravado divergir do que a tela mostra.
 */
export function planejarVinculo(
  linhas: readonly LinhaResponsavel[],
  cadastro: readonly UsuarioDoCadastro[],
): PlanoVinculo {
  const nomes = cadastro.map((u) => u.nome);
  const porNome = new Map(cadastro.map((u) => [normalizarNome(u.nome), u]));

  const ligar: Ligacao[] = [];
  const semVinculo: SemVinculo[] = [];
  let jaVinculadas = 0;

  for (const linha of linhas) {
    if (linha.id_usuario) {
      jaVinculadas++;
      continue;
    }

    const digitado = (linha.tecnico_responsavel ?? "").trim();
    const canonico = canonicalizarTecnico(digitado, nomes);

    if (canonico === null) {
      semVinculo.push({ id_responsavel: linha.id_responsavel, digitado, motivo: "vazio" });
      continue;
    }

    const usuario = porNome.get(normalizarNome(canonico));
    if (usuario) {
      ligar.push({
        id_responsavel: linha.id_responsavel,
        id_usuario: usuario.id_usuario,
        digitado,
        cadastro: usuario.nome,
        porApelido: APELIDOS[normalizarNome(digitado)] !== undefined,
      });
      continue;
    }

    // `canonicalizarTecnico` devolveu o texto original: ou disputou, ou não
    // casou com ninguém. Os dois motivos pedem coisas diferentes de quem lê.
    const candidatos = candidatosDoTecnico(digitado, nomes);
    if (candidatos.length > 1) {
      semVinculo.push({
        id_responsavel: linha.id_responsavel,
        digitado,
        motivo: "ambiguo",
        candidatos,
      });
    } else if (candidatos.length === 0) {
      semVinculo.push({
        id_responsavel: linha.id_responsavel,
        digitado,
        motivo: "fora_do_painel",
      });
    } else {
      // Um candidato só, mas o nome dele não está no mapa: só acontece se a
      // lista de cadastro tiver nome repetido ou vazio. Não inventa vínculo.
      semVinculo.push({
        id_responsavel: linha.id_responsavel,
        digitado,
        motivo: "cadastro_incompleto",
      });
    }
  }

  return { ligar, semVinculo, jaVinculadas };
}

/** Contagem por motivo, para o relatório do script não recontar na mão. */
export function resumirSemVinculo(
  semVinculo: readonly SemVinculo[],
): Record<MotivoSemVinculo, number> {
  const out: Record<MotivoSemVinculo, number> = {
    vazio: 0,
    ambiguo: 0,
    fora_do_painel: 0,
    cadastro_incompleto: 0,
  };
  for (const s of semVinculo) out[s.motivo]++;
  return out;
}

/**
 * A conta do painel de UM nome digitado, ou `null` quando não dá para afirmar.
 *
 * ─── Por que ela existe (Fase B1, 2026-09-10) ──────────────────────────────
 *
 * `planejarVinculo` resolve um LOTE — serve para o script que preencheu as 536
 * linhas de uma vez. O que faltava era o caso de UMA linha, na hora em que
 * alguém digita o nome na tela: sem isso, toda inspeção nova nascia com
 * `id_usuario` vazio e a coluna gravada em 10/09 ia virando fotografia velha.
 * Medido no mesmo dia: entram ~155 linhas por mês com nome digitado.
 *
 * ─── E por que ela mora AQUI ───────────────────────────────────────────────
 *
 * Porque são QUATRO as portas que criam linha em `responsaveis` (inspeção
 * nova, cópia da inspeção base, cópia para outra empresa, e o form da aba
 * Responsáveis). Se cada uma resolvesse o nome do seu jeito, seriam quatro
 * cópias da mesma regra — e esta casa já pagou esse preço. Ela chama
 * `canonicalizarTecnico`, a MESMA função da tela e do script.
 *
 * Herda a recusa de lá, e isso é o principal: nome ambíguo devolve o texto
 * original, que não casa com cadastro nenhum, e sai `null`. Técnico de unidade
 * sem login no painel também sai `null` — e continua sendo o técnico, com o
 * nome escrito na linha. `null` aqui NUNCA quer dizer "não é técnico"; quer
 * dizer "não dá para afirmar de qual conta é".
 */
export function contaDoTecnicoDigitado(
  digitado: string | null | undefined,
  usuarios: readonly UsuarioDoCadastro[],
): string | null {
  const texto = (digitado ?? "").trim();
  if (!texto) return null;

  const canonico = canonicalizarTecnico(
    texto,
    usuarios.map((u) => u.nome),
  );
  if (!canonico) return null;

  const alvo = normalizarNome(canonico);
  const casam = usuarios.filter((u) => normalizarNome(u.nome ?? "") === alvo);
  // Dois cadastros com o MESMO nome: a regra não tem como escolher, e chutar
  // creditaria trabalho na pessoa errada. Fica sem vínculo, de propósito.
  if (casam.length !== 1) return null;
  return casam[0].id_usuario ?? null;
}
