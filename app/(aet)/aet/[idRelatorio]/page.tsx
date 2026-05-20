import { redirect } from "next/navigation";

export default function AetRelatorioRoot({
  params,
}: {
  params: { idRelatorio: string };
}) {
  redirect(`/aet/${params.idRelatorio}/dados`);
}
