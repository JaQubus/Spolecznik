import { ApplicationForm } from "./application-form";
import type { ApplicationPrefill } from "./model";
import { parseCallFormSchema, type CallFormSchema } from "@/lib/call-schema";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const metadata = { title: "Wypełnij wniosek o grant" };

type ActiveCall = { id: string; title: string; formSchema: CallFormSchema };

async function activeCall(): Promise<ActiveCall | null> {
  if (!isSupabaseConfigured()) return null;
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await createAdminClient()
    .from("calls")
    .select("id, title, form_schema")
    .eq("active", true)
    .or(`opens_at.is.null,opens_at.lte.${today}`)
    .or(`closes_at.is.null,closes_at.gte.${today}`)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[wniosek] Nie udało się sprawdzić aktywnego naboru", error);
    return null;
  }
  if (!data) return null;
  try {
    return { id: data.id, title: data.title, formSchema: parseCallFormSchema(data.form_schema) };
  } catch (error) {
    console.error("[wniosek] Nieprawidłowy form_schema aktywnego naboru", error);
    return null;
  }
}

export default async function Page(props: PageProps<"/wniosek">) {
  const call = await activeCall();
  if (!call) {
    return (
      <section className="space-y-4">
        <h1 className="text-3xl font-bold">Nabór jest zamknięty</h1>
        <p className="max-w-2xl text-lg">
          Generator wniosku będzie dostępny, gdy administrator uruchomi aktywny nabór.
        </p>
      </section>
    );
  }

  const params = await props.searchParams;
  const prefill: ApplicationPrefill = {
    tytul: typeof params.tytul === "string" ? params.tytul : undefined,
    problem: typeof params.problem === "string" ? params.problem : undefined,
    opis: typeof params.opis === "string" ? params.opis : undefined,
    odbiorcy: typeof params.odbiorcy === "string" ? params.odbiorcy : undefined,
  };
  const hasPrefill = Object.values(prefill).some((value) => value?.trim());

  return (
    <section className="space-y-8">
      <div className="space-y-4 print:hidden">
        <h1 className="text-3xl font-bold">Wypełnij wniosek o grant</h1>
        <p className="max-w-2xl text-lg">
          Formularz aplikacyjny do naboru „{call.title}” (ROPS w Krakowie). Przeprowadzimy Cię przez niego krok po kroku,
          a na końcu dostaniesz wypełniony wniosek do wydruku, podpisu i wysłania.
        </p>
        <p className="max-w-2xl">Zajmie to około godziny. Przygotuj dane kontaktowe, krótki opis pomysłu i szacunkowe koszty.</p>
      </div>
      <ApplicationForm call={call} prefill={hasPrefill ? prefill : undefined} />
    </section>
  );
}
