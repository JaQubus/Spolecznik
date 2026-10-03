"use client";

import { CheckIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { classify, fmt, NO_DATA_FILL, rank, withUnit, type LayerKey, type MapData, type MapUnit } from "@/lib/knowledge/map";
import { AREA_LABELS } from "@/lib/taxonomy";

const LAYERS: LayerKey[] = ["gminy", "powiaty"];
const link = "font-bold underline decoration-1 underline-offset-4 hover:decoration-2";

/** Pełna nazwa do list i podpowiedzi — w Małopolsce są pary gmin o tej samej nazwie (np. Bochnia miejska i wiejska). */
const unitLabel = (u: MapUnit, layer: LayerKey) =>
  layer === "gminy" ? `${u.name} (gmina ${u.kind ?? ""}, ${u.parent?.replace(/ \(miasto na prawach powiatu\)$/, "")})` : u.name;

/**
 * Mapa Małopolski z prawdziwymi granicami gmin i powiatów (PRG, GUGiK) i danymi BDL / IOSS.
 * Mysz i dotyk: najechanie pokazuje wartość, kliknięcie wybiera. Klawiatura i czytnik ekranu: lista
 * „Wybierz gminę”, panel szczegółów (aria-live) i tabela z tymi samymi danymi — mapa nie jest jedyną drogą.
 */
export function RegionMap({ initialLayer, initialIndicator, initialUnit }: {
  initialLayer: LayerKey; initialIndicator?: string; initialUnit?: string;
}) {
  const [data, setData] = useState<MapData | null>(null);
  const [failed, setFailed] = useState(false);
  const [layerKey, setLayerKey] = useState<LayerKey>(initialLayer);
  const [indicatorKey, setIndicatorKey] = useState(initialIndicator);
  const [selected, setSelected] = useState<string | undefined>(initialUnit);
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLElement>(null);

  // Plik z granicami (~45 kB po kompresji) pobieramy dopiero, gdy mapa zbliża się do ekranu.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      fetch("/mapa/malopolska.json")
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then(setData)
        .catch(() => setFailed(true));
    }, { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const layer = data?.layers[layerKey];
  const indicator = layer?.indicators.find((i) => i.key === indicatorKey) ?? layer?.indicators[0];
  const values = useMemo(
    () => (layer && indicator ? layer.units.map((u) => u.values[indicator.key]).filter((v): v is number => v != null) : []),
    [layer, indicator],
  );
  const classes = useMemo(() => (indicator && values.length ? classify(values, indicator) : []), [values, indicator]);
  const fillOf = (u: MapUnit) => {
    const v = indicator ? u.values[indicator.key] : null;
    return v == null ? NO_DATA_FILL : classes.find((c) => c.test(v))?.fill ?? NO_DATA_FILL;
  };
  const unit = layer?.units.find((u) => u.id === selected);
  const hovered = layer?.units.find((u) => u.id === hover?.id);
  const hasMissing = !!indicator && !!layer?.units.some((u) => u.values[indicator.key] == null);

  // Stan w adresie: link z wybranym widokiem można wysłać dalej. replaceState — bez nowego wpisu w historii.
  useEffect(() => {
    if (!data) return;
    const url = new URL(window.location.href);
    url.searchParams.set("mapa", layerKey);
    if (indicator) url.searchParams.set("wskaznik", indicator.key);
    if (selected) url.searchParams.set("jednostka", selected);
    else url.searchParams.delete("jednostka");
    window.history.replaceState(window.history.state, "", url);
  }, [data, layerKey, indicator, selected]);

  function switchLayer(next: LayerKey) {
    setLayerKey(next);
    setIndicatorKey(undefined);
    // Wybrana gmina → jej powiat (pierwsze 4 cyfry TERYT); z powiatu do gmin wybór znika.
    setSelected(next === "powiaty" && selected ? selected.slice(0, 4) : undefined);
  }

  function track(e: React.PointerEvent, id: string) {
    const r = box.current?.getBoundingClientRect();
    if (r) setHover({ id, x: e.clientX - r.left, y: e.clientY - r.top });
  }

  const place = unit && indicator && layer ? rank(layer.units, indicator.key, unit.id) : null;
  const value = unit && indicator ? unit.values[indicator.key] : null;

  return (
    <section ref={root} aria-labelledby="mapa-naglowek" className="space-y-6">
      <div className="space-y-2">
        <h2 id="mapa-naglowek" className="text-3xl font-bold">Małopolska na mapie</h2>
        <p className="max-w-[44rem] text-lg">
          Zobacz, jak żyje się w Twojej gminie i powiecie. Najedź na mapę albo wybierz miejsce z listy.
        </p>
      </div>

      {!data && (
        <p role="status" className="flex aspect-[1000/883] max-w-3xl items-center justify-center rounded-[16px] bg-muted text-lg">
          {failed ? "Nie udało się wczytać mapy. Odśwież stronę za chwilę." : "Ładuję mapę…"}
        </p>
      )}

      {data && layer && indicator && (
        <>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end">
            <fieldset className="space-y-2">
              <legend className="text-lg font-bold">Pokaż</legend>
              <div className="flex flex-wrap gap-2">
                {LAYERS.map((k) => (
                  <label
                    key={k}
                    className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-full border border-border-strong bg-background px-4 text-lg hover:border-foreground has-checked:border-foreground has-checked:bg-foreground has-checked:font-bold has-checked:text-background has-focus-visible:outline-3 has-focus-visible:outline-offset-3 has-focus-visible:outline-ring"
                  >
                    <input type="radio" name="mapa-warstwa" value={k} checked={layerKey === k} onChange={() => switchLayer(k)} className="sr-only" />
                    {layerKey === k && <CheckIcon aria-hidden className="size-5" />}
                    {data.layers[k].label} ({data.layers[k].units.length})
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="mapa-wskaznik">Co pokazać</Label>
              <NativeSelect id="mapa-wskaznik" value={indicator.key} onChange={(e) => setIndicatorKey(e.target.value)}>
                {layer.indicators.map((i) => <option key={i.key} value={i.key}>{i.label}</option>)}
              </NativeSelect>
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="mapa-jednostka">{layerKey === "gminy" ? "Wybierz gminę" : "Wybierz powiat"}</Label>
              <NativeSelect id="mapa-jednostka" value={selected ?? ""} onChange={(e) => setSelected(e.target.value || undefined)}>
                <option value="">{layerKey === "gminy" ? "Wszystkie gminy" : "Wszystkie powiaty"}</option>
                {layer.units.map((u) => <option key={u.id} value={u.id}>{unitLabel(u, layerKey)}</option>)}
              </NativeSelect>
            </div>
          </div>

          <p className="text-lg"><strong>{indicator.question}</strong></p>

          <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(16rem,1fr)]">
            <div ref={box} className="relative">
              <svg
                viewBox={data.viewBox}
                role="img"
                aria-labelledby="mapa-tytul"
                className="h-auto w-full"
                onPointerLeave={() => setHover(null)}
              >
                <title id="mapa-tytul">{`Mapa Małopolski: ${indicator.label.toLowerCase()} — ${layer.label.toLowerCase()}. Wartości są w panelu obok i w tabeli pod mapą.`}</title>
                <defs>
                  <pattern id="mapa-brak-danych" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <rect width="8" height="8" fill="var(--surface)" />
                    <line x1="0" y1="0" x2="0" y2="8" stroke="var(--ink-muted)" strokeWidth="2" />
                  </pattern>
                </defs>
                <g>
                  {layer.units.map((u) => (
                    <path
                      key={u.id}
                      d={u.d}
                      fill={fillOf(u)}
                      stroke="var(--surface)"
                      strokeWidth={0.8}
                      vectorEffect="non-scaling-stroke"
                      className="cursor-pointer"
                      onPointerMove={(e) => track(e, u.id)}
                      onClick={() => setSelected(u.id === selected ? undefined : u.id)}
                    />
                  ))}
                </g>
                {layerKey === "gminy" && (
                  <g fill="none" stroke="var(--ink-muted)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" pointerEvents="none">
                    {data.layers.powiaty.units.map((p) => <path key={p.id} d={p.d} vectorEffect="non-scaling-stroke" />)}
                  </g>
                )}
                <path d={data.outline} fill="none" stroke="var(--ink)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" pointerEvents="none" />
                {hovered && hovered.id !== selected && (
                  <path d={hovered.d} fill="none" stroke="var(--ink)" strokeWidth={2} vectorEffect="non-scaling-stroke" pointerEvents="none" />
                )}
                {unit && (
                  <path d={unit.d} fill="none" stroke="var(--focus)" strokeWidth={4} vectorEffect="non-scaling-stroke" pointerEvents="none" />
                )}
                <g pointerEvents="none" className="max-sm:hidden">
                  {data.labels.map((l) => (
                    <text
                      key={l.name}
                      x={l.x}
                      y={l.y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={20}
                      fontWeight={700}
                      fill="var(--ink)"
                      stroke="var(--surface)"
                      strokeWidth={5}
                      paintOrder="stroke"
                      strokeLinejoin="round"
                    >
                      {l.name}
                    </text>
                  ))}
                </g>
              </svg>
              {hover && hovered && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute z-10 -mt-3 max-w-64 -translate-x-1/2 -translate-y-full rounded-lg bg-popover px-3 py-2 text-base text-popover-foreground shadow-[var(--shadow-overlay)]"
                  style={{ left: hover.x, top: hover.y }}
                >
                  <p className="font-bold">{hovered.name}</p>
                  <p>{hovered.values[indicator.key] == null ? "brak danych" : withUnit(hovered.values[indicator.key] as number, indicator)}</p>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div aria-live="polite" className="rounded-[16px] bg-secondary p-5">
                {unit ? (
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold">{unit.name}</h3>
                    {unit.parent && <p className="text-base text-muted-foreground">Gmina {unit.kind}, {unit.parent}</p>}
                    <p className="text-3xl font-bold">{value == null ? "brak danych" : withUnit(value, indicator)}</p>
                    <p>{indicator.label}</p>
                    {place && (
                      <p className="text-base">
                        {place.place}. miejsce na {place.of} {layerKey === "gminy" ? "gmin" : "powiatów"} (1 = najwyższa wartość).
                      </p>
                    )}
                    {indicator.area && (
                      <p>
                        <Link href={`/biblioteka/obszar/${indicator.area.replace(/_/g, "-")}`} className={link}>
                          Zobacz rozwiązania: {AREA_LABELS[indicator.area]}
                        </Link>
                      </p>
                    )}
                    <button type="button" onClick={() => setSelected(undefined)} className="inline-flex min-h-12 items-center underline decoration-1 underline-offset-4">
                      Wyczyść wybór
                    </button>
                  </div>
                ) : (
                  <p>Kliknij {layerKey === "gminy" ? "gminę" : "powiat"} na mapie albo wybierz z listy powyżej, żeby zobaczyć szczegóły.</p>
                )}
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-bold">Legenda</h3>
                <ul className="space-y-1 text-base">
                  {classes.map((c) => (
                    <li key={c.label} className="flex items-center gap-3">
                      <span aria-hidden className="size-6 shrink-0 rounded border border-border-strong" style={{ background: c.fill }} />
                      {c.label}
                    </li>
                  ))}
                  {hasMissing && (
                    <li className="flex items-center gap-3">
                      <svg aria-hidden viewBox="0 0 24 24" className="size-6 shrink-0 rounded border border-border-strong">
                        <rect width="24" height="24" fill="url(#mapa-brak-danych)" />
                      </svg>
                      brak danych {layerKey === "gminy" && indicator.key === "zmiana_ludnosci_10l" && "(gmina utworzona w 2025 roku)"}
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>

          <p className="text-base text-muted-foreground">
            Granice:{" "}
            <a href={data.geometrySource.url} className="underline decoration-1 underline-offset-4">{data.geometrySource.title}</a>, uproszczone.
            Dane:{" "}
            <a href={indicator.source.url} className="underline decoration-1 underline-offset-4">{indicator.source.title}</a>, {indicator.source.year}.
          </p>

          <details className="group max-w-[48rem]">
            <summary className="inline-flex min-h-12 cursor-pointer items-center text-lg font-bold underline decoration-1 underline-offset-4">
              Pokaż dane w tabeli ({layer.units.length} {layerKey === "gminy" ? "gmin" : "powiatów"})
            </summary>
            <div role="region" aria-labelledby="mapa-tabela" tabIndex={0} className="relative mt-4 max-h-[32rem] overflow-auto rounded-lg border border-border">
              <table className="w-full border-collapse text-base">
                <caption id="mapa-tabela" className="p-3 text-left font-bold">
                  {indicator.label} — {layer.label.toLowerCase()}, od najwyższej wartości
                </caption>
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b border-border-strong">
                    <th scope="col" className="p-3 text-left">{layerKey === "gminy" ? "Gmina" : "Powiat"}</th>
                    {layerKey === "gminy" && <th scope="col" className="p-3 text-left">Powiat</th>}
                    <th scope="col" className="p-3 text-right">{indicator.unit === "%" ? "%" : indicator.unit}</th>
                  </tr>
                </thead>
                <tbody>
                  {[...layer.units]
                    .sort((a, b) => (b.values[indicator.key] ?? -Infinity) - (a.values[indicator.key] ?? -Infinity))
                    .map((u) => (
                      <tr key={u.id} className="border-b border-border">
                        <th scope="row" className="p-3 text-left font-normal">{layerKey === "gminy" ? `${u.name} (${u.kind})` : u.name}</th>
                        {layerKey === "gminy" && <td className="p-3">{u.parent}</td>}
                        <td className="p-3 text-right tabular-nums">
                          {u.values[indicator.key] == null ? "brak danych" : fmt(u.values[indicator.key] as number, indicator)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  );
}
