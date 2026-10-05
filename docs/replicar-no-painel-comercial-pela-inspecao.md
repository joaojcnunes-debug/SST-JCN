# Replicar no Painel SST: Comercial também pela inspeção, e inspeção em largura total

> **Como usar:** abra o Claude Code na pasta do **painel-sst** e diga:
> *"Siga o arquivo `replicar-no-painel-comercial-pela-inspecao.md`"*.
>
> Origem: JCN (`sst-jcn`), commit `a2bfac6` de 2026-10-05, já em produção lá.
> **Tem 1 migration** (v268, seção A): substitui a função `comercial_dados()`.

## Pré-requisito

Aplique antes o MD `replicar-no-painel-modulo-comercial.md` (v267, a página
Oportunidades e o card na tela de Módulos). Os diffs são contra o estado
depois dele.

## O que faz

### 1. Oportunidades também pela inspeção

Além da **AEP entregue**, que já gerava AET e DRPS/Questionário, a **última
inspeção CONCLUÍDA** de cada empresa (status `CONCLUIDA`) também gera
oportunidades. Os serviços foram escolhidos pela JCN em 2026-10-05:

| Serviço | Quando a inspeção indica | Situação ("já feito?") |
|---|---|---|
| **Apreciação NR-12** | máquina (`inspecao_maquinas`, ativa) com `necessita_adequacao_nr12` ou grau `ALTO`/`CRITICO` | pela `apreciacoes_maquinas` da empresa (`RASCUNHO` = em andamento, `FINALIZADO` = realizada) |
| **Medição quantitativa** | risco `Físico` com `fisico_necessita_medicao = 'Sim'` | sem módulo: sempre **aberta** |
| **Análise de Químicos** | risco `Químico` | existe `analises_quimicos` da empresa → realizada |
| **AEP** | risco `Ergonômico` | pela `aep_relatorios` da empresa |
| **DRPS/Questionário** | risco `Psicossocial` | pelo DRPS/QPS; junta com o da AEP numa oportunidade só, com as duas origens |
| **Treinamentos NR** | `treinamentos_nr` ativos da inspeção | realizada quando **toda** NR indicada tem certificado em `certificados_treinamento` para a empresa; em andamento quando só parte tem. A NR é comparada pelo número (`numeroNr`: "NR-06" = "NR 6" = "6") |

Na página:

- cada oportunidade mostra **"Indicada por: AEP / Inspeção"** e a lista do que
  a justifica (setores, máquinas, agentes, treinamentos);
- há o contador **Oportunidades em aberto** e **chips por produto** com o
  número de abertas, que filtram ao clicar;
- o filtro Produto tem os 7 serviços;
- o cartão da empresa mostra a inspeção usada (número, data de conclusão e
  quem fez);
- o CSV ganha as colunas Origem, Detalhes, Inspeção e Inspeção concluída em.

A RPC `comercial_dados()` (v268) passa a devolver também:

- `inspecoes`: a última concluída por empresa, com máquinas, medições, químicos, contagem de ergonômicos/psicossociais e treinamentos;
- `docs`, agora com AEP, Apreciação e Químicos;
- `certificados`: empresa + NR.

A permissão continua a mesma: Admin ou o módulo `comercial`.

### 2. Tela de preenchimento da inspeção em largura total

A tela `/inspecoes/INS-…` passa a usar a largura toda da janela
(`TELA_LARGA` em `app/(app)/layout.tsx`). As demais telas do Painel SST
continuam limitadas a 1400px.

## Passo 1: conferir o painel

| Usado pela v268 | Conferir no painel |
|---|---|
| `inspecoes.status = 'CONCLUIDA'`, `concluida_em` e `responsavel` | se a inspeção concluída tiver outro status ou campo de data, ajuste a função |
| `inspecao_maquinas` (`nome`, `grau_risco`, `necessita_adequacao_nr12`, `ativo`) | mesmos nomes |
| `riscos` (`tipo_risco` com os valores `Físico`, `Químico`, `Ergonômico`, `Psicossocial`; `fisico_necessita_medicao` = `'Sim'`, `fisico_qual_medicao`, `agente`, `id_setor`) | confira os valores gravados no painel com `select distinct tipo_risco, fisico_necessita_medicao from riscos` |
| `treinamentos_nr` (`nr`, `titulo`, `ordem`, `ativo`) e `certificados_treinamento` (`id_empresa`, `nr`) | mesmos nomes |
| `apreciacoes_maquinas.status` (`RASCUNHO`/`FINALIZADO`) e `analises_quimicos` (sem status) | ajuste o `FASE` em `oportunidades.ts` se o status for outro |
| `app/(app)/layout.tsx` com o `<main className="mx-auto max-w-[1400px] …">` | aplique a troca onde estiver o container do Painel SST |

## Passo 2: migration v268 (banco do painel)

Rode a seção **A** no **banco do painel**, nunca no do JCN. Depois:

- como Admin, rode `select jsonb_array_length(public.comercial_dados()->'inspecoes');`; deve contar as empresas com inspeção concluída.

Rollback: reaplicar a função da v267 (seção A do MD do módulo Comercial).

## Passo 3: código

| Seção | Arquivo | O quê |
|---|---|---|
| A | `supabase/historico/v268_comercial_dados_inspecao.sql` | **migration** |
| B | `lib/comercial/oportunidades.ts` | **substituir**: regra com AEP + inspeção |
| C | `lib/comercial/oportunidades.test.ts` | **substituir**: 7 testes |
| D | `lib/hooks/useComercial.ts` | passa inspeções e certificados |
| E | `app/(comercial)/comercial/page.tsx` | contador, chips, detalhes, origem e inspeção |
| F | `app/(app)/layout.tsx` | inspeção em largura total |

### A: `supabase/historico/v268_comercial_dados_inspecao.sql` (novo, completo)

