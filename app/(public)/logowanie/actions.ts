"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { ok: boolean; message: string; email?: string } | null;

const Email = z.email();

export async function sendMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!Email.safeParse(email).success) {
    return { ok: false, message: "Wpisz adres e-mail w formacie nazwa@domena.pl", email };
  }
  const next = safeNext(String(formData.get("next") ?? ""));
  const origin = (await headers()).get("origin");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) {
    console.error("[logowanie]", error);
    return { ok: false, message: "Nie udało się wysłać linku. Spróbuj ponownie za minutę.", email };
  }
  return { ok: true, message: `Wysłaliśmy link na adres ${email}. Otwórz e-mail i kliknij link, żeby się zalogować.`, email };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
