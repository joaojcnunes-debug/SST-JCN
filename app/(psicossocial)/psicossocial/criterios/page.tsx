export default function CriteriosPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">
          Critérios de Probabilidade
        </h1>
        <p className="text-sm text-gray-600">
          Guia para o psicólogo definir a probabilidade (1 a 3) por
          setor × tópico no Resumo por Tópico.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Bloco
          titulo="1. Frequência"
          itens={[
            "Com que regularidade o risco ocorre no setor?",
            "Qual a duração típica dos episódios de exposição ao risco?",
            "O risco é contínuo, recorrente ou esporádico?",
          ]}
        />
        <Bloco
          titulo="2. Histórico do Risco no Setor"
          itens={[
            "Há registros anteriores de ocorrências relacionadas a esse risco?",
            "Qual foi a gravidade dos incidentes anteriores?",
            "Quantos colaboradores foram afetados anteriormente?",
            "O risco já gerou afastamentos, atestados ou queixas formais?",
            "Já foram tomadas medidas corretivas anteriormente?",
          ]}
        />
        <Bloco
          titulo="3. Recursos Disponíveis"
          itens={[
            "Existem medidas preventivas implementadas atualmente?",
            "Com que frequência essas medidas são revisadas?",
            "Há conhecimento e treinamento dos gestores e colaboradores?",
            "Existem recursos financeiros e humanos dedicados à prevenção?",
            "A empresa possui suporte psicológico ou canal de escuta ativo?",
          ]}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Critério</th>
              <th className="px-3 py-2 text-left font-medium">Baixa (1)</th>
              <th className="px-3 py-2 text-left font-medium">Média (2)</th>
              <th className="px-3 py-2 text-left font-medium">Alta (3)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            <Linha
              criterio="Frequência"
              baixa="Raramente ocorre"
              media="Ocorre algumas vezes"
              alta="Ocorre frequentemente"
            />
            <Linha
              criterio="Histórico"
              baixa="Sem registros"
              media="Registros pontuais"
              alta="Histórico recorrente"
            />
            <Linha
              criterio="Recursos"
              baixa="Medidas efetivas"
              media="Medidas parciais"
              alta="Sem medidas"
            />
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Bloco({ titulo, itens }: { titulo: string; itens: string[] }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-2 text-sm font-semibold text-gray-900">{titulo}</h3>
      <ul className="space-y-1.5 text-xs text-gray-600">
        {itens.map((i, idx) => (
          <li key={idx}>• {i}</li>
        ))}
      </ul>
    </div>
  );
}

function Linha({
  criterio,
  baixa,
  media,
  alta,
}: {
  criterio: string;
  baixa: string;
  media: string;
  alta: string;
}) {
  return (
    <tr>
      <td className="px-3 py-2 font-medium text-gray-900">{criterio}</td>
      <td className="px-3 py-2 text-gray-700">{baixa}</td>
      <td className="px-3 py-2 text-gray-700">{media}</td>
      <td className="px-3 py-2 text-gray-700">{alta}</td>
    </tr>
  );
}
