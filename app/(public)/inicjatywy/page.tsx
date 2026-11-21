import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { NoDatabase } from "@/components/layout/no-database";
import { DomainIcon } from "@/components/taxonomy/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { listPublicInitiatives, publicInitiativesAvailable } from "@/lib/initiatives/public";
import { initiativeHref } from "@/lib/knowledge/hrefs";
import { plural } from "@/lib/pl";
import {
  DOMAIN_KEYS, domainLabel, INSTITUTION_KEYS, institutionLabel, signalLevel, STAGE_KEYS, stageLabel,
  type DomainKey, type InstitutionKey, type StageKey,
} from "@/lib/taxonomy";
import { region } from "@/lib/brand";

export const metadata: Metadata = { title: "Inicjatywy", description: `Lokalne inicjatywy ${region.genitive} po weryfikacji.` };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
const pick = <T extends string>(keys: readonly T[], v: string) => (keys as readonly string[]).includes(v) ? (v as T) : undefined;

/** Baza opublikowanych inicjatyw z filtrami w adresie (działa bez JavaScriptu). Mapa i radar dochodzą w kolejnych krokach. */
export default async function Page(props: PageProps<"/inicjatywy">) {
  if (!publicInitiativesAvailable()) return <NoDatabase />;
  const sp = await props.searchParams;
  const domain = pick<DomainKey>(DOMAIN_KEYS, one(sp.dziedzina));
  const institution = pick<InstitutionKey>(INSTITUTION_KEYS, one(sp.instytucja));
  const stage = pick<StageKey>(STAGE_KEYS, one(sp.etap));
  const items = await listPublicInitiatives({ domain, institution, stage });
  const n = items.length;

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <h1 className="text-4xl font-bold">Inicjatywy {region.locative}</h1>
        <p className="max-w-2xl text-xl">
          Inicjatywy ze szkół, uczelni, samorządów i instytucji publicznych, które zespół zweryfikował. Każdą można przenieść do siebie.
        </p>
      </header>

      <Form action="/inicjatywy" className="flex flex-col gap-6 rounded-[16px] bg-secondary p-5 md:flex-row md:items-end">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="f-dziedzina">Dziedzina</Label>
          <NativeSelect id="f-dziedzina" name="dziedzina" defaultValue={domain ?? ""}>
            <option value="">Wszystkie dziedziny</option>
            {DOMAIN_KEYS.map((d) => <option key={d} value={d}>{domainLabel(d)}</option>)}
          </NativeSelect>
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="f-instytucja">Typ instytucji</Label>
          <NativeSelect id="f-instytucja" name="instytucja" defaultValue={institution ?? ""}>
            <option value="">Wszystkie typy</option>
            {INSTITUTION_KEYS.map((k) => <option key={k} value={k}>{institutionLabel(k)}</option>)}
          </NativeSelect>
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="f-etap">Etap</Label>
          <NativeSelect id="f-etap" name="etap" defaultValue={stage ?? ""}>
            <option value="">Wszystkie etapy</option>
            {STAGE_KEYS.map((k) => <option key={k} value={k}>{stageLabel(k)}</option>)}
          </NativeSelect>
        </div>
        <Button type="submit" variant="outline">Pokaż</Button>
      </Form>

      <p role="status" className="text-lg font-bold">
        {n === 0 ? "Brak inicjatyw dla wybranych filtrów." : `Znaleziono ${n} ${plural(n, "inicjatywę", "inicjatywy", "inicjatyw")}.`}
      </p>

      <ul className="max-w-[56rem] divide-y divide-border border-y border-border">
        {items.map((i) => (
          <li key={i.id} className="flex items-start gap-4 py-5">
            {i.domains[0] && <DomainIcon domain={i.domains[0]} className="mt-1 size-10" iconClassName="size-6" />}
            <div className="min-w-0 space-y-1">
              <h2 className="text-xl font-bold">
                {i.slug
                  ? <Link href={initiativeHref(i.slug)} className="underline decoration-1 underline-offset-4 hover:decoration-2">{i.title}</Link>
                  : i.title}
              </h2>
              <p>{i.summary}</p>
              <p className="text-base text-muted-foreground">
                {[i.municipality && `gmina ${i.municipality}`, i.institution_type && institutionLabel(i.institution_type), i.stage && stageLabel(i.stage)]
                  .filter(Boolean).join(" · ")}
              </p>
              <p className="flex flex-wrap gap-2">
                {i.signal != null && <Badge>Sygnał {i.signal}/100: {signalLevel(i.signal).label}</Badge>}
                {i.synthetic && <Badge>Przykład demonstracyjny</Badge>}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
