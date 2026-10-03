"use client";

import { ArrowTopRightOnSquareIcon, PlayIcon } from "@heroicons/react/24/outline";
import { useEffect, useRef, useState } from "react";
import { ICON_LINK as linkClass } from "../shared";

type Embed = { provider: "YouTube" | "Vimeo"; src: string; thumbnail: string | null };

/** Adres filmu → adres do osadzenia. Obsługujemy YouTube i Vimeo; inne serwisy dostają zwykły link. */
function toEmbed(url: string): Embed | null {
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  const host = u.hostname.replace(/^www\.|^m\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = u.pathname.slice(1);
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    id = u.searchParams.get("v") ?? u.pathname.match(/^\/(?:embed|shorts|live)\/([^/?]+)/)?.[1] ?? null;
  }
  if (id && /^[\w-]{6,20}$/.test(id)) {
    return {
      provider: "YouTube",
      // Tryb bez ciasteczek; autoplay=1 dopiero po kliknięciu „Odtwórz”, żeby nie trzeba było klikać drugi raz.
      src: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&cc_load_policy=1&hl=pl`,
      thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    };
  }
  const vimeo = host === "vimeo.com" || host === "player.vimeo.com" ? u.pathname.match(/(\d{6,})/)?.[1] : null;
  if (vimeo) return { provider: "Vimeo", src: `https://player.vimeo.com/video/${vimeo}?autoplay=1&dnt=1`, thumbnail: null };
  return null;
}

/**
 * Lekkie osadzenie filmu: do kliknięcia nie ładujemy odtwarzacza (ani ciasteczek serwisu)
 * i nic nie gra samo. Po kliknięciu fokus przechodzi do odtwarzacza.
 */
export function LiteVideo({ url, title }: { url: string; title: string }) {
  const embed = toEmbed(url);
  const [playing, setPlaying] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => { if (playing) frame.current?.focus(); }, [playing]);

  if (!embed) {
    return (
      <a href={url} className={linkClass}>
        <ArrowTopRightOnSquareIcon aria-hidden className="size-5" /> Obejrzyj film: {title}
      </a>
    );
  }

  return (
    <div className="max-w-3xl space-y-2">
      <div className="relative aspect-video overflow-hidden rounded-[16px] bg-foreground">
        {playing ? (
          <iframe
            ref={frame}
            src={embed.src}
            title={`Film: ${title}`}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            className="absolute inset-0 size-full"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="group absolute inset-0 flex size-full items-end justify-start rounded-[16px] p-4 text-left"
          >
            {embed.thumbnail && (
              // eslint-disable-next-line @next/next/no-img-element -- miniatura z serwera serwisu wideo
              <img src={embed.thumbnail} alt="" className="absolute inset-0 size-full object-cover opacity-80" />
            )}
            <span className="relative inline-flex min-h-14 items-center gap-3 rounded-full bg-background px-6 text-lg font-bold text-foreground group-hover:bg-secondary">
              <PlayIcon aria-hidden className="size-6 fill-current" />
              Odtwórz film<span className="sr-only">: {title}</span>
            </span>
          </button>
        )}
      </div>
      <p className="text-base text-muted-foreground">
        Film z serwisu {embed.provider}. Włącza się dopiero po kliknięciu.{" "}
        <a href={url} className="underline decoration-1 underline-offset-4 hover:decoration-2">Otwórz w serwisie {embed.provider}</a>
      </p>
    </div>
  );
}
