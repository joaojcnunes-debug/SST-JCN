/** Formata data ISO (yyyy-mm-dd) para "dd/mm/yyyy". String vazia se inválido. */
export function formatarDataBR(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("pt-BR");
  } catch {
    return "";
  }
}
