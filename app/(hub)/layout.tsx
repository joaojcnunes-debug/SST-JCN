"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/lib/store";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function HubLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const user = useUserStore((s) => s.user);
  const setUser = useUserStore((s) => s.setUser);

  useEffect(() => {
    let mounted = true;
    const supabase = createSupabaseBrowserClient();

    (async () => {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser || !authUser.email) {
        router.replace("/login");
        return;
      }

      if (user && user.email === authUser.email) return;

      const { data: perfil } = await supabase
        .from("usuarios")
        .select("*")
        .eq("email", authUser.email)
        .single();

      if (!mounted) return;
      if (perfil) setUser(perfil);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setUser(null);
        router.replace("/login");
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{children}</>;
}
