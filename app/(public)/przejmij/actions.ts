"use server";

import { redirect } from "next/navigation";
import { rememberedKey } from "@/lib/initiatives/access";
import { ClaimRequest } from "@/lib/schemas";
import { ClaimError, claimInitiative } from "@/lib/sources";

export type ClaimState = { error: string; field?: string } | null;

const list = (f: FormData, name: string) => f.getAll(name).map(String).filter(Boolean);
const text = (f: FormData, name: string) => String(f.get(name) ?? "").trim();

/** Przejęcie wykrytej inicjatywy: klucz z ciasteczka (zapisał go link /przejmij/KOD/klucz), karta z formularza. */
export async function claim(_prev: ClaimState, formData: FormData): Promise<ClaimState> {
  const trl = text(formData, "trl");
  const parsed = ClaimRequest.safeParse({
    code: text(formData, "code"),
    confirm: formData.get("confirm") === "on",
    card: {
      title: text(formData, "title"),
      summary: text(formData, "summary"),
      problem: text(formData, "problem"),
      solution: text(formData, "solution"),
      effects: text(formData, "effects") || null,
      beneficiaries: text(formData, "beneficiaries") || null,
      stage: text(formData, "stage"),
      innovationKind: text(formData, "innovationKind"),
      sectors: list(formData, "sectors"),
      trl: trl ? Number(trl) : null,
      ipStatus: text(formData, "ipStatus") || null,
      creatorRoles: list(formData, "creatorRoles"),
    },
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue.path.at(-1)?.toString();
    const messages: Record<string, string> = {
      title: "Wpisz nazwę rozwiązania (co najmniej 3 znaki).",
      sectors: "Wybierz co najmniej jeden sektor.",
      confirm: "Potwierdź, że reprezentujesz twórców albo instytucję.",
    };
    return { error: (field && messages[field]) ?? "Sprawdź pola formularza.", field };
  }
  const key = await rememberedKey(parsed.data.code);
  if (!key) return { error: "Otwórz ponownie link do przejęcia z wiadomości od zespołu." };
  try {
    await claimInitiative(parsed.data, key);
  } catch (e) {
    if (e instanceof ClaimError) return { error: e.message };
    console.error("[przejęcie]", e);
    return { error: "Nie udało się zapisać. Spróbuj ponownie." };
  }
  redirect(`/status/${parsed.data.code}?przejeto=1`);
}
