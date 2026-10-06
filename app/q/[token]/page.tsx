import QuestionarioAnonimo from "@/components/qps/QuestionarioAnonimo";

export const metadata = { title: "Questionário anônimo · JCN Consultoria", robots: { index: false, follow: false } };

// Página PÚBLICA (sem login) do questionário anônimo da AEP — v273.
// Liberada no middleware pelo prefixo `/q/`.
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <QuestionarioAnonimo token={token} />;
}
