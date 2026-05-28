import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHmac } from "crypto";
import { createSupabaseServerClient } from "@/lib/supabase/client";

export async function POST(_req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const secret = process.env.PDF_SERVICE_SECRET;
  const serviceUrl = process.env.PDF_SERVICE_URL;

  if (!secret || !serviceUrl) {
    return NextResponse.json(
      { error: "Serviço de PDF não configurado. Contate o suporte." },
      { status: 503 }
    );
  }

  // Token válido por 2 minutos — tempo suficiente para o cliente
  // enviar o HTML ao Railway e receber o PDF.
  const payload = Buffer.from(
    JSON.stringify({
      uid: user.id,
      exp: Date.now() + 2 * 60 * 1000,
      aud: "pdf-render",
    })
  ).toString("base64url");

  const sig = createHmac("sha256", secret).update(payload).digest("hex");

  return NextResponse.json({ token: `${payload}.${sig}`, serviceUrl });
}
