"use client";

import { useEffect, useRef } from "react";

/**
 * Nagłówek, który po pojawieniu się przejmuje fokus — po kliknięciu gminy czytnik od razu czyta jej kartę —
 * i płynnie przewija stronę tak, żeby karta (najbliższa sekcja) była widoczna w całości.
 */
export function FocusHeading({ id, className, children, as: Tag = "h2" }: {
  id: string; className?: string; children: React.ReactNode; as?: "h2" | "h3";
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // „nearest”: niska karta staje dołem na dole ekranu (mapa zostaje nad nią), wysoka — górą na górze.
    (el.closest("section") ?? el).scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
  }, []);
  return (
    <Tag ref={ref} id={id} tabIndex={-1} className={className}>
      {children}
    </Tag>
  );
}
