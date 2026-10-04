// Anonimizacja przed wysłaniem tekstu do LLM. Regexy celowo są „zachłanne”:
// lepiej zamaskować za dużo niż wysłać PESEL albo hasło do modelu. Kolejność ma znaczenie —
// sekrety idą pierwsze (inaczej reguły liczbowe pocięłyby token na kawałki, a reszta by wyciekła),
// dłuższe numery (konto, karta, PESEL, NIP) idą przed telefonem, żeby nie zostawał ich fragment.
// (?<!\d) i (?!\d) zamiast \b: numer nie może zaczynać się ani kończyć w środku dłuższego ciągu cyfr.

// Słowa, po których zwykle pada sekret: „hasło: …”, „mój PIN to …”, „token=…”, „kod BLIK 123456”.
// Mocne prawie zawsze poprzedzają sekret; słabe bywają zwykłymi słowami („klucz do sukcesu to współpraca”).
const STRONG_KEYWORD =
  "has[łl][oaeu]\\p{L}*|password|passwd|pwd|pin|cvv2?|cvc|api[\\s_-]?key|secret|sekret" +
  "|kod(?:\\s+(?:pin|dostępu|weryfikacyjny|sms|blik|autoryzacyjny|jednorazowy|zabezpieczający))";
const WEAK_KEYWORD = "pass|token|klucz(?:\\s+api)?|login|username";
// Wartość w cudzysłowie (może mieć spacje) albo ciąg bez spacji — bez kropki/przecinka zamykającego zdanie.
const SECRET_VALUE = `(?:"[^"\\n]*"|„[^”\\n]*”|'[^'\\n]*'|[^\\s"'”]*[^\\s"'”.,;:)])`;
// Do dwóch dopowiedzeń: „hasło do banku”, „PIN do karty z PKO”.
const ASIDE = "(?:\\s+(?:do|od|dla|z|na)\\s+[\\p{L}\\d.-]+){0,2}";
// Po słowie: „:” albo „=”; sama spacja tylko gdy wartość ma cyfrę („PIN 4821”, a nie „klucz sukcesu”).
const COLON_OR_DIGIT = "\\s*[:=]\\s*|\\s+(?=\\S*\\d)";
// Mocne słowa dopuszczają też „to”/„jest”/„is”: „moje hasło to zima”.
const KEYWORD_SECRET = new RegExp(
  `(\\b(?:${STRONG_KEYWORD})${ASIDE}(?:${COLON_OR_DIGIT}|\\s+(?:to|jest|brzmi|is)\\s*[:=]?\\s*)` +
    `|\\b(?:${WEAK_KEYWORD})${ASIDE}(?:${COLON_OR_DIGIT}))${SECRET_VALUE}`,
  "giu",
);

// Tokeny znanych dostawców: OpenAI/Anthropic/Stripe (sk-, pk_, rk_), Groq, GitHub, GitLab, Slack, AWS, Google, npm,
// Hugging Face i JWT (m.in. klucze Supabase).
const KNOWN_TOKEN =
  /\b(?:(?:sk|pk|rk)[-_][\w-]{16,}|gsk_\w{20,}|gh[pousr]_\w{20,}|github_pat_\w{20,}|glpat-[\w-]{20,}|xox[abprs]-[\w-]{10,}|(?:AKIA|ASIA)[0-9A-Z]{16}|AIza[\w-]{35}|npm_\w{30,}|hf_\w{30,}|eyJ[\w-]+\.eyJ[\w-]+\.[\w-]*)/g;

// Długi losowy ciąg (base64, hex) z literami i cyframi. Nie w środku adresu URL ani nazwy domeny
// (lookbehind wyklucza „.”, „/” i „:”), a „slug-z-myslnikami-2024” i UUID zostają.
const RANDOM_TOKEN = /(?<![\w+/=.:-])(?=[\w+/=-]*\d)(?=[\w+/=-]*[A-Za-z])[\w+/=-]{32,}(?![\w+/=-])/g;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)+$/;

const RULES: [RegExp, string | ((match: string) => string)][] = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g, "[KLUCZ]"],
  // Login i hasło w adresie: postgres://user:haslo@host, https://user:token@github.com.
  [/\b([a-z][a-z0-9+.-]*:\/\/)[^\s:@/]*:[^\s@/]+@/gi, "$1[SEKRET]@"],
  [/\b(Bearer|Basic|Token)\s+[\w\-.~+/]{8,}=*/g, "$1 [KLUCZ]"],
  [KNOWN_TOKEN, "[KLUCZ]"],
  [KEYWORD_SECRET, "$1[SEKRET]"],
  [RANDOM_TOKEN, (m) => (SLUG.test(m) ? m : "[KLUCZ]")],
  [/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "[EMAIL]"],
  [/(?<!\d)(?:PL\s?)?\d{2}(?:[\s-]?\d{4}){6}(?!\d)/g, "[KONTO]"],
  // Karta płatnicza: 16–19 cyfr w grupach po 4 albo Amex 4-6-5.
  [/(?<!\d)(?:\d{4}(?:[\s-]?\d{4}){3}(?:[\s-]?\d{1,3})?|\d{4}[\s-]?\d{6}[\s-]?\d{5})(?!\d)/g, "[KARTA]"],
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
  for (const [re, label] of RULES) out = typeof label === "string" ? out.replace(re, label) : out.replace(re, label);
  return { text: out, found: out !== text };
}
