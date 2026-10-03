// Anonimizacja przed wysłaniem tekstu do LLM. Regexy celowo są „zachłanne”:
// lepiej zamaskować za dużo niż wysłać PESEL do modelu.
const RULES: [RegExp, string][] = [
  [/\b\d{11}\b/g, "[PESEL]"],
  [/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[EMAIL]"],
  [/(?:\+?48[\s-]?)?(?:\d{3}[\s-]?\d{3}[\s-]?\d{3}|\(?\d{2}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2})\b/g, "[TELEFON]"],
  [/\b\d{2}-\d{3}\b/g, "[KOD]"],
  [/\b(?:ul\.|ulica|al\.|aleja|os\.|osiedle|pl\.|plac)\s+[\p{Lu}][\p{L}.-]*(?:\s+[\p{Lu}][\p{L}.-]*)*\s+\d+[a-zA-Z]?(?:\/\d+)?/gu, "[ADRES]"],
];

export function anonymize(text: string): { text: string; found: boolean } {
  let out = text;
  for (const [re, label] of RULES) out = out.replace(re, label);
  return { text: out, found: out !== text };
}