```sql
-- v268 (2026-10-05): o Comercial passa a ler também a INSPEÇÃO. Para cada
-- empresa, a última inspeção CONCLUÍDA (status CONCLUIDA) com o que ela indica
-- para venda: máquinas para Apreciação NR-12, riscos físicos que precisam de
-- medição, riscos químicos, ergonômicos e psicossociais, e os treinamentos NR.
-- `docs` ganha Apreciação de Máquinas, Análise de Químicos e AEP, e entram os
-- certificados emitidos (para saber qual treinamento já foi dado).
-- Já aplicada via MCP. Rollback: reaplicar supabase/historico/v267_comercial_dados.sql
-- (só a função; o update de usuários da v267 não precisa ser repetido).
create or replace function public.comercial_dados()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text := lower(nullif(auth.jwt() ->> 'email', ''));
  v_ok boolean;
begin
  select (u.perfil = 'Admin' or u.modulos_permitidos is null or 'comercial' = any(u.modulos_permitidos))
    into v_ok
    from public.usuarios u
   where lower(u.email) = v_email and u.ativo_sistema = true
   limit 1;
  if not coalesce(v_ok, false) then
    raise exception 'Sem permissão para o módulo Comercial' using errcode = '42501';
  end if;

  return jsonb_build_object(
    -- AEPs entregues ao cliente (regra da Sinalização)
    'aeps', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id_relatorio', a.id_relatorio,
        'id_empresa', a.id_empresa,
        'status', a.status,
        'setores', a.setores,
        'responsavel_elaboracao', a.responsavel_elaboracao,
        'data_elaboracao', a.data_elaboracao,
        'id_inspecao', a.id_inspecao,
        'entregue_em', case when a.id_inspecao is not null then i.elaboracao_concluida_em else a.concluido_em end,
        'enviado_por', i.elaboracao_responsavel,
        'empresas', jsonb_build_object(
          'nome_empresa', e.nome_empresa, 'cnpj', e.cnpj, 'municipio', e.municipio, 'uf', e.uf,
          'id_unidade', e.id_unidade, 'telefone', e.telefone, 'email', e.email)))
        from public.aep_relatorios a
        join public.empresas e on e.id_empresa = a.id_empresa
        left join public.inspecoes i on i.id_inspecao = a.id_inspecao
       where (a.id_inspecao is not null and i.elaboracao_status = 'CONCLUIDO' and i.status <> 'DELETADA')
          or (a.id_inspecao is null and a.status = 'CONCLUIDO')
    ), '[]'::jsonb),

    -- Última inspeção CONCLUÍDA de cada empresa e o que ela indica
    'inspecoes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id_inspecao', i.id_inspecao,
        'id_empresa', i.id_empresa,
        'concluida_em', coalesce(i.concluida_em, i.updated_at),
        'responsavel', i.responsavel,
        'empresas', jsonb_build_object(
          'nome_empresa', e.nome_empresa, 'cnpj', e.cnpj, 'municipio', e.municipio, 'uf', e.uf,
          'id_unidade', e.id_unidade, 'telefone', e.telefone, 'email', e.email),
        'maquinas', coalesce((
          select jsonb_agg(jsonb_build_object('nome', m.nome, 'grau_risco', m.grau_risco, 'adequacao', m.necessita_adequacao_nr12))
            from public.inspecao_maquinas m
           where m.id_inspecao = i.id_inspecao and m.ativo is not false
             and (m.necessita_adequacao_nr12 or m.grau_risco in ('ALTO', 'CRITICO'))), '[]'::jsonb),
        'medicoes', coalesce((
          select jsonb_agg(jsonb_build_object('agente', r.agente, 'qual', r.fisico_qual_medicao, 'setor', s.setor_ghe))
            from public.riscos r left join public.setores s on s.id_setor = r.id_setor
           where r.id_inspecao = i.id_inspecao and r.tipo_risco = 'Físico' and r.fisico_necessita_medicao = 'Sim'), '[]'::jsonb),
        'quimicos', coalesce((
          select jsonb_agg(distinct coalesce(nullif(trim(r.agente), ''), 'Agente químico'))
            from public.riscos r where r.id_inspecao = i.id_inspecao and r.tipo_risco = 'Químico'), '[]'::jsonb),
        'ergonomicos', (select count(*) from public.riscos r where r.id_inspecao = i.id_inspecao and r.tipo_risco = 'Ergonômico'),
        'psicossociais', (select count(*) from public.riscos r where r.id_inspecao = i.id_inspecao and r.tipo_risco = 'Psicossocial'),
        'treinamentos', coalesce((
          select jsonb_agg(jsonb_build_object('nr', t.nr, 'titulo', t.titulo) order by t.ordem)
            from public.treinamentos_nr t where t.id_inspecao = i.id_inspecao and t.ativo is not false), '[]'::jsonb)))
        from (
          select distinct on (x.id_empresa) x.*
            from public.inspecoes x
           where x.status = 'CONCLUIDA'
           order by x.id_empresa, coalesce(x.concluida_em, x.updated_at) desc nulls last
        ) i
        join public.empresas e on e.id_empresa = i.id_empresa
    ), '[]'::jsonb),

    -- Situação dos serviços que a empresa já tem
    'docs', coalesce((
      select jsonb_agg(jsonb_build_object('id_empresa', d.id_empresa, 'tipo', d.tipo, 'status', d.status))
        from (
          select id_empresa, 'DRPS'::text as tipo, status from public.drps_relatorios
          union all select id_empresa, 'QPS', status from public.qps_aplicacoes
          union all select id_empresa, 'AET', status from public.aet_relatorios
          union all select id_empresa, 'AEP', status from public.aep_relatorios
          union all select id_empresa, 'APRECIACAO', status from public.apreciacoes_maquinas
          union all select id_empresa, 'QUIMICOS', 'CONCLUIDO' from public.analises_quimicos
        ) d
       where d.id_empresa is not null
    ), '[]'::jsonb),

    -- Certificados de treinamento emitidos (empresa + NR)
    'certificados', coalesce((
      select jsonb_agg(distinct jsonb_build_object('id_empresa', c.id_empresa, 'nr', c.nr))
        from public.certificados_treinamento c where c.id_empresa is not null
    ), '[]'::jsonb)
  );
end $$;

revoke all on function public.comercial_dados() from public, anon;
grant execute on function public.comercial_dados() to authenticated;
```

### B: `lib/comercial/oportunidades.ts` (substituir, completo)

