"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, LogOut } from "lucide-react";
import AvatarPessoa from "@/components/gestao/AvatarPessoa";
import { GoogleAgendaMenu } from "@/components/gestao/GoogleAgendaMenu";
import { PreferenciasAvisoMenu } from "@/components/gestao/PreferenciasAvisoMenu";
import { useSair } from "@/lib/hooks/useSair";
import { useUserStore } from "@/lib/store";

function iniciaisDe(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

/**
 * Menu da foto (0.3.258, do Painel 0.3.896/0.3.897): clicar na foto/sigla de quem está logado abre o nome e o
 * e-mail, Notificações e Sair. (No Painel o menu também tem as OS da T.I, que são só da Chabra.)
 *   `avisos`         bolinha vermelha na foto (notificações não lidas)
 *   `onNotificacoes` item "Notificações" — sem ele o item não aparece (ex.: Visão geral, que tem o sino ao lado).
 *                    Junto vêm as chaves No sistema / Por e-mail e a Google Agenda (0.3.265, do Painel 0.3.916; antes no
 *                    topo do Meu Espaço). Só montam com o menu aberto, então as consultas delas não rodam em toda página.
 *   `tema`           "verde" na barra colorida dos módulos; "claro" sobre fundo claro
 * O menu abre num portal (position: fixed no body): a barra superior (sticky z-20) e os cartões .reveal-up da Visão
 * geral isolam camadas, e o sino do Meu Espaço (z-40) ou o cartão de baixo cobriam o menu.
 */
export default function MenuDaFoto({ avisos = 0, onNotificacoes, tema = "verde" }: {
  avisos?: number;
  onNotificacoes?: () => void;
  tema?: "verde" | "claro";
}) {
  const user = useUserStore((s) => s.user);
  const sair = useSair();
  const [aberto, setAberto] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (!ref.current?.contains(alvo) && !menuRef.current?.contains(alvo)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAberto(false); };
    // Fixo na tela: se a página rola ou muda de tamanho, a foto sai do lugar — fecha.
    const fechar = () => setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    window.addEventListener("scroll", fechar, true);
    window.addEventListener("resize", fechar);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
      window.removeEventListener("scroll", fechar, true);
      window.removeEventListener("resize", fechar);
    };
  }, [aberto]);

  if (!user) return null;
  const iniciais = (
    <span className={`flex size-8 items-center justify-center rounded-full text-xs font-bold ${tema === "verde" ? "bg-white/15 text-white ring-1 ring-white/25" : "bg-marca-light text-marca-primary ring-1 ring-marca-primary/20"}`}>
      {iniciaisDe(user.nome)}
    </span>
  );
  const base = "flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm transition";
  const item = `${base} text-gray-700 hover:bg-gray-50`;

  function alternar() {
    if (aberto) { setAberto(false); return; }
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const largura = document.documentElement.clientWidth;
    const w = Math.min(288, largura - 32); // w-72, sem passar de 100vw - 2rem
    // Barra verde: alinha pela direita da foto; fundo claro (Visão geral): pela esquerda, sem sair da tela.
    const left = tema === "claro" ? Math.min(r.left, largura - w - 16) : r.right - w;
    setPos({ top: r.bottom + 8, left: Math.max(16, left) });
    setAberto(true);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={alternar}
        aria-haspopup="menu"
        aria-expanded={aberto}
        title={avisos > 0 ? `${avisos} notificação(ões) não lida(s) — abrir o menu` : "Abrir o menu"}
        className="relative z-40 flex size-8 shrink-0 items-center justify-center rounded-full"
      >
        {/* Foto da conta Google (de quem conectou o Google na Gestão, v302); senão as iniciais. */}
        <AvatarPessoa nome={user.nome} email={user.email} className={`size-8 text-xs ${tema === "verde" ? "ring-1 ring-white/25" : "ring-1 ring-marca-primary/20"}`} fallback={iniciais} />
        {avisos > 0 && (
          <span className={`absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ${tema === "verde" ? "ring-[#0369a1]" : "ring-white"}`}>
            {avisos > 99 ? "99+" : avisos}
          </span>
        )}
      </button>
      {aberto && createPortal(
        <div ref={menuRef} role="menu" style={pos} className="fixed z-50 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-gray-200 bg-white py-1.5 shadow-lg">
          <div className="border-b border-gray-100 px-4 pb-2 pt-1">
            <p className="truncate text-sm font-semibold text-gray-900">{user.nome}</p>
            {user.email && <p className="truncate text-xs text-gray-500">{user.email}</p>}
          </div>
          {onNotificacoes && (
            <>
              <button type="button" role="menuitem" onClick={() => { setAberto(false); onNotificacoes(); }} className={item}>
                <Bell className="size-4 shrink-0 text-gray-400" /> Notificações
                {avisos > 0 && <span className="ml-auto rounded-full bg-red-600 px-1.5 text-[11px] font-bold text-white">{avisos > 99 ? "99+" : avisos}</span>}
              </button>
              {/* 10/11/2026: as chaves de aviso e a Google Agenda saíram do topo do Meu Espaço para cá. */}
              <PreferenciasAvisoMenu />
              <GoogleAgendaMenu />
            </>
          )}
          <div className="my-1 border-t border-gray-100" />
          <button type="button" role="menuitem" onClick={() => { setAberto(false); void sair(); }} className={`${base} text-red-600 hover:bg-red-50`}>
            <LogOut className="size-4 shrink-0" /> Sair
          </button>
        </div>,
        document.body,
      )}
    </div>
  );
}
