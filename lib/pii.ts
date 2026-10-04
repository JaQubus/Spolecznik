// Anonimizacja przed wysłaniem tekstu do LLM. Regexy celowo są „zachłanne”:
// lepiej zamaskować za dużo niż wysłać PESEL do modelu. Kolejność ma znaczenie —
// dłuższe numery (konto, PESEL, NIP) idą przed telefonem, żeby nie zostawał ich fragment.
// (?<!\d) i (?!\d) zamiast \b: numer nie może zaczynać się ani kończyć w środku dłuższego ciągu cyfr.
const RULES: [RegExp, string][] = [
  [/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "[EMAIL]"],
  [/(?<!\d)(?:PL\s?)?\d{2}(?:[\s-]?\d{4}){6}(?!\d)/g, "[KONTO]"],
  [/(?<!\d)\d{12,}(?!\d)/g, "[NUMER]"],
  [/(?<!\d)\d{11}(?!\d)/g, "[PESEL]"],
  [/(?<!\d)(?:\d{3}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}|\d{3}[\s-]?\d{2}[\s-]?\d{2}[\s-]?\d{3})(?!\d)/g, "[NIP]"],
  [/(?<![\d+])(?:\+?48[\s-]?)?(?:\d{3}[\s-]?\d{3}[\s-]?\d{3}|\(?\d{2}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2})(?!\d)/g, "[TELEFON]"],
  [/\b[A-Z]{3}\s?\d{6}(?!\d)/g, "[DOWÓD]"],
  [/(?<!\d)\d{2}-\d{3}(?!\d)/g, "[KOD]"],
  // Nazwa ulicy może zaczynać się od liczebnika („ul. 3 Maja 10”, „al. 29 Listopada 46a”).
  [/\b(?:ul\.|ulica|al\.|aleja|os\.|osiedle|pl\.|plac)\s+(?:\d{1,2}\s+)?[\p{Lu}][\p{L}.-]*(?:\s+[\p{Lu}][\p{L}.-]*)*\s+\d+[a-zA-Z]?(?:\/\d+[a-zA-Z]?)?/gu, "[ADRES]"],
];

export function anonymize(text: string): { text: string; found: boolean } {
  let out = text;
  for (const [re, label] of RULES) out = out.replace(re, label);
  return { text: out, found: out !== text };
}
