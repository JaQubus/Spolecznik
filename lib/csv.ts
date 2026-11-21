// CSV dla polskiego Excela: średnik jako separator i BOM. Czysty moduł (testy jednostkowe czytają go wprost).

export type CsvValue = string | number | boolean | null | undefined;

/**
 * Komórka tekstowa zaczynająca się od = + - @ (albo tabulatora) bywa wzięta przez Excel za formułę — tytuły
 * i opisy zgłasza każdy, więc takie komórki zaczynamy apostrofem. Liczby zostają liczbami.
 */
export function csvCell(v: CsvValue): string {
  if (v == null) return "";
  if (typeof v === "number") return String(v);
  const raw = typeof v === "boolean" ? (v ? "tak" : "nie") : v;
  const s = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const toCsv = (rows: CsvValue[][]): string => "﻿" + rows.map((r) => r.map(csvCell).join(";")).join("\r\n") + "\r\n";
