import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PlanDocument } from "@/components/wdrozenie/plan-document";
import { requireAdmin, viewerClient } from "@/lib/auth";
import { getPlan } from "@/lib/panel/plans";
import { formatDate } from "@/lib/pl";

export const metadata = { title: "Plan wdrożenia · Panel ROPS" };

const linkClass = "underline decoration-1 underline-offset-4 hover:decoration-2";

export default async function Page(props: PageProps<"/panel/wdrozenia/[id]">) {
  const viewer = await requireAdmin();
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();

  const doc = await getPlan(await viewerClient(viewer), id);
  if (!doc) notFound();

  return (
    <section className="space-y-6">
      <Link href="/panel/wdrozenia" className={`inline-flex items-center gap-2 text-lg print:hidden ${linkClass}`}>
        <ArrowLeftIcon aria-hidden className="size-5" /> Wszystkie plany
      </Link>
      <h1 className="text-3xl font-bold print:hidden">Plan wdrożenia z {formatDate(doc.createdAt)}</h1>
      <PlanDocument doc={doc} />
    </section>
  );
}
