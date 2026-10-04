import {
  AcademicCapIcon, ArrowRightIcon, BanknotesIcon, BookOpenIcon, BuildingOfficeIcon, CalendarDaysIcon,
  ChatBubbleLeftRightIcon, CheckCircleIcon, ClipboardDocumentCheckIcon, ComputerDesktopIcon, HandRaisedIcon,
  HeartIcon, HomeIcon, LightBulbIcon, MapPinIcon, MegaphoneIcon, PhoneIcon, PlusCircleIcon, PuzzlePieceIcon,
  ShoppingBagIcon, TruckIcon, UserGroupIcon, UserIcon, WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { PrintNote } from "@/components/layout/print-note";
import type { IdeaPoster as Poster, POSTER_ICONS, POSTER_NEEDS, POSTER_SHAPES } from "@/lib/schemas";

type Icon = typeof UserIcon;

const STEP_ICONS: Record<(typeof POSTER_ICONS)[number], Icon> = {
  "user": UserIcon,
  "user-group": UserGroupIcon,
  "home": HomeIcon,
  "map-pin": MapPinIcon,
  "phone": PhoneIcon,
  "chat-bubble-left-right": ChatBubbleLeftRightIcon,
  "calendar-days": CalendarDaysIcon,
  "truck": TruckIcon,
  "heart": HeartIcon,
  "academic-cap": AcademicCapIcon,
  "wrench-screwdriver": WrenchScrewdriverIcon,
  "light-bulb": LightBulbIcon,
  "hand-raised": HandRaisedIcon,
  "building-office": BuildingOfficeIcon,
  "computer-desktop": ComputerDesktopIcon,
  "shopping-bag": ShoppingBagIcon,
  "book-open": BookOpenIcon,
  "megaphone": MegaphoneIcon,
  "puzzle-piece": PuzzlePieceIcon,
  "clipboard-document-check": ClipboardDocumentCheckIcon,
};

const NEEDS: Record<(typeof POSTER_NEEDS)[number], { label: string; icon: Icon }> = {
  ludzie: { label: "Ludzie", icon: UserGroupIcon },
  miejsce: { label: "Miejsce", icon: MapPinIcon },
  sprzet: { label: "Sprzęt", icon: WrenchScrewdriverIcon },
  pieniadze: { label: "Pieniądze", icon: BanknotesIcon },
  partnerzy: { label: "Partnerzy", icon: HandRaisedIcon },
  inne: { label: "Inne", icon: PlusCircleIcon },
};

const STEP_COLUMNS = { 3: "sm:grid-cols-3", 4: "sm:grid-cols-4" } as Record<number, string>;

/**
 * Plakat pomysłu: treść z /api/poster narysowana w HTML i SVG zamiast obrazka z modelu. Cała treść jest tekstem,
 * więc czytnik ekranu czyta ją po kolei, a ikony stoją zawsze obok słów. Drukuje się sam (data-print-root, #48).
 */
export function IdeaPoster({ poster }: { poster: Poster }) {
  return (
    <article
      data-print-root
      aria-labelledby="plakat-haslo"
      className="poster max-w-[52rem] space-y-8 rounded-[16px] border border-border-strong bg-background p-5 sm:p-8 print:max-w-none print:space-y-4 print:rounded-none print:border-0 print:p-0"
    >
      <header className="space-y-2">
        <PrintNote dated>Plakat pomysłu · Społecznik</PrintNote>
        <h3 id="plakat-haslo" className="text-3xl font-bold text-balance">{poster.headline}</h3>
        <p className="max-w-[60ch] text-xl">{poster.oneLiner}</p>
      </header>

      <section aria-labelledby="plakat-kroki" className="space-y-4 print:space-y-2">
        <h4 id="plakat-kroki" className="text-xl font-bold">Jak to działa</h4>
        <ol className={`grid gap-6 print:gap-x-6 print:gap-y-2 ${STEP_COLUMNS[poster.journey.length] ?? ""}`}>
          {poster.journey.map((step, i) => {
            const StepIcon = STEP_ICONS[step.icon];
            return (
              <li key={i} className="relative flex gap-4 sm:flex-col sm:gap-3">
                <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-secondary print:size-10 print:border print:border-border-strong">
                  <StepIcon aria-hidden className="size-7 print:size-5" />
                </span>
                <div>
                  <p className="font-bold">
                    <span className="text-muted-foreground">{i + 1}. </span>{step.who}
                  </p>
                  <p>{step.action}</p>
                </div>
                {i < poster.journey.length - 1 && (
                  <ArrowRightIcon aria-hidden className="absolute top-4 -right-6 hidden size-6 text-muted-foreground sm:block print:top-2" />
                )}
              </li>
            );
          })}
        </ol>
      </section>

      {poster.object && <ObjectSketch object={poster.object} />}

      <div className="grid gap-8 sm:grid-cols-2 print:gap-5">
        <section aria-labelledby="plakat-korzysci" className="space-y-3 print:space-y-1">
          <h4 id="plakat-korzysci" className="text-xl font-bold">Co to daje</h4>
          <ul className="space-y-2 print:space-y-1">
            {poster.benefits.map((b, i) => (
              <li key={i} className="flex items-start gap-3">
                <CheckCircleIcon aria-hidden className="mt-0.5 size-6 shrink-0 text-primary" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </section>
        {poster.needs.length > 0 && (
          <section aria-labelledby="plakat-potrzeby" className="space-y-3 print:space-y-1">
            <h4 id="plakat-potrzeby" className="text-xl font-bold">Czego potrzeba</h4>
            <ul className="space-y-2 print:space-y-1">
              {poster.needs.map((n, i) => {
                const { label, icon: NeedIcon } = NEEDS[n.kind];
                return (
                  <li key={i} className="flex items-start gap-3">
                    <NeedIcon aria-hidden className="mt-0.5 size-6 shrink-0" />
                    <span><strong>{label}:</strong> {n.text}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>

      <PrintNote>Plakat przygotowany w Społeczniku z fiszki pomysłu. To wizualizacja do rozmowy, a nie gotowy projekt.</PrintNote>
    </article>
  );
}

type Sketch = NonNullable<Poster["object"]>;

// Kształty w układzie 320×260 ze środkiem w (160, 130): połowa szerokości i wysokości, dla koła promień.
const SHAPES: Record<(typeof POSTER_SHAPES)[number], { hw: number; hh: number; round?: boolean }> = {
  prostokat: { hw: 75, hh: 60 },
  pionowy: { hw: 42, hh: 85 },
  plaski: { hw: 110, hh: 28 },
  okragly: { hw: 72, hh: 72, round: true },
};

/** Punkt na krawędzi kształtu w kierunku kąta (radiany) i dalej o `out` jednostek — tam stoi numer części. */
function edgePoint(shape: { hw: number; hh: number; round?: boolean }, angle: number, out: number) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const t = shape.round ? shape.hw : Math.min(shape.hw / Math.abs(dx || 1e-9), shape.hh / Math.abs(dy || 1e-9));
  return { x: 160 + (t + out) * dx, y: 130 + (t + out) * dy };
}

/** Prosty schemat przedmiotu: ogólny kształt z ponumerowanymi częściami; legenda pod spodem mówi to samo słowami. */
function ObjectSketch({ object }: { object: Sketch }) {
  const shape = SHAPES[object.shape];
  // Numery wokół kształtu od godziny 11, co równy kąt — nie nachodzą na siebie przy 1–6 częściach.
  const marks = object.parts.map((_, i) => {
    const angle = -Math.PI * 0.65 + (2 * Math.PI * i) / object.parts.length;
    return { from: edgePoint(shape, angle, 0), to: edgePoint(shape, angle, 26) };
  });
  return (
    <section aria-labelledby="plakat-przedmiot" className="space-y-3 print:space-y-1">
      <h4 id="plakat-przedmiot" className="text-xl font-bold">Jak to wygląda</h4>
      <figure className="grid items-start gap-6 sm:grid-cols-[minmax(0,18rem)_1fr] print:grid-cols-[10rem_1fr] print:gap-4">
        <svg
          viewBox="0 0 320 260"
          role="img"
          aria-label={`Schemat: ${object.name}, ${object.parts.length} ponumerowanych części opisanych obok`}
          className="w-full max-w-[18rem] text-foreground print:max-w-[10rem]"
        >
          {shape.round ? (
            <circle cx={160} cy={130} r={shape.hw} className="fill-secondary stroke-current" strokeWidth={2.5} />
          ) : (
            <rect
              x={160 - shape.hw}
              y={130 - shape.hh}
              width={shape.hw * 2}
              height={shape.hh * 2}
              rx={12}
              className="fill-secondary stroke-current"
              strokeWidth={2.5}
            />
          )}
          {marks.map((m, i) => (
            <g key={i}>
              <circle cx={m.from.x} cy={m.from.y} r={4} className="fill-current" />
              <line x1={m.from.x} y1={m.from.y} x2={m.to.x} y2={m.to.y} className="stroke-current" strokeWidth={1.5} />
              <circle cx={m.to.x} cy={m.to.y} r={12} className="fill-background stroke-current" strokeWidth={1.5} />
              <text x={m.to.x} y={m.to.y} textAnchor="middle" dominantBaseline="central" fontSize={14} fontWeight={700} className="fill-current">
                {i + 1}
              </text>
            </g>
          ))}
        </svg>
        <figcaption className="space-y-2">
          <p><strong>Schemat: {object.name}.</strong> {object.description}</p>
          <ol className="list-decimal space-y-1 pl-6 print:space-y-0">
            {object.parts.map((p, i) => (
              <li key={i}><strong>{p.name}</strong>{p.purpose && ` — ${p.purpose}`}</li>
            ))}
          </ol>
        </figcaption>
      </figure>
    </section>
  );
}
