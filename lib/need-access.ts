import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { STATUS_CODE } from "./schemas";

/**
 * Dostęp do rozmowy o zgłoszeniu bez konta (README §6, „kod jak numer przesyłki”).
 * Krótki kod da się zgadnąć, więc do wątku potrzebny jest jeszcze tajny klucz (32 bajty).
 * Przeglądarka autora trzyma pary kod–klucz w ciasteczku httpOnly; na inne urządzenie przenosi je prywatny link.
 */

const COOKIE = "spl_zgloszenia";
const MAX_REMEMBERED = 20;
const KEY = /^[A-Za-z0-9_-]{43}$/;

export type RememberedNeed = { code: string; key: string };

export function newAccessKey(): { key: string; hash: string } {
  const key = randomBytes(32).toString("base64url");
  return { key, hash: hashKey(key) };
}

export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/** Porównanie w stałym czasie. Zgłoszenie bez klucza (starsze, syntetyczne) nie otwiera się nikomu. */
export function keyMatches(hash: string | null, key: string | null | undefined): boolean {
  if (!hash || !key || !KEY.test(key)) return false;
  const a = Buffer.from(hashKey(key), "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function isAccessKey(key: string): boolean {
  return KEY.test(key);
}

/** Format ciasteczka: KOD.klucz|KOD.klucz — najnowsze pierwsze. Klucz base64url nie zawiera „.” ani „|”. */
function parse(value: string | undefined): RememberedNeed[] {
  return (value ?? "")
    .split("|")
    .map((pair) => {
      const [code, key] = pair.split(".");
      return { code, key };
    })
    .filter((p) => STATUS_CODE.test(p.code ?? "") && KEY.test(p.key ?? ""));
}

export async function rememberedNeeds(): Promise<RememberedNeed[]> {
  return parse((await cookies()).get(COOKIE)?.value);
}

export async function rememberedKey(code: string): Promise<string | null> {
  return (await rememberedNeeds()).find((n) => n.code === code)?.key ?? null;
}

/** Tylko w route handlerach i akcjach serwerowych (Next pozwala tam ustawiać ciasteczka). */
export async function rememberNeed(code: string, key: string): Promise<void> {
  const store = await cookies();
  const list = [{ code, key }, ...parse(store.get(COOKIE)?.value).filter((n) => n.code !== code)].slice(0, MAX_REMEMBERED);
  store.set(COOKIE, list.map((n) => `${n.code}.${n.key}`).join("|"), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
