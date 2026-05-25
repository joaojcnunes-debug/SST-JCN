import { redirect } from "next/navigation";

export default async function AetRelatorioRoot({
  params,
}: {
  params: Promise<{ idRelatorio: string }>;
}) {
  const { idRelatorio } = await params;
  redirect(`/aet/${idRelatorio}/dados`);
}
