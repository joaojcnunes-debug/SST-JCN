export default function AjudaPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Ajuda — DRPS</h1>
        <p className="text-sm text-gray-600">
          Guia rápido do módulo Psicossocial.
        </p>
      </div>

      <Secao titulo="O que é o DRPS?">
        <p>
          O Diagnóstico de Riscos Psicossociais é a avaliação dos fatores
          organizacionais que afetam a saúde mental dos colaboradores,
          obrigatório no Programa de Gerenciamento de Riscos (PGR) conforme
          a NR-01 atualizada pela Portaria MTE nº 1.419/2024.
        </p>
      </Secao>

      <Secao titulo="Fluxo de uso">
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            <strong>Dados do Forms</strong> — cole as respostas do Google
            Sheets ou faça upload de CSV.
          </li>
          <li>
            <strong>Resumo por Tópico</strong> — filtre por setor e defina a
            probabilidade (1=Baixa, 2=Média, 3=Alta) de cada um dos 9 tópicos.
          </li>
          <li>
            <strong>Dashboard</strong> — visualize a matriz de risco, a
            gravidade média por tópico e a distribuição do risco final.
          </li>
        </ol>
      </Secao>

      <Secao titulo="Escala de respostas">
        <ul className="space-y-1">
          <li>0 — Nunca</li>
          <li>1 — Raramente</li>
          <li>2 — Ocasionalmente</li>
          <li>3 — Frequentemente</li>
          <li>4 — Sempre</li>
        </ul>
      </Secao>

      <Secao titulo="Como interpretar a Matriz de Risco">
        <p>
          A matriz cruza <strong>Gravidade</strong> (calculada a partir das
          respostas) com <strong>Probabilidade</strong> (definida pelo
          psicólogo). O nível final é classificado como Baixo, Médio, Alto
          ou Crítico.
        </p>
      </Secao>

      <Secao titulo="Lógica direta vs. invertida">
        <p>
          Perguntas <strong>diretas</strong> medem risco (quanto maior a
          resposta, maior o risco). Perguntas <strong>invertidas</strong>{" "}
          medem proteção (quanto maior a resposta, menor o risco — pontuação
          é convertida via 4 − valor antes de classificar).
        </p>
      </Secao>

      <Secao titulo="Referências">
        <ul className="space-y-1">
          <li>NR-01 — Disposições Gerais e Gerenciamento de Riscos</li>
          <li>Portaria MTE nº 1.419/2024</li>
          <li>Portaria MTE nº 765/2025</li>
        </ul>
      </Secao>
    </div>
  );
}

function Secao({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="mb-2 text-sm font-semibold text-gray-900">{titulo}</h2>
      <div className="space-y-1 text-sm text-gray-700">{children}</div>
    </div>
  );
}
