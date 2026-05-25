import { redirect } from "next/navigation";

export default async function AepRelatorioRoot({
  params,
}: {
  params: Promise<{ idRelatorio: string }>;
}) {
  const { idRelatorio } = await params;
  redirect(`/aep/${idRelatorio}/setores`);
}
