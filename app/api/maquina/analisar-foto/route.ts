import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/client";
import { erroLimiteIaDaFuncao } from "@/lib/ia/limite-groq";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
// llama-4-scout morreu no Groq em 17/07/2026 (medido 404 em 14/09). O qwen3.6
// exige reasoning_effort "none": com raciocinio ligado gasta os max_tokens
// pensando e o JSON mode devolve 400 json_validate_failed (medido 14/09).
// v0.3.148 (painel v0.3.662): o painel trocou para o qwen3.8-27b. Na conta Groq do JCN o
// qwen3.6 dá 404 (ver a edge function analisar-maquina-ia), então vira lista com fallback.
const VISION_MODELS = [
  "qwen/qwen3.8-27b",
  "meta-llama/llama-4-maverick-17b-128e-instruct",
  "qwen/qwen3.6-27b",
];
// Era 4. Cada foto custa ~1.870 tokens de entrada num plano de 8.000/min:
// 4 fotos encostam no teto, 3 cabem com folga.
const MAX_FOTOS = 3;

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
  "necessita_adequacao_nr12": "true se a máquina aparenta NÃO atender plenamente à NR-12 (zonas de risco expostas, proteções/dispositivos de segurança ausentes ou insuficientes); false somente se aparenta estar plenamente adequada; null se não der pra avaliar — boolean ou null"
}

NÃO responda sobre a presença de dispositivos de segurança específicos (proteção fixa,
proteção móvel, intertravamento, botão de emergência, sistema de bloqueio/LOTO,
aterramento, sinalização) nem sobre grau de risco. Esses campos foram removidos deste
contrato de propósito — quem os preenche é o técnico em campo. Se você mencioná-los,
faça-o apenas dentro de 'descricao_tecnica', como observação, nunca como afirmação de
conformidade.

Para 'necessita_adequacao_nr12': baseie-se nos perigos visíveis e no tipo de máquina. Na dúvida, null.
Não invente dados de identificação (modelo, série, ano, potência, tensão) que não estejam legíveis na plaqueta — use null.
Nunca devolva a string "null" — devolva o valor nulo do JSON.`;

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
      .slice(0, MAX_FOTOS)
      .map((i) => `data:${i.mime ?? "image/jpeg"};base64,${i.b64}`);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Payload inválido" }, { status: 400 });
  }

  try {
    // Tenta os modelos em ordem; modelo retirado/sem acesso (404, 400) passa para o próximo.
    // 429 (limite) também tenta o próximo — cada modelo tem a sua cota.
    let groqRes: Response | null = null;
    const falhas: string[] = [];
    for (const model of VISION_MODELS) {
      groqRes = await fetch(GROQ_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
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
          // qwen3.x com raciocínio ligado gasta os max_tokens pensando e o JSON mode falha.
          ...(model.startsWith("qwen/qwen3") ? { reasoning_effort: "none" } : {}),
          temperature: 0.1,
          max_tokens: 900,
        }),
      });
      if (groqRes.ok) break;
      falhas.push(`${model}: ${groqRes.status} ${(await groqRes.text()).slice(0, 200)}`);
      if (groqRes.status === 401) break;
    }

    if (!groqRes || !groqRes.ok) {
      const txt = falhas.join(" | ");
      // Todos no limite: a frase com a espera (mesma da IA nas edge functions).
      const limite = erroLimiteIaDaFuncao(groqRes?.status ?? 502, JSON.stringify({ error: txt }));
      if (limite) {
        return NextResponse.json({ error: limite.message, codigo: limite.code }, { status: 429 });
      }
      return NextResponse.json({ error: `Groq falhou em todos os modelos — ${txt.slice(0, 600)}` }, { status: 502 });
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
