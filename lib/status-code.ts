import { brand } from "@/lib/brand";
// Kod zgłoszenia jak numer przesyłki, np. RAD-4K7Q (prefiks z config/brand.json). Bez 0/O/1/I, żeby senior się nie pomylił.
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function newStatusCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return `${brand.statusPrefix}-` + Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}