```ts
// Módulo Comercial (2026-10-05): transforma o que a JCN já levantou no cliente
// em OPORTUNIDADES de venda — serviços indicados e que a empresa ainda não
// contratou. Puro (sem tela, sem banco) para testar. Dados da RPC
// `comercial_dados` (v267/v268).
//
// Da AEP ENTREGUE mais recente (regra da Sinalização):
//   • AET (vendida à parte): algum setor com "Necessita AET".
//   • DRPS / Questionário: 3+ alertas organizacionais (`recomendaQuestionario`).
// Da última INSPEÇÃO CONCLUÍDA (v268, escolha do usuário em 2026-10-05):
//   • Apreciação NR-12: máquina com "Necessita adequação NR-12" ou grau Alto/Crítico.
//   • Medição quantitativa: risco físico com "Necessita medição".
//   • Análise de Químicos: risco químico registrado.
//   • AEP: risco ergonômico registrado.
//   • DRPS / Questionário: risco psicossocial registrado.
//   • Treinamentos NR: treinamentos indicados na aba Treinamentos.
//
// Situação, pelo que a empresa já tem no sistema:
//   aberta    → indicada e nenhum documento do serviço existe (vender);
//   andamento → já existe um em rascunho/andamento (provavelmente vendido);
//   realizada → já existe um concluído/enviado.
// Medição quantitativa não tem módulo no sistema: fica sempre "aberta".
// Treinamentos: realizada quando TODA NR indicada já tem certificado emitido
// para a empresa; andamento quando só parte tem.

import { montarSinalizacao, type AepEntregue, type EmpresaSinalizada } from "@/lib/aep/sinalizacao";

export type SituacaoOportunidade = "aberta" | "andamento" | "realizada";
export type Produto =
  | "AET"
  | "DRPS/Questionário"
  | "Apreciação NR-12"
  | "Medição quantitativa"
  | "Análise de Químicos"
  | "AEP"
  | "Treinamentos NR";
export type Origem = "AEP" | "Inspeção";

/** Ordem de exibição dos produtos. */
export const PRODUTOS: Produto[] = [
  "AET",
  "AEP",
  "DRPS/Questionário",
  "Apreciação NR-12",
  "Medição quantitativa",
  "Análise de Químicos",
  "Treinamentos NR",
];

export const NOME_PRODUTO: Record<Produto, string> = {
  AET: "AET – Análise Ergonômica do Trabalho",
  AEP: "AEP – Análise Ergonômica Preliminar",
  "DRPS/Questionário": "DRPS / Questionário Psicossocial",
  "Apreciação NR-12": "Apreciação de Máquinas (NR-12)",
  "Medição quantitativa": "Avaliação quantitativa (medição)",
  "Análise de Químicos": "Análise de Químicos",
  "Treinamentos NR": "Treinamentos NR",
};

export interface DocEmpresa {
  id_empresa: string;
  tipo: "AET" | "DRPS" | "QPS" | "AEP" | "APRECIACAO" | "QUIMICOS";
  status: string | null;
}

export interface CertificadoEmpresa {
  id_empresa: string;
  nr: string | null;
}

export interface InspecaoComercial {
  id_inspecao: string;
  id_empresa: string;
  concluida_em: string | null;
  responsavel: string | null;
  empresas?: unknown;
  maquinas: { nome: string | null; grau_risco: string | null; adequacao: boolean | null }[];
  medicoes: { agente: string | null; qual: string | null; setor: string | null }[];
  quimicos: string[];
  ergonomicos: number;
  psicossociais: number;
  treinamentos: { nr: string | null; titulo: string | null }[];
}

export interface SetorAet {
  nome: string;
  expostos: number;
  cargos: number;
}

export interface Oportunidade {
  produto: Produto;
  situacao: SituacaoOportunidade;
  /** De onde veio a indicação (pode ser das duas). */
  origens: Origem[];
  /** Itens que justificam: setores, máquinas, agentes, treinamentos… */
  detalhes: string[];
  /** Para AET: setores indicados (com expostos). */
  setores: SetorAet[];
}

export interface InfoInspecao {
  idInspecao: string;
  concluidaEm: string | null;
  responsavel: string | null;
}

export interface EmpresaComercial {
  empresa: EmpresaSinalizada;
  telefone: string | null;
  email: string | null;
  oportunidades: Oportunidade[];
  /** Trabalhadores expostos nos setores indicados para AET (base do orçamento). */
  expostosAet: number;
  /** A empresa tem AEP entregue (a base das oportunidades de AEP). */
  temAep: boolean;
  /** Última inspeção concluída usada. */
  inspecao: InfoInspecao | null;
}

const FASE: Record<string, "realizada" | "andamento"> = {
  CONCLUIDO: "realizada",
  FINALIZADO: "realizada",
  ENVIADO_CLIENTE: "realizada",
  RASCUNHO: "andamento",
  EM_ANDAMENTO: "andamento",
};

/** Melhor situação entre os documentos: realizada > andamento > aberta. */
export function situacaoPorDocs(status: (string | null)[]): SituacaoOportunidade {
  const fases = status.map((s) => FASE[s ?? ""]).filter(Boolean);
  if (fases.includes("realizada")) return "realizada";
  if (fases.includes("andamento")) return "andamento";
  return "aberta";
}

/** "NR-06", "NR 6" e "6" viram "6" — para casar treinamento com certificado. */
export function numeroNr(nr: string | null | undefined): string {
  const m = (nr ?? "").match(/\d+/);
  return m ? String(Number(m[0])) : (nr ?? "").trim().toLowerCase();
}

type Cad = {
  nome_empresa?: string;
  cnpj?: string | null;
  id_unidade?: string | null;
  municipio?: string | null;
  uf?: string | null;
  telefone?: string | null;
  email?: string | null;
};

function empresaBase(id: string, cad: Cad): EmpresaSinalizada {
  return {
    idEmpresa: id,
    nome: cad.nome_empresa ?? "Empresa sem cadastro",
    cnpj: cad.cnpj ?? null,
    avaliacoes: [],
    totalSetores: 0,
    totalAlertas: 0,
    totalAltos: 0,
    pior: null,
    ultimaData: null,
    precisaAet: false,
    precisaQuestionario: false,
    realizadaPor: null,
    enviadoPor: null,
    temInspecao: false,
    idUnidade: cad.id_unidade ?? null,
    municipio: cad.municipio ?? null,
    uf: cad.uf ?? null,
  };
}

export function montarComercial(
  aeps: (AepEntregue & { empresas?: unknown })[],
  docs: DocEmpresa[],
  inspecoes: InspecaoComercial[] = [],
  certificados: CertificadoEmpresa[] = [],
): EmpresaComercial[] {
  // ── Base das AEPs: Sinalização (empresas com fator organizacional) + as que
  // só têm AET indicada pela ergonomia física/cognitiva.
  const sinal = new Map(montarSinalizacao(aeps).map((e) => [e.idEmpresa, e]));
  const ultimaAep = new Map<string, AepEntregue & { empresas?: unknown }>();
  for (const a of aeps) {
    const atual = ultimaAep.get(a.id_empresa);
    const data = (x: AepEntregue) => x.entregue_em ?? x.data_elaboracao ?? "";
    if (!atual || data(a) > data(atual)) ultimaAep.set(a.id_empresa, a);
  }
  const inspPorEmpresa = new Map(inspecoes.map((i) => [i.id_empresa, i]));
  const ids = new Set([...ultimaAep.keys(), ...inspPorEmpresa.keys()]);

  const resultado: EmpresaComercial[] = [];
  for (const id of ids) {
    const aep = ultimaAep.get(id);
    const insp = inspPorEmpresa.get(id);
    const cad = ((aep?.empresas ?? insp?.empresas) ?? {}) as Cad;

    let empresa = sinal.get(id);
    if (!empresa) {
      empresa = empresaBase(id, cad);
      if (aep) {
        empresa.precisaAet = (aep.setores ?? []).some((s) => s.necessita_aet);
        empresa.ultimaData = aep.entregue_em ?? aep.data_elaboracao ?? null;
        empresa.realizadaPor = aep.responsavel_elaboracao || null;
        empresa.enviadoPor = aep.enviado_por?.trim() || null;
        empresa.temInspecao = !!(aep as { id_inspecao?: string | null }).id_inspecao;
      }
    }

    const docsDa = docs.filter((d) => d.id_empresa === id);
    const sit = (...tipos: DocEmpresa["tipo"][]) =>
      situacaoPorDocs(docsDa.filter((d) => tipos.includes(d.tipo)).map((d) => d.status));
    const ops = new Map<Produto, Oportunidade>();
    const add = (produto: Produto, situacao: SituacaoOportunidade, origem: Origem, detalhes: string[], setores: SetorAet[] = []) => {
      const ja = ops.get(produto);
      if (ja) {
        if (!ja.origens.includes(origem)) ja.origens.push(origem);
        ja.detalhes.push(...detalhes.filter((d) => !ja.detalhes.includes(d)));
        return;
      }
      ops.set(produto, { produto, situacao, origens: [origem], detalhes: [...detalhes], setores });
    };

    // ── Da AEP entregue
    const setoresAet: SetorAet[] = (aep?.setores ?? [])
      .filter((s) => s.necessita_aet)
      .map((s) => ({
        nome: s.nome_setor || "Setor sem nome",
        expostos: Number(s.qtd_expostos) || 0,
        cargos: (s.cargos ?? []).filter((c) => c.cargo).length,
      }));
    if (aep && empresa.precisaAet) {
      add("AET", sit("AET"), "AEP", setoresAet.map((s) => s.nome), setoresAet);
    }
    if (aep && empresa.precisaQuestionario) {
      add("DRPS/Questionário", sit("DRPS", "QPS"), "AEP", [
        `${empresa.totalAlertas} fator(es) organizacional(is) na AEP`,
      ]);
    }

    // ── Da inspeção concluída
    if (insp) {
      if (insp.maquinas.length > 0) {
        add(
          "Apreciação NR-12",
          sit("APRECIACAO"),
          "Inspeção",
          insp.maquinas.map(
            (m) =>
              `${m.nome || "Máquina"}${m.grau_risco ? ` (grau ${m.grau_risco.toLowerCase()})` : ""}${m.adequacao ? " · necessita adequação" : ""}`,
          ),
        );
      }
      if (insp.medicoes.length > 0) {
        add(
          "Medição quantitativa",
          "aberta",
          "Inspeção",
          insp.medicoes.map((m) => [m.qual || m.agente || "Agente físico", m.setor].filter(Boolean).join(" · ")),
        );
      }
      if (insp.quimicos.length > 0) {
        add("Análise de Químicos", sit("QUIMICOS"), "Inspeção", insp.quimicos);
      }
      if (insp.ergonomicos > 0) {
        add("AEP", sit("AEP"), "Inspeção", [`${insp.ergonomicos} risco(s) ergonômico(s) na inspeção`]);
      }
      if (insp.psicossociais > 0) {
        add("DRPS/Questionário", sit("DRPS", "QPS"), "Inspeção", [
          `${insp.psicossociais} risco(s) psicossocial(is) na inspeção`,
        ]);
      }
      if (insp.treinamentos.length > 0) {
        const certs = new Set(certificados.filter((c) => c.id_empresa === id).map((c) => numeroNr(c.nr)));
        const comCert = insp.treinamentos.filter((t) => certs.has(numeroNr(t.nr)));
        const situacao: SituacaoOportunidade =
          comCert.length === insp.treinamentos.length ? "realizada" : comCert.length > 0 ? "andamento" : "aberta";
        add(
          "Treinamentos NR",
          situacao,
          "Inspeção",
          insp.treinamentos.map(
            (t) => `${[t.nr, t.titulo].filter(Boolean).join(" – ")}${certs.has(numeroNr(t.nr)) ? " · certificado emitido" : ""}`,
          ),
        );
      }
    }

    const oportunidades = PRODUTOS.map((p) => ops.get(p)).filter((o): o is Oportunidade => !!o);
    if (oportunidades.length === 0) continue;
    resultado.push({
      empresa,
      telefone: cad.telefone?.trim() || null,
      email: cad.email?.trim() || null,
      oportunidades,
      expostosAet: setoresAet.reduce((n, s) => n + s.expostos, 0),
      temAep: !!aep,
      inspecao: insp ? { idInspecao: insp.id_inspecao, concluidaEm: insp.concluida_em, responsavel: insp.responsavel } : null,
    });
  }

  const abertas = (c: EmpresaComercial) => c.oportunidades.filter((o) => o.situacao === "aberta").length;
  return resultado.sort((a, b) => abertas(b) - abertas(a) || a.empresa.nome.localeCompare(b.empresa.nome, "pt-BR"));
}

/** Uma linha por oportunidade, para exportar (CSV/Excel). */
export function linhasCsv(lista: EmpresaComercial[], nomeUnidade: (id: string | null) => string): string[][] {
  const cab = [
    "Empresa", "CNPJ", "Unidade", "Município/UF", "Telefone", "E-mail", "Produto", "Situação", "Origem",
    "Detalhes", "Trabalhadores expostos (AET)", "Nível AIHA", "AEP realizada por", "AEP enviada por", "AEP entregue em",
    "Inspeção", "Inspeção concluída em",
  ];
  const rot: Record<SituacaoOportunidade, string> = { aberta: "Aberta", andamento: "Em andamento", realizada: "Realizada" };
  const linhas = lista.flatMap((c) =>
    c.oportunidades.map((o) => [
      c.empresa.nome,
      c.empresa.cnpj ?? "",
      nomeUnidade(c.empresa.idUnidade),
      [c.empresa.municipio, c.empresa.uf].filter(Boolean).join("/"),
      c.telefone ?? "",
      c.email ?? "",
      NOME_PRODUTO[o.produto],
      rot[o.situacao],
      o.origens.join(" + "),
      o.detalhes.join(" | "),
      o.produto === "AET" ? String(c.expostosAet) : "",
      c.empresa.pior ?? "",
      c.temAep ? (c.empresa.realizadaPor ?? "") : "",
      c.temAep ? (c.empresa.enviadoPor ?? "") : "",
      c.temAep && c.empresa.ultimaData ? c.empresa.ultimaData.slice(0, 10) : "",
      c.inspecao?.idInspecao ?? "",
      c.inspecao?.concluidaEm ? c.inspecao.concluidaEm.slice(0, 10) : "",
    ]),
  );
  return [cab, ...linhas];
}
```

