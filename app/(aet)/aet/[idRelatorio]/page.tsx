import { redirect } from "next/navigation";
import { use } from "react";

export default function AetRelatorioRoot({
  params,
}: {
  params: Promise<{ idRelatorio: string }>;
}) {
  const { idRelatorio } = use(params);
  redirect(`/aet/${idRelatorio}/dados`);
}
