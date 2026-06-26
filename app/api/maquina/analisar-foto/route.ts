import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/client";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

const SYSTEM_PROMPT = `Você é um especialista em máquinas e equipamentos industriais brasileiros.
Sua tarefa: analisar a foto de uma máquina ou de sua plaqueta de identificação (nameplate) e extrair os dados técnicos.

Responda APENAS com JSON válido (sem markdown, sem cercas, sem texto fora do JSON):
{
  "nome": "nome da máquina (ex: Amassadeira, Torno CNC, Prensa Hidráulica) — string ou null",
  "tipo": "tipo genérico (ex: Amassadeira, Torno, Prensa) — string ou null",
  "categoria": "categoria do equipamento (ex: Máquina de Panificação, Máquina-Ferramenta) — string ou null",
  "marca": "fabricante ou marca visível (ex: Prática Technipan, ROMI, WEG) — string ou null",
  "modelo": "modelo específico se visível (ex: AETP80, PH-200T) — string ou null",
  "numero_serie": "número de série se visível na plaqueta — string ou null",
  "ano_fabricacao": "ano de fabricação como número inteiro se visível — number ou null",
  "capacidade_operacional": "capacidade ou produtividade se visível (ex: 80 kg/h, 5 KG/MIN) — string ou null",
  "tensao": "tensão elétrica se visível (ex: 220V, 380V, 220/380V) — string ou null",
  "potencia": "potência se visível (ex: 5 CV, 3.7 kW, 1.5 HP) — string ou null",
  "tag": "TAG ou número de patrimônio se visível em etiqueta/plaqueta — string ou null",
  "descricao_tecnica": "descrição técnica elaborada (3 a 5 frases): função/finalidade da máquina, principais partes móveis e/ou cortantes (ex: rosca sem-fim, lâminas, eixos, polias), e as ZONAS DE PERIGO segundo a NR-12 (pontos de prensagem, corte, arrasto, esmagamento — ex: boca de alimentação, área de descarga). Seja específico para o tipo de máquina identificado. — string ou null",
  "protecao_fixa": "true se proteções fixas (grades, carenagens parafusadas) são INEQUIVOCAMENTE visíveis cobrindo zonas de risco; false se a zona de risco está claramente exposta sem proteção; null se não dá pra avaliar — boolean ou null",
  "protecao_movel": "true se proteções móveis (portas, tampas articuladas sobre zona de risco) são INEQUIVOCAMENTE visíveis — boolean ou null",
  "intertravamento": "true SOMENTE se a chave/dispositivo de intertravamento for visível na proteção — boolean ou null",
  "botao_emergencia": "true SOMENTE se o botão de emergência (cogumelo vermelho sobre fundo amarelo) for claramente visível — boolean ou null",
  "sistema_bloqueio": "true SOMENTE se cadeado/seccionadora bloqueável (LOTO) for claramente visível — boolean ou null",
  "aterramento": "true SOMENTE se cabo/ponto de aterramento for claramente visível — boolean ou null",
  "sinalizacao": "true SOMENTE se sinalização de segurança (placas, pictogramas, faixas de advertência) for claramente visível — boolean ou null",
  "necessita_adequacao_nr12": "true se a máquina aparenta NÃO atender plenamente à NR-12 (zonas de risco expostas, proteções/dispositivos de segurança ausentes ou insuficientes); false somente se aparenta estar plenamente adequada; null se não der pra avaliar — boolean ou null",
  "grau_risco": "grau de risco estimado da máquina conforme a gravidade dos perigos visíveis e o tipo de equipamento: 'BAIXO', 'MEDIO', 'ALTO' ou 'CRITICO' — string ou null"
}

REGRA CRÍTICA dos campos booleanos de segurança: a AUSÊNCIA de evidência NÃO é evidência de presença. Só responda true se o dispositivo estiver inequivocamente visível e identificável na imagem. Se você não consegue VER o dispositivo, responda null (NUNCA true). É preferível deixar null e o técnico preencher do que afirmar uma proteção que não existe.
Para 'necessita_adequacao_nr12' e 'grau_risco': baseie-se nos perigos visíveis e no tipo de máquina (ex: serras, prensas, máquinas com rosca sem-fim ou lâminas expostas tendem a ALTO/CRITICO). Na dúvida, null.
Não invente dados de identificação (modelo, série, ano, potência, tensão) que não estejam legíveis na plaqueta — use null.`;

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) return NextResponse.json({ error: "GROQ_API_KEY não configurada." }, { status: 500 });

  // Aceita 1 imagem (legado: imageBase64/mimeType) ou várias (images[])
  let dataUrls: string[];
  try {
    const body = await req.json();
    const images: { b64: string; mime?: string }[] = Array.isArray(body.images)
      ? body.images
      : body.imageBase64
        ? [{ b64: body.imageBase64, mime: body.mimeType }]
        : [];
    if (images.length === 0) throw new Error("Nenhuma imagem enviada");
    dataUrls = images
      .slice(0, 4)
      .map((i) => `data:${i.mime ?? "image/jpeg"};base64,${i.b64}`);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Payload inválido" }, { status: 400 });
  }

  try {
    const groqRes = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              ...dataUrls.map((url) => ({ type: "image_url", image_url: { url } })),
              { type: "text", text: `Analise ${dataUrls.length > 1 ? "estas imagens (mesma máquina, ângulos diferentes)" : "esta imagem"} e retorne os dados técnicos da máquina no formato JSON definido.` },
            ],
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 900,
      }),
    });

    if (!groqRes.ok) {
      const txt = await groqRes.text();
      return NextResponse.json({ error: `Groq ${groqRes.status}: ${txt.slice(0, 300)}` }, { status: 502 });
    }

    const groqData = await groqRes.json();
    const content: string | undefined = groqData?.choices?.[0]?.message?.content;
    if (!content) return NextResponse.json({ error: "Resposta vazia do modelo" }, { status: 502 });

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json({ error: "JSON inválido do modelo", raw: content.slice(0, 400) }, { status: 502 });
    }

    return NextResponse.json({ data: parsed });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro desconhecido" }, { status: 500 });
  }
}