### C: `lib/comercial/oportunidades.test.ts` (substituir, completo)

```ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { linhasCsv, montarComercial, numeroNr, situacaoPorDocs, type InspecaoComercial } from "./oportunidades";

const empresa = (nome: string) => ({ nome_empresa: nome, cnpj: null, municipio: "Teresópolis", uf: "RJ", id_unidade: "U1", telefone: "21 9999", email: "a@b.c" });

const setorAet = {
  id: "s1",
  nome_setor: "Produção",
  qtd_expostos: 12,
  necessita_aet: true,
  cargos: [{ cargo: "Operador" }, { cargo: "" }],
  checklist_organizacional: { assedio: "sim", sobrecarga: "sim", baixo_controle: "sim" },
  sinais_organizacional: {},
  aiha_organizacional: { assedio: { probabilidade: "x", severidade: "y", nivel: "Alto" } },
};
const setorSoFisico = { id: "s2", nome_setor: "Expedição", qtd_expostos: 5, necessita_aet: true, cargos: [], checklist_organizacional: {} };

function aep(id: string, idEmpresa: string, setores: unknown[], extra: Record<string, unknown> = {}) {
  return {
    id_relatorio: id,
    id_empresa: idEmpresa,
    status: "CONCLUIDO",
    setores,
    responsavel_elaboracao: "Ana",
    data_elaboracao: "2026-10-01",
    entregue_em: "2026-10-05",
    enviado_por: null,
    empresas: empresa("Empresa " + idEmpresa),
    ...extra,
  } as never;
}

function insp(idEmpresa: string, p: Partial<InspecaoComercial> = {}): InspecaoComercial {
  return {
    id_inspecao: "INS-" + idEmpresa,
    id_empresa: idEmpresa,
    concluida_em: "2026-10-03",
    responsavel: "Caio",
    empresas: empresa("Empresa " + idEmpresa),
    maquinas: [],
    medicoes: [],
    quimicos: [],
    ergonomicos: 0,
    psicossociais: 0,
    treinamentos: [],
    ...p,
  };
}

const produtos = (r: ReturnType<typeof montarComercial>[number]) => r.oportunidades.map((o) => [o.produto, o.situacao]);

test("situação pelos documentos e número da NR", () => {
  assert.equal(situacaoPorDocs([]), "aberta");
  assert.equal(situacaoPorDocs(["RASCUNHO"]), "andamento");
  assert.equal(situacaoPorDocs(["RASCUNHO", "CONCLUIDO"]), "realizada");
  assert.equal(situacaoPorDocs(["FINALIZADO"]), "realizada");
  assert.equal(situacaoPorDocs(["DELETADO"]), "aberta");
  assert.equal(numeroNr("NR-06"), "6");
  assert.equal(numeroNr("NR 35"), "35");
});

test("AEP: AET e DRPS/Questionário, com a situação pelo que a empresa já tem", () => {
  const [c] = montarComercial([aep("A1", "E1", [setorAet])], [{ id_empresa: "E1", tipo: "QPS", status: "RASCUNHO" }]);
  assert.deepEqual(produtos(c), [["AET", "aberta"], ["DRPS/Questionário", "andamento"]]);
  assert.deepEqual(c.oportunidades[0].setores, [{ nome: "Produção", expostos: 12, cargos: 1 }]);
  assert.equal(c.expostosAet, 12);
  assert.equal(c.telefone, "21 9999");
  assert.equal(c.temAep, true);
});

test("AEP: AET só pela ergonomia física entra; sem indicação não entra", () => {
  const r = montarComercial(
    [aep("A1", "E1", [setorSoFisico]), aep("A2", "E2", [{ id: "x", nome_setor: "ADM", necessita_aet: false, checklist_organizacional: {} }])],
    [],
  );
  assert.deepEqual(r.map((c) => c.empresa.idEmpresa), ["E1"]);
  assert.equal(r[0].expostosAet, 5);
});

test("Inspeção: NR-12, medição, químicos, AEP, psicossocial e treinamentos", () => {
  const [c] = montarComercial(
    [],
    [
      { id_empresa: "E1", tipo: "APRECIACAO", status: "RASCUNHO" },
      { id_empresa: "E1", tipo: "QUIMICOS", status: "CONCLUIDO" },
    ],
    [
      insp("E1", {
        maquinas: [{ nome: "Serra", grau_risco: "ALTO", adequacao: true }],
        medicoes: [{ agente: "Ruído", qual: "Dosimetria", setor: "Produção" }],
        quimicos: ["Tolueno"],
        ergonomicos: 2,
        psicossociais: 1,
        treinamentos: [{ nr: "NR-06", titulo: "EPI" }, { nr: "NR-35", titulo: "Altura" }],
      }),
    ],
    [{ id_empresa: "E1", nr: "NR 6" }],
  );
  assert.deepEqual(produtos(c), [
    ["AEP", "aberta"],
    ["DRPS/Questionário", "aberta"],
    ["Apreciação NR-12", "andamento"],
    ["Medição quantitativa", "aberta"],
    ["Análise de Químicos", "realizada"],
    ["Treinamentos NR", "andamento"],
  ]);
  assert.deepEqual(c.oportunidades[2].detalhes, ["Serra (grau alto) · necessita adequação"]);
  assert.deepEqual(c.oportunidades[3].detalhes, ["Dosimetria · Produção"]);
  assert.match(c.oportunidades[5].detalhes[0], /certificado emitido/);
  assert.equal(c.inspecao?.idInspecao, "INS-E1");
  assert.equal(c.temAep, false);
});

test("DRPS/Questionário pela AEP e pela inspeção vira uma oportunidade só, com as duas origens", () => {
  const [c] = montarComercial([aep("A1", "E1", [setorAet])], [], [insp("E1", { psicossociais: 2 })]);
  const drps = c.oportunidades.filter((o) => o.produto === "DRPS/Questionário");
  assert.equal(drps.length, 1);
  assert.deepEqual(drps[0].origens, ["AEP", "Inspeção"]);
  assert.equal(drps[0].detalhes.length, 2);
});

test("treinamentos todos com certificado = realizada; empresa sem nada indicado não entra", () => {
  const r = montarComercial([], [], [
    insp("E1", { treinamentos: [{ nr: "NR-01", titulo: "GRO" }] }),
    insp("E2"),
  ], [{ id_empresa: "E1", nr: "NR-01" }]);
  assert.deepEqual(r.map((c) => [c.empresa.idEmpresa, c.oportunidades[0].situacao]), [["E1", "realizada"]]);
});

test("abertas primeiro; CSV com uma linha por oportunidade", () => {
  const r = montarComercial(
    [aep("A1", "E1", [setorSoFisico]), aep("A2", "E2", [setorSoFisico])],
    [{ id_empresa: "E1", tipo: "AET", status: "CONCLUIDO" }],
  );
  assert.deepEqual(r.map((c) => c.empresa.idEmpresa), ["E2", "E1"]);
  const csv = linhasCsv(r, () => "Serra");
  assert.equal(csv.length, 3);
  assert.equal(csv[1][2], "Serra");
  assert.equal(csv[1][6], "AET – Análise Ergonômica do Trabalho");
  assert.equal(csv[1][8], "AEP");
  assert.equal(csv[1][10], "5");
});
```

