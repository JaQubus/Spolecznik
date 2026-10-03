"use client";

import { Captions, Hand, Play } from "lucide-react";
import { useRef, useState } from "react";
import type { Video } from "@/lib/knowledge/types";

/**
 * Film z YouTube ładowany dopiero po kliknięciu (youtube-nocookie.com, bez ciasteczek przed odtworzeniem).
 * Najpierw miniatura z przyciskiem „Odtwórz film: …”; po kliknięciu iframe z atrybutem title dostaje fokus.
 */
export function VideoEmbed({ video, description }: { video: Video; description: React.ReactNode }) {
  const [playing, setPlaying] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const label = video.title.replace(/^Film:\s*/, "");

  return (
    <figure className="max-w-[48rem] space-y-3">
      <div className="relative aspect-video overflow-hidden rounded-[16px] bg-muted">
        {playing ? (
          <iframe
            ref={frame}
            src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}?autoplay=1&rel=0`}
            title={video.title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            onLoad={() => frame.current?.focus()}
            className="size-full"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="group relative flex size-full items-end p-4 text-left"
          >
            {video.thumbnailUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- miniatura z i.ytimg.com
              <img src={video.thumbnailUrl} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
            )}
            <span className="relative inline-flex min-h-12 items-center gap-3 rounded-full bg-background px-5 py-2 text-lg font-bold text-foreground group-hover:underline">
              <Play aria-hidden className="size-6 shrink-0" />
              Odtwórz film: {label}
            </span>
          </button>
        )}
      </div>
      <figcaption className="space-y-2 text-base">
        {(video.captions || video.signLanguage) && (
          <ul className="flex flex-wrap gap-x-6 gap-y-1">
            {video.captions && <li className="flex items-center gap-2"><Captions aria-hidden className="size-5" />Film ma napisy.</li>}
            {video.signLanguage && <li className="flex items-center gap-2"><Hand aria-hidden className="size-5" />Film ma tłumaczenie na polski język migowy (PJM).</li>}
          </ul>
        )}
        <div>{description}</div>
        <p>
          <a href={`https://www.youtube.com/watch?v=${video.youtubeId}`} className="font-bold underline decoration-1 underline-offset-4 hover:decoration-2">
            Otwórz film „{label}” w serwisie YouTube
          </a>
        </p>
      </figcaption>
    </figure>
  );
}
