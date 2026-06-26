import FormularioPublico from "@/components/gestao/FormularioPublico";

export const metadata = { title: "Solicitação · JCN Consultoria" };

export default async function FormularioPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <FormularioPublico token={token} />;
}