### D: diff de `lib/hooks/useComercial.ts`

```diff
@@ -1,13 +1,18 @@
 "use client";
 
 // Dados do módulo Comercial (2026-10-05). Vêm da RPC `comercial_dados` (v267),
-// que só devolve AEPs entregues ao cliente e a situação dos documentos de cada
-// empresa — o comercial não precisa ter os módulos AEP/AET/DRPS liberados.
+// que devolve as AEPs entregues ao cliente, a última inspeção concluída (v268)
+// e a situação dos documentos de cada empresa — o comercial não precisa ter os módulos AEP/AET/DRPS liberados.
 
 import { useQuery } from "@tanstack/react-query";
 import { createSupabaseBrowserClient } from "@/lib/supabase/client";
 import { normalizarRelatorio } from "@/lib/hooks/useAep";
-import { montarComercial, type DocEmpresa } from "@/lib/comercial/oportunidades";
+import {
+  montarComercial,
+  type CertificadoEmpresa,
+  type DocEmpresa,
+  type InspecaoComercial,
+} from "@/lib/comercial/oportunidades";
 
 export function useComercial() {
   return useQuery({
@@ -15,12 +20,17 @@ export function useComercial() {
     queryFn: async () => {
       const { data, error } = await createSupabaseBrowserClient().rpc("comercial_dados" as never);
       if (error) throw error;
-      const r = (data ?? {}) as { aeps?: unknown[]; docs?: DocEmpresa[] };
+      const r = (data ?? {}) as {
+        aeps?: unknown[];
+        docs?: DocEmpresa[];
+        inspecoes?: InspecaoComercial[];
+        certificados?: CertificadoEmpresa[];
+      };
       const aeps = (r.aeps ?? []).map((a) => {
         const x = a as { entregue_em?: string | null; enviado_por?: string | null };
         return { ...normalizarRelatorio(a), entregue_em: x.entregue_em ?? null, enviado_por: x.enviado_por ?? null };
       });
-      return montarComercial(aeps, r.docs ?? []);
+      return montarComercial(aeps, r.docs ?? [], r.inspecoes ?? [], r.certificados ?? []);
     },
   });
 }
```

