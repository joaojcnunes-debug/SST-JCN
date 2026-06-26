import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/client";

export default async function ClienteLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("usuarios")
    .select("perfil")
    .eq("email", user.email!)
    .single();

  const perfil = (data as { perfil?: string } | null)?.perfil;
  if (perfil !== "Cliente") redirect("/inicio");

  return <>{children}</>;
}
