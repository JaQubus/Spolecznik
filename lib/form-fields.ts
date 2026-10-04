// Narzędzia formularzy wniosków (/wniosek, /wniosek-o-grant): ścieżki pól, kwoty, kod pocztowy, NIP i REGON.
// Czyste funkcje bez importów, żeby działały w przeglądarce i w testach.

// ---- Ścieżki pól: „osoba.imie”, „partnerzy.0.podmiot.nip”, „faza1.2.koszt”. Z nich powstają też id pól.

export function getAt(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o == null ? undefined : (o as Record<string, unknown>)[k]), obj);
}

export function setAt<T>(obj: T, path: string, value: unknown): T {
  const [head, ...rest] = path.split(".");
  const cur = obj as Record<string, unknown> | unknown[];
  const next = rest.length ? setAt(Array.isArray(cur) ? cur[Number(head)] : cur[head], rest.join("."), value) : value;
  if (Array.isArray(cur)) return cur.map((v, i) => (i === Number(head) ? next : v)) as T;
  return { ...cur, [head]: next } as T;
}

export const fieldId = (path: string) => `pole-${path.replace(/\./g, "-")}`;

// ---- Kwoty

/** „1 500,50 zł” → 1500.5; puste albo błędne → null. */
export function parseAmount(raw: string): number | null {
  const s = raw.replace(/\s|zł|pln/gi, "").replace(",", ".");
  if (!s || !/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Number(s);
}

export const formatPLN = (n: number) =>
  n.toLocaleString("pl-PL", { style: "currency", currency: "PLN", minimumFractionDigits: 2 });

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Myślnik opcjonalny: pole otwiera klawiaturę numeryczną, a na iPhonie nie ma na niej „-”.
export const POSTAL_CODE = /^\d{2}-?\d{3}$/;

/** „30070” → „30-070” w gotowym dokumencie; wszystko inne zostaje jak wpisano. */
export function formatPostalCode(raw: string): string {
  const d = raw.replace(/[\s-]/g, "");
  return /^\d{5}$/.test(d) ? `${d.slice(0, 2)}-${d.slice(2)}` : raw;
}
export const digits = (s: string) => s.replace(/\D/g, "");

// Cyfra kontrolna NIP i REGON: suma ważona mod 11. Łapie literówki i zamienione cyfry, zanim
// błąd wyjdzie dopiero na ocenie formalnej wniosku.
export const NIP_WEIGHTS = [6, 5, 7, 2, 3, 4, 5, 6, 7];
export const REGON9_WEIGHTS = [8, 9, 2, 3, 4, 5, 6, 7];
export const REGON14_WEIGHTS = [2, 4, 8, 5, 0, 9, 7, 3, 6, 1, 2, 4, 8];
/** REGON: reszta 10 oznacza cyfrę 0; NIP z resztą 10 nie istnieje (tenAsZero = false). */
export function checksumOk(d: string, weights: number[], tenAsZero = true): boolean {
  const mod = weights.reduce((sum, w, i) => sum + w * Number(d[i]), 0) % 11;
  if (mod === 10 && !tenAsZero) return false;
  return (mod === 10 ? 0 : mod) === Number(d[weights.length]);
}