### E: diff de `app/(comercial)/comercial/page.tsx`

```diff
@@ -1,16 +1,23 @@
 "use client";
 
-// Comercial › Oportunidades (2026-10-05). Para quem vende: cada empresa cuja
-// AEP entregue indicou um serviço vendido à parte (AET) ou o DRPS/Questionário
-// Psicossocial, com a situação (aberta / em andamento / realizada), os setores
-// indicados, trabalhadores expostos (base do orçamento) e o contato da empresa.
-// Regra em lib/comercial/oportunidades.ts.
+// Comercial › Oportunidades (2026-10-05). Para quem vende: cada empresa com
+// serviços indicados pela AEP entregue (AET, DRPS/Questionário) ou pela última
+// inspeção concluída (Apreciação NR-12, medição, químicos, AEP, DRPS,
+// treinamentos), com a situação (aberta / em andamento / realizada), o que
+// justifica cada uma e o contato da empresa. Regra em lib/comercial/oportunidades.ts.
 
 import { useMemo, useState, type ReactNode } from "react";
-import { Building2, Download, FilterX, Handshake, Mail, MapPin, Phone, Search } from "lucide-react";
+import { Building2, ClipboardCheck, Download, FilterX, Handshake, Mail, MapPin, Phone, Search } from "lucide-react";
 import { useComercial } from "@/lib/hooks/useComercial";
 import { useUnidades } from "@/lib/hooks/useUnidades";
-import { linhasCsv, type EmpresaComercial, type Produto, type SituacaoOportunidade } from "@/lib/comercial/oportunidades";
+import {
+  linhasCsv,
+  NOME_PRODUTO,
+  PRODUTOS,
+  type EmpresaComercial,
+  type Produto,
+  type SituacaoOportunidade,
+} from "@/lib/comercial/oportunidades";
 import { opcoesDistintas } from "@/lib/aep/sinalizacao-filtros";
 import SeloNivelAiha from "@/components/aep/SeloNivelAiha";
 import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
@@ -100,11 +107,13 @@ export default function ComercialPage() {
   const todas = lista.flatMap((c) => c.oportunidades.map((o) => ({ c, o })));
   const abertas = (p: Produto) => todas.filter(({ o }) => o.produto === p && o.situacao === "aberta");
   const kpi = {
+    abertas: todas.filter(({ o }) => o.situacao === "aberta").length,
     aet: abertas("AET").length,
-    drps: abertas("DRPS/Questionário").length,
     expostos: abertas("AET").reduce((n, { c }) => n + c.expostosAet, 0),
     andamento: todas.filter(({ o }) => o.situacao === "andamento").length,
   };
+  // Abertas por produto — os chips embaixo dos contadores.
+  const porProduto = PRODUTOS.map((p) => ({ p, n: abertas(p).length })).filter((x) => x.n > 0);
   const nAtivos = [busca.trim(), produto, situacao !== "aberta" ? situacao || "todas" : "", unidade, nivel].filter(Boolean).length;
   const limpar = () => {
     setBusca("");
@@ -122,10 +131,9 @@ export default function ComercialPage() {
             <Handshake className="size-5 text-amber-700" /> Oportunidades comerciais
           </h1>
           <p className="max-w-3xl text-sm text-gray-500">
-            Serviços que as AEPs <strong>já entregues ao cliente</strong> indicaram e que a empresa ainda não contratou:
-            a <strong>AET</strong> (vendida à parte), quando algum setor tem indicação de análise completa (NR-17), e o{" "}
-            <strong>DRPS / Questionário Psicossocial</strong>, quando a AEP aponta 3 ou mais fatores organizacionais
-            (NR-01).
+            Serviços que a JCN já identificou no cliente e que a empresa ainda não contratou: pela{" "}
+            <strong>AEP entregue</strong> (AET e DRPS/Questionário) e pela <strong>última inspeção concluída</strong>{" "}
+            (Apreciação NR-12, medição quantitativa, Análise de Químicos, AEP, DRPS/Questionário e treinamentos NR).
           </p>
         </div>
         <button
@@ -140,6 +148,16 @@ export default function ComercialPage() {
 
       {/* Contadores */}
       <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
+        <Contador
+          rotulo="Oportunidades em aberto"
+          valor={kpi.abertas}
+          cor="border-amber-300 bg-amber-50 text-amber-900"
+          ativo={!produto && situacao === "aberta"}
+          onClick={() => {
+            setProduto("");
+            setSituacao("aberta");
+          }}
+        />
         <Contador
           rotulo="AET em aberto"
           valor={kpi.aet}
@@ -155,16 +173,6 @@ export default function ComercialPage() {
           valor={kpi.expostos}
           cor="border-orange-200 bg-orange-50 text-orange-900"
         />
-        <Contador
-          rotulo="DRPS/Questionário em aberto"
-          valor={kpi.drps}
-          cor="border-violet-200 bg-violet-50 text-violet-900"
-          ativo={produto === "DRPS/Questionário" && situacao === "aberta"}
-          onClick={() => {
-            setProduto("DRPS/Questionário");
-            setSituacao("aberta");
-          }}
-        />
         <Contador
           rotulo="Em andamento"
           valor={kpi.andamento}
@@ -177,6 +185,27 @@ export default function ComercialPage() {
         />
       </div>
 
+      {porProduto.length > 0 && (
+        <div className="flex flex-wrap gap-2">
+          {porProduto.map(({ p, n }) => (
+            <button
+              key={p}
+              type="button"
+              onClick={() => {
+                setProduto(produto === p ? "" : p);
+                setSituacao("aberta");
+              }}
+              className={cn(
+                "rounded-full border px-3 py-1 text-xs font-semibold transition",
+                produto === p ? "border-amber-500 bg-amber-500 text-white" : "border-amber-200 bg-white text-amber-800 hover:bg-amber-50"
+              )}
+            >
+              {p} · {n}
+            </button>
+          ))}
+        </div>
+      )}
+
       {/* Busca + filtros */}
       <div className="space-y-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
         <div className="relative">
@@ -193,8 +222,11 @@ export default function ComercialPage() {
             Produto
             <select value={produto} onChange={(e) => setProduto(e.target.value as "" | Produto)} className={selectCls}>
               <option value="">Todos</option>
-              <option value="AET">AET</option>
-              <option value="DRPS/Questionário">DRPS/Questionário</option>
+              {PRODUTOS.map((p) => (
+                <option key={p} value={p}>
+                  {p}
+                </option>
+              ))}
             </select>
           </label>
           <label className="text-[11px] font-medium text-gray-500">
@@ -252,7 +284,7 @@ export default function ComercialPage() {
       ) : filtradas.length === 0 ? (
         <p className="rounded-2xl border border-gray-100 bg-white p-10 text-center text-sm text-gray-500 shadow-sm">
           {lista.length === 0
-            ? "Nenhuma AEP entregue indicou AET ou DRPS/Questionário até agora."
+            ? "Nenhuma AEP entregue ou inspeção concluída indicou serviços até agora."
             : "Nenhuma oportunidade com esses filtros."}
         </p>
       ) : (
@@ -294,20 +326,29 @@ function CartaoEmpresa({ c, unidade }: { c: EmpresaComercial; unidade: string })
             )}
           </div>
         </div>
-        <div className="flex items-center gap-2 text-xs text-gray-500">
+        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
           {e.pior && <SeloNivelAiha nivel={e.pior} />}
-          <span>AEP entregue {e.ultimaData ? fmtData(e.ultimaData) : "—"}</span>
+          {c.temAep && <span>AEP entregue {e.ultimaData ? fmtData(e.ultimaData) : "—"}</span>}
+          {c.inspecao && (
+            <span className="inline-flex items-center gap-1">
+              <ClipboardCheck className="size-3.5" />
+              Inspeção {c.inspecao.idInspecao} concluída {c.inspecao.concluidaEm ? fmtData(c.inspecao.concluidaEm) : ""}
+            </span>
+          )}
         </div>
       </div>
 
-      <div className="mt-3 grid gap-2 md:grid-cols-2">
+      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
         {c.oportunidades.map((o) => {
           const s = SITUACAO[o.situacao];
           return (
             <div key={o.produto} className={cn("rounded-xl border p-3", s.cls)} title={s.dica}>
-              <div className="flex items-center justify-between gap-2">
-                <span className="text-sm font-bold">{o.produto === "AET" ? "AET – Análise Ergonômica do Trabalho" : "DRPS / Questionário Psicossocial"}</span>
-                <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-semibold">{s.rotulo}</span>
+              <div className="flex items-start justify-between gap-2">
+                <span className="text-sm font-bold">{NOME_PRODUTO[o.produto]}</span>
+                <span className="shrink-0 rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-semibold">{s.rotulo}</span>
+              </div>
+              <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide opacity-70">
+                Indicada por: {o.origens.join(" + ")}
               </div>
               {o.produto === "AET" ? (
                 <div className="mt-1 text-xs">
@@ -320,24 +361,35 @@ function CartaoEmpresa({ c, unidade }: { c: EmpresaComercial; unidade: string })
                   </div>
                 </div>
               ) : (
-                <div className="mt-1 text-xs">
-                  A AEP apontou <strong>{e.totalAlertas}</strong> fator{e.totalAlertas !== 1 ? "es" : ""} organizacional
-                  {e.totalAlertas !== 1 ? "is" : ""} em {e.totalSetores} setor{e.totalSetores !== 1 ? "es" : ""}.
-                </div>
+                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs">
+                  {o.detalhes.slice(0, 6).map((d) => (
+                    <li key={d}>{d}</li>
+                  ))}
+                  {o.detalhes.length > 6 && <li className="list-none opacity-70">+ {o.detalhes.length - 6} item(ns)</li>}
+                </ul>
               )}
             </div>
           );
         })}
       </div>
 
-      <div className="mt-2 text-[11px] text-gray-500">
-        AEP realizada por <strong className="text-gray-700">{e.realizadaPor ?? "—"}</strong>
-        {e.temInspecao ? (
-          <>
-            {" "}· enviada por <strong className="text-gray-700">{e.enviadoPor ?? "—"}</strong>
-          </>
-        ) : (
-          " · sem inspeção"
+      <div className="mt-2 flex flex-wrap gap-x-4 text-[11px] text-gray-500">
+        {c.temAep && (
+          <span>
+            AEP realizada por <strong className="text-gray-700">{e.realizadaPor ?? "—"}</strong>
+            {e.temInspecao ? (
+              <>
+                {" "}· enviada por <strong className="text-gray-700">{e.enviadoPor ?? "—"}</strong>
+              </>
+            ) : (
+              " · sem inspeção"
+            )}
+          </span>
+        )}
+        {c.inspecao && (
+          <span>
+            Inspeção feita por <strong className="text-gray-700">{c.inspecao.responsavel ?? "—"}</strong>
+          </span>
         )}
       </div>
     </li>
```

