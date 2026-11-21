"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

/** Wypisanie z alertów po tajnym tokenie z maila. Zapytanie nie zdradza, czy token istniał. */
export async function unsubscribeAlert(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  if (/^[0-9a-f]{32}$/.test(token)) {
    const { error } = await createAdminClient().from("innovation_alerts").update({ active: false }).eq("token", token);
    if (error) console.error("[alerty] wypisanie:", error);
  }
  redirect(`/alerty/${token.replace(/[^0-9a-f]/g, "")}?wypisano=1`);
}
