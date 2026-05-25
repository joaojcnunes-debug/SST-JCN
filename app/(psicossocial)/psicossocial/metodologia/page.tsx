export default function MetodologiaPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8">

      {/* Cabeçalho */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">
          Metodologia Aplicada — DRPS
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Diagnóstico de Riscos Psicossociais conforme NR-01 (GRO/PGR). Descreve como
          o questionário é estruturado, como a pontuação é calculada, como a probabilidade
          é definida e como a matriz de risco gera o nível final por tópico.
        </p>
      </div>

      {/* 1. Fundamentação Legal */}
      <Section titulo="1. Fundamentação Legal">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <LegalCard
            sigla="NR-01"
            titulo="Disposições Gerais — GRO/PGR"
            texto="Exige o reconhecimento e avaliação de todos os riscos ocupacionais, incluindo os psicossociais, dentro do Programa de Gerenciamento de Riscos (PGR)."
          />
          <LegalCard
            sigla="NR-17"
            titulo="Ergonomia"
            texto="Inclui fatores psicossociais ligados à organização do trabalho, pressão por resultados, ciclos curtos e falta de autonomia como condicionantes de riscos ergonômicos."
          />
          <LegalCard
            sigla="ISO 45003"
            titulo="Saúde Psicológica no Trabalho"
            texto="Referência internacional para identificação, avaliação e controle de riscos psicossociais no ambiente de trabalho, adotada como base conceitual do DRPS."
          />
        </div>
      </Section>

      {/* 2. Estrutura do Questionário */}
      <Section titulo="2. Estrutura do Questionário">
        <p className="mb-4 text-sm text-gray-600">
          O questionário DRPS é aplicado via Google Forms e consiste em{" "}
          <strong>50 perguntas</strong> distribuídas em <strong>13 tópicos</strong>{" "}
          de risco psicossocial. As respostas seguem escala Likert de{" "}
          <strong>1 a 4</strong> (Nunca → Sempre) com duas lógicas de pontuação.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoCard
            titulo="Lógica Direta"
            cor="border-red-200 bg-red-50"
            corTitulo="text-red-700"
            texto='Quanto maior a resposta, maior o risco. Ex.: "Com que frequência você sente sobrecarga?" — resposta 4 (Sempre) indica alta gravidade.'
          />
          <InfoCard
            titulo="Lógica Invertida"
            cor="border-green-200 bg-green-50"
            corTitulo="text-green-700"
            texto='Quanto maior a resposta, menor o risco (protetor). A pontuação é convertida via: 4 − valor. Ex.: "A empresa oferece suporte?" — resposta 4 (Sempre) indica risco baixo.'
          />
        </div>
      </Section>

      {/* 3. Os 13 Tópicos */}
      <Section titulo="3. Os 13 Tópicos de Risco Psicossocial">
        <p className="mb-3 text-sm text-gray-600">
          Cada tópico avalia uma dimensão específica de risco. A tabela abaixo lista
          o nome, o número de perguntas e a principal fonte geradora de cada tópico.
        </p>
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-[10px] uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left font-medium w-8">Nº</th>
                <th className="px-3 py-2 text-left font-medium">Tópico</th>
                <th className="px-3 py-2 text-left font-medium w-12 text-center">Perguntas</th>
                <th className="px-3 py-2 text-left font-medium hidden lg:table-cell">Fonte Geradora</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {TOPICOS_META.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-gray-500">{t.id}</td>
                  <td className="px-3 py-2 font-medium text-gray-900">{t.nome}</td>
                  <td className="px-3 py-2 text-center text-gray-600">{t.perguntas}</td>
                  <td className="px-3 py-2 text-gray-500 hidden lg:table-cell">{t.fonte}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* 4. Cálculo da Gravidade */}
      <Section titulo="4. Cálculo da Gravidade">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            A gravidade é calculada em duas etapas: primeiro para cada{" "}
            <strong>pergunta individual</strong>, depois para o{" "}
            <strong>tópico como um todo</strong>.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">
                Etapa 1 — Pergunta Individual
              </p>
              <ol className="space-y-1.5 text-xs text-gray-700">
                <li>
                  <strong>1.</strong> Calcular a média das respostas de todos os respondentes do setor para aquela pergunta.
                </li>
                <li>
                  <strong>2.</strong> Aplicar <code className="rounded bg-gray-100 px-1">Math.ceil</code> (ROUNDUP) na média → pontuação inteira.
                </li>
                <li>
                  <strong>3.</strong> Se a pergunta for invertida: <code className="rounded bg-gray-100 px-1">4 − valor</code>.
                </li>
                <li>
                  <strong>4.</strong> Classificar a pontuação corrigida:
                </li>
              </ol>
              <div className="mt-2 grid grid-cols-3 gap-1 text-[10px]">
                <div className="rounded bg-green-100 p-1.5 text-center font-semibold text-green-800">≤ 1 → Baixa</div>
                <div className="rounded bg-yellow-100 p-1.5 text-center font-semibold text-yellow-800">= 2 → Média</div>
                <div className="rounded bg-red-100 p-1.5 text-center font-semibold text-red-800">≥ 3 → Alta</div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">
                Etapa 2 — Tópico (média das perguntas)
              </p>
              <p className="mb-2 text-xs text-gray-700">
                A gravidade do tópico é a média dos valores numéricos de gravidade
                (Baixa = 1, Média = 2, Alta = 3) de todas as suas perguntas.
              </p>
              <div className="space-y-1.5 text-[11px]">
                <LimiarRow cor="bg-green-100 text-green-800" label="Baixa" regra="Média ≤ 1,66" />
                <LimiarRow cor="bg-yellow-100 text-yellow-800" label="Média" regra="1,67 ≤ Média ≤ 2,32" />
                <LimiarRow cor="bg-red-100 text-red-800" label="Alta" regra="Média > 2,32" />
              </div>
              <p className="mt-2 text-[10px] text-gray-400">
                Os limiares 1,66 e 2,32 vêm do modelo NR-01 50P e foram calibrados
                com base nos dados reais do questionário.
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* 5. Probabilidade */}
      <Section titulo="5. Definição da Probabilidade (1 a 3)">
        <p className="mb-3 text-sm text-gray-600">
          A probabilidade é definida pelo psicólogo responsável{" "}
          <strong>por setor e por tópico</strong>, com base em três critérios
          complementares. Ela representa a chance de o risco se concretizar
          em dano real, considerando o contexto daquele setor.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <ProbCard
            num="1"
            titulo="Frequência"
            itens={[
              "Com que regularidade o risco ocorre no setor?",
              "O risco é contínuo, recorrente ou esporádico?",
              "Qual a duração típica dos episódios?",
            ]}
          />
          <ProbCard
            num="2"
            titulo="Histórico do Risco"
            itens={[
              "Há registros anteriores de ocorrências?",
              "O risco já gerou afastamentos ou queixas formais?",
              "Foram tomadas medidas corretivas anteriormente?",
            ]}
          />
          <ProbCard
            num="3"
            titulo="Recursos Disponíveis"
            itens={[
              "Existem medidas preventivas implementadas?",
              "Gestores e colaboradores estão treinados?",
              "Há suporte psicológico ou canal de escuta?",
            ]}
          />
        </div>
        <div className="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Critério</th>
                <th className="px-3 py-2 text-left font-medium">Baixa (1)</th>
                <th className="px-3 py-2 text-left font-medium">Média (2)</th>
                <th className="px-3 py-2 text-left font-medium">Alta (3)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {[
                { c: "Frequência",  b: "Raramente ocorre",   m: "Ocorre algumas vezes", a: "Ocorre frequentemente" },
                { c: "Histórico",   b: "Sem registros",      m: "Registros pontuais",   a: "Histórico recorrente" },
                { c: "Recursos",    b: "Medidas efetivas",   m: "Medidas parciais",     a: "Sem medidas" },
              ].map((r) => (
                <tr key={r.c}>
                  <td className="px-3 py-2 font-medium text-gray-900">{r.c}</td>
                  <td className="px-3 py-2 text-gray-700">{r.b}</td>
                  <td className="px-3 py-2 text-gray-700">{r.m}</td>
                  <td className="px-3 py-2 text-gray-700">{r.a}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* 6. Matriz de Risco */}
      <Section titulo="6. Matriz de Risco — Gravidade × Probabilidade">
        <p className="mb-4 text-sm text-gray-600">
          O nível de risco final de cada tópico é obtido cruzando a{" "}
          <strong>gravidade</strong> (calculada pelo questionário) com a{" "}
          <strong>probabilidade</strong> (definida pelo psicólogo). O resultado
          é enquadrado em quatro níveis de risco.
        </p>

        {/* Tabela da matriz 3x3 */}
        <div className="mb-4 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-xs text-center">
            <thead className="bg-gray-50">
              <tr>
                <th className="border-b border-r border-gray-200 px-3 py-2 text-left text-[10px] font-semibold uppercase text-gray-500">
                  Gravidade ↓ / Probabilidade →
                </th>
                <th className="border-b border-r border-gray-200 px-3 py-2 text-[10px] font-semibold text-blue-700">Baixa (1)</th>
                <th className="border-b border-r border-gray-200 px-3 py-2 text-[10px] font-semibold text-blue-700">Média (2)</th>
                <th className="border-b border-gray-200 px-3 py-2 text-[10px] font-semibold text-blue-700">Alta (3)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="border-r border-gray-200 px-3 py-2.5 text-left font-semibold text-red-700">Alta (3)</td>
                <MatrizCell nivel="Médio"   cor="bg-yellow-100 text-yellow-800" />
                <MatrizCell nivel="Alto"    cor="bg-red-100 text-red-800" />
                <MatrizCell nivel="Crítico" cor="bg-gray-900 text-white" />
              </tr>
              <tr>
                <td className="border-r border-gray-200 px-3 py-2.5 text-left font-semibold text-yellow-700">Média (2)</td>
                <MatrizCell nivel="Baixo"  cor="bg-green-100 text-green-800" />
                <MatrizCell nivel="Médio"  cor="bg-yellow-100 text-yellow-800" />
                <MatrizCell nivel="Alto"   cor="bg-red-100 text-red-800" />
              </tr>
              <tr>
                <td className="border-r border-gray-200 px-3 py-2.5 text-left font-semibold text-green-700">Baixa (1)</td>
                <MatrizCell nivel="Baixo" cor="bg-green-100 text-green-800" />
                <MatrizCell nivel="Baixo" cor="bg-green-100 text-green-800" />
                <MatrizCell nivel="Médio" cor="bg-yellow-100 text-yellow-800" />
              </tr>
            </tbody>
          </table>
        </div>

        {/* Legenda dos 4 níveis */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <NivelCard
            nivel="Baixo"
            cor="border-green-300 bg-green-50"
            corBadge="bg-green-600"
            descricao="Risco controlável. Manter monitoramento periódico e boas práticas."
          />
          <NivelCard
            nivel="Médio"
            cor="border-yellow-300 bg-yellow-50"
            corBadge="bg-yellow-500"
            descricao="Atenção necessária. Implementar medidas preventivas e reavaliar em ciclo mais curto."
          />
          <NivelCard
            nivel="Alto"
            cor="border-red-300 bg-red-50"
            corBadge="bg-red-600"
            descricao="Risco significativo. Intervenção imediata recomendada com plano de ação estruturado."
          />
          <NivelCard
            nivel="Crítico"
            cor="border-gray-700 bg-gray-900"
            corBadge="bg-gray-900 border border-gray-600"
            corTexto="text-gray-100"
            descricao="Risco grave. Ação urgente e prioritária. Envolvimento da alta direção obrigatório."
          />
        </div>
      </Section>

      {/* 7. Fluxo do processo */}
      <Section titulo="7. Fluxo do Processo DRPS">
        <ol className="space-y-3">
          {FLUXO.map((etapa, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-semibold text-gray-900">{etapa.titulo}</p>
                <p className="text-xs text-gray-600">{etapa.descricao}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

    </div>
  );
}

// ─── Dados ────────────────────────────────────────────────────────────────────

const TOPICOS_META = [
  { id: "T01", nome: "Assédio de qualquer natureza no trabalho",       perguntas: 5, fonte: "Cultura permissiva; ausência de canal de denúncia; liderança despreparada." },
  { id: "T02", nome: "Falta de suporte / apoio no trabalho",           perguntas: 5, fonte: "Liderança ausente; falta de escuta; RH pouco atuante." },
  { id: "T03", nome: "Má gestão de mudanças organizacionais",          perguntas: 4, fonte: "Comunicação inadequada; mudanças abruptas; insegurança quanto à estabilidade." },
  { id: "T04", nome: "Baixa clareza de papel / função",                perguntas: 4, fonte: "Falta de definição de responsabilidades; ordens contraditórias." },
  { id: "T05", nome: "Baixas recompensas e reconhecimento",            perguntas: 3, fonte: "Ausência de feedback; foco exclusivo em metas; falta de plano de crescimento." },
  { id: "T06", nome: "Baixo controle no trabalho / Falta de autonomia",perguntas: 4, fonte: "Microgestão; excesso de burocracia; centralização de decisões." },
  { id: "T07", nome: "Baixa justiça organizacional",                   perguntas: 4, fonte: "Critérios pouco transparentes; favorecimento; desigualdade de tratamento." },
  { id: "T08", nome: "Eventos violentos ou traumáticos",               perguntas: 3, fonte: "Falta de protocolos de segurança; ausência de suporte pós-evento." },
  { id: "T09", nome: "Baixa demanda no trabalho (Subcarga)",           perguntas: 4, fonte: "Subutilização de competências; ociosidade; funções pouco desafiadoras." },
  { id: "T10", nome: "Excesso de demandas no trabalho (Sobrecarga)",   perguntas: 4, fonte: "Metas irrealistas; equipe insuficiente; jornadas prolongadas." },
  { id: "T11", nome: "Maus relacionamentos no local de trabalho",      perguntas: 3, fonte: "Comunicação agressiva; rivalidade interna; conflitos mal geridos." },
  { id: "T12", nome: "Trabalho em condições de difícil comunicação",   perguntas: 4, fonte: "Turnos desalinhados; distância física; fluxo de informação inadequado." },
  { id: "T13", nome: "Trabalho remoto e isolado",                      perguntas: 3, fonte: "Isolamento social; falta de acompanhamento; comunicação exclusivamente digital." },
];

const FLUXO = [
  { titulo: "Aplicação do questionário",        descricao: "O formulário DRPS (50 perguntas, 13 tópicos) é aplicado via Google Forms para todos os colaboradores do escopo, separados por setor." },
  { titulo: "Importação dos dados",             descricao: "O arquivo CSV/TSV exportado do Google Forms é colado na tela 'Dados do Forms'. O sistema detecta o separador automaticamente e valida cada linha." },
  { titulo: "Cálculo automático da gravidade",  descricao: "Para cada tópico e setor, o sistema calcula a pontuação corrigida de cada pergunta, classifica em Baixa/Média/Alta e calcula a média do tópico." },
  { titulo: "Definição da probabilidade",       descricao: "O psicólogo responsável avalia, para cada setor × tópico, a probabilidade (1–3) com base nos critérios de frequência, histórico e recursos disponíveis." },
  { titulo: "Geração da matriz de risco",       descricao: "Gravidade × Probabilidade gera o nível final (Baixo / Médio / Alto / Crítico) para cada tópico, exibido no dashboard e na matriz visual." },
  { titulo: "Análise e avaliação",              descricao: "O psicólogo documenta os agravos potenciais à saúde e as medidas existentes por setor na aba 'Análise e Avaliação'." },
  { titulo: "Plano de ação (medidas de controle)", descricao: "Com base nos riscos identificados, são definidas medidas preventivas, responsáveis e cronograma no Painel de Gestão." },
  { titulo: "Monitoramento e revisão",          descricao: "O ciclo é revisado periodicamente conforme exigência do PGR/GRO, gerando novas revisões do relatório com comparação histórica." },
];

// ─── Componentes auxiliares ───────────────────────────────────────────────────

function Section({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 border-b border-gray-200 pb-1.5 text-base font-semibold text-gray-900">
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function LegalCard({ sigla, titulo, texto }: { sigla: string; titulo: string; texto: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <span className="mb-1 inline-block rounded bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
        {sigla}
      </span>
      <p className="mb-1 text-sm font-semibold text-gray-900">{titulo}</p>
      <p className="text-xs text-gray-600 leading-relaxed">{texto}</p>
    </div>
  );
}

function InfoCard({ titulo, cor, corTitulo, texto }: { titulo: string; cor: string; corTitulo: string; texto: string }) {
  return (
    <div className={`rounded-xl border p-4 ${cor}`}>
      <p className={`mb-1.5 text-sm font-semibold ${corTitulo}`}>{titulo}</p>
      <p className="text-xs text-gray-700 leading-relaxed">{texto}</p>
    </div>
  );
}

function LimiarRow({ cor, label, regra }: { cor: string; label: string; regra: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg px-3 py-1.5 border border-gray-100">
      <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${cor}`}>{label}</span>
      <span className="text-gray-600">{regra}</span>
    </div>
  );
}

function ProbCard({ num, titulo, itens }: { num: string; titulo: string; itens: string[] }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex size-5 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
          {num}
        </span>
        <p className="text-sm font-semibold text-gray-900">{titulo}</p>
      </div>
      <ul className="space-y-1 text-xs text-gray-600">
        {itens.map((item, i) => <li key={i}>• {item}</li>)}
      </ul>
    </div>
  );
}

function MatrizCell({ nivel, cor }: { nivel: string; cor: string }) {
  return (
    <td className={`border-r border-gray-200 px-3 py-2.5 text-xs font-bold last:border-r-0 ${cor}`}>
      {nivel}
    </td>
  );
}

function NivelCard({
  nivel, cor, corBadge, corTexto = "text-gray-900", descricao,
}: {
  nivel: string; cor: string; corBadge: string; corTexto?: string; descricao: string;
}) {
  return (
    <div className={`rounded-xl border p-4 ${cor}`}>
      <span className={`mb-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-bold text-white ${corBadge}`}>
        {nivel}
      </span>
      <p className={`text-xs leading-relaxed ${corTexto}`}>{descricao}</p>
    </div>
  );
}