### F: diff de `app/(app)/layout.tsx`

```diff
@@ -1,21 +1,32 @@
 "use client";
 
 import { type ReactNode } from "react";
+import { usePathname } from "next/navigation";
 import Sidebar from "@/components/layout/Sidebar";
 import Topbar from "@/components/layout/Topbar";
 import { useAuth } from "@/lib/hooks/useAuth";
 import { useRequireModule } from "@/lib/hooks/useRequireModule";
+import { cn } from "@/lib/utils";
+
+// Tela de preenchimento da inspeção (/inspecoes/INS-…) usa a largura toda
+// (2026-10-05): as abas e tabelas têm muita coluna. As demais telas seguem
+// limitadas a 1400px.
+const TELA_LARGA = /^\/inspecoes\/(?!nova$|ficha$)[^/]+$/;
 
 export default function AppLayout({ children }: { children: ReactNode }) {
   useAuth();
   useRequireModule("painel");
+  const larga = TELA_LARGA.test(usePathname() ?? "");
 
   return (
     <div className="app-aurora min-h-screen print:bg-white">
       <Sidebar />
       <div className="md:pl-[220px] print:pl-0">
         <Topbar />
-        <main className="mx-auto max-w-[1400px] px-4 py-6 md:px-6 print:p-0" style={{ viewTransitionName: "content" }}>{children}</main>
+        <main
+          className={cn("mx-auto px-4 py-6 md:px-6 print:p-0", larga ? "max-w-none" : "max-w-[1400px]")}
+          style={{ viewTransitionName: "content" }}
+        >{children}</main>
       </div>
     </div>
   );
```

