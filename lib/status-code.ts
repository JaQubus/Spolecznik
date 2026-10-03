// Kod zgłoszenia jak numer przesyłki: SPL-4K7Q. Bez 0/O/1/I, żeby senior się nie pomylił.
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function newStatusCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return "SPL-" + Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}
