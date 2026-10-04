import type { MapData } from "@/lib/knowledge/map";
import mapJson from "@/public/mapa/malopolska.json";

// Dekoracyjne tło banera „Kondycja Małopolski” na /biblioteka: gminy w pięciu odcieniach (kwintyle udziału osób 65+).
// Osobny plik zamiast SVG w stronie — granice gmin to ~70 KB, a tak przeglądarka pobiera je raz i trzyma w pamięci.
export const dynamic = "force-static";

const SHADES = ["#cde2fb", "#86b6ef", "#3987e5", "#1c5cab", "#0d366b"];
const INDICATOR = "udzial_65plus";

export function GET() {
  const data = mapJson as unknown as MapData;
  const units = data.layers.gminy.units;
  const values = units.map((u) => u.values[INDICATOR]).filter((v): v is number => v != null).sort((a, b) => a - b);
  const cuts = [1, 2, 3, 4].map((k) => values[Math.floor((values.length * k) / 5)]);
  const shade = (v: number | null | undefined) => (v == null ? "#3a3f45" : SHADES[cuts.filter((c) => v >= c).length]);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${data.viewBox}">
<g stroke="#ffffff" stroke-width="0.8" stroke-linejoin="round">${units.map((u) => `<path d="${u.d}" fill="${shade(u.values[INDICATOR])}" fill-rule="evenodd"/>`).join("")}</g>
<g fill="none" stroke="#ffffff" stroke-linejoin="round" stroke-width="2">${data.layers.powiaty.units.map((p) => `<path d="${p.d}"/>`).join("")}</g>
<path d="${data.outline}" fill="none" stroke="#ffffff" stroke-width="3" stroke-linejoin="round"/>
</svg>`;

  return new Response(svg, {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400" },
  });
}
