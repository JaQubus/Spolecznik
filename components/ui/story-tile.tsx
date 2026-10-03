import Link from "next/link";
import { cn } from "cn";

/** Siatka kafli: 1 kolumna, 2 od 560px, 3 od lg (StoryTile.md). */
export function StoryTiles({ className, ...props }: React.ComponentProps<"ul">) {
  return <ul className={cn("grid grid-cols-1 gap-x-6 gap-y-8 min-[560px]:grid-cols-2 lg:grid-cols-3", className)} {...props} />;
}

/**
 * Kafel biblioteki: zaokrąglone zdjęcie 4:3 i zwykły tekst pod nim, bez ramki i cienia.
 * Cały kafel klika się przez rozciągnięty link w tytule — jeden link, jedna nazwa dla czytnika.
 */
export function StoryTile({
  href,
  title,
  image,
  meta,
  note,
  badge,
  placeholder,
  level = 3,
  wide = false,
}: {
  href: string;
  title: string;
  /** alt="" gdy zdjęcie nie niesie informacji. Bez zdjęcia: puste szare pole, nigdy stockowe zdjęcia ludzi. */
  image?: { src: string; alt: string };
  meta?: React.ReactNode;
  note?: React.ReactNode;
  /** Najwyżej jedna etykieta na zdjęciu, np. „Nowość”. */
  badge?: string;
  /** Treść szarego pola, gdy nie ma zdjęcia — np. ikona kategorii (dekoracyjna, aria-hidden). */
  placeholder?: React.ReactNode;
  /** Poziom nagłówka tytułu, gdy kafle stoją pod nagłówkiem h3 (domyślnie h3). */
  level?: 3 | 4;
  /** Niższe pole 2:1 — dla kafli z samą ikoną (bez zdjęcia), żeby siatka nie była zbyt wysoka. */
  wide?: boolean;
}) {
  const Heading = level === 4 ? "h4" : "h3";
  return (
    <li className="relative flex flex-col gap-1 rounded-[16px] focus-within:outline-3 focus-within:outline-offset-[6px] focus-within:outline-ring">
      <div className={cn("relative mb-2 overflow-hidden rounded-[16px] bg-muted", wide ? "aspect-[2/1]" : "aspect-[4/3]")}>
        {/* eslint-disable-next-line @next/next/no-img-element -- źródła zdjęć są dowolne (Supabase Storage, zewnętrzne) */}
        {image && <img src={image.src} alt={image.alt} loading="lazy" className="size-full object-cover" />}
        {!image && placeholder && <div className="flex size-full items-center justify-center text-muted-foreground">{placeholder}</div>}
        {badge && <span className="absolute top-3 left-3 rounded-full bg-background px-3 py-0.5 text-base">{badge}</span>}
      </div>
      <Heading className="text-lg font-bold">
        <Link href={href} className="no-underline outline-none after:absolute after:inset-0 after:rounded-[16px] hover:underline">
          {title}
        </Link>
      </Heading>
      {meta && <p className="text-base text-muted-foreground">{meta}</p>}
      {note && <p className="text-base">{note}</p>}
    </li>
  );
}