## Passo 4: verificar

1. Rode `npm test` (os 7 testes de `oportunidades.test.ts` passam), `npx tsc --noEmit -p .` e `npx next build`; todos devem terminar sem erros.
2. Numa inspeção, registre:
   - uma máquina com "Necessita adequação NR-12";
   - um risco físico com "Necessita medição";
   - um risco químico;
   - treinamentos NR.

   Conclua a inspeção. No Comercial, a empresa aparece com Apreciação NR-12, Medição quantitativa, Análise de Químicos e Treinamentos NR em **aberta**, com "Indicada por: Inspeção" e os itens listados.
3. Mudanças de situação:
   - crie uma Apreciação de Máquinas para a empresa: NR-12 passa a **em andamento**; finalize-a e passa a **realizada**;
   - emita certificado de uma das NRs: Treinamentos passa a **em andamento**; de todas, **realizada**.
4. Empresa com AEP entregue que indica DRPS e inspeção com risco psicossocial: aparece **um** DRPS/Questionário, com "Indicada por: AEP + Inspeção".
5. Chips por produto e o contador "Oportunidades em aberto" filtram; o CSV traz Origem e Detalhes.
6. A tela de uma inspeção (`/inspecoes/INS-…`) ocupa a largura toda; Dashboard, Inspeções e Relatório continuam como antes.
7. Publique pelo fluxo de release do painel (versão, changelog, "Novidades").
