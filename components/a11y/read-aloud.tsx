"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { SpeakerWaveIcon } from "@heroicons/react/24/outline";

// Chrome urywa długie wypowiedzi po kilkunastu sekundach — czytamy kawałkami po zdaniach.
const CHUNK = 200;

function chunks(text: string): string[] {
  const sentences = text.replace(/\s+/g, " ").match(/[^.!?…]+[.!?…]*\s*/g) ?? [];
  const out: string[] = [];
  for (const s of sentences) {
    const last = out.length - 1;
    if (last >= 0 && out[last].length + s.length <= CHUNK) out[last] += s;
    else out.push(s);
  }
  return out.map((c) => c.trim()).filter(Boolean);
}

const noop = () => () => {};
const isSupported = () => "speechSynthesis" in window;

/** Czyta na głos zaznaczony fragment, a bez zaznaczenia — całą treść strony (<main>). */
export function ReadAloud({ className }: { className: string }) {
  const supported = useSyncExternalStore(noop, isSupported, () => false);
  const pathname = usePathname();
  // Ścieżka, na której zaczęliśmy czytać; po przejściu na inną stronę przycisk sam wraca do „nie czyta”.
  const [readingOn, setReadingOn] = useState<string | null>(null);
  const speaking = readingOn === pathname;
  // Numer bieżącego czytania: zdarzenia z anulowanych wcześniej wypowiedzi nie wyłączają nowego.
  const run = useRef(0);

  // Po przejściu na inną stronę (i przy odmontowaniu) nie czytamy dalej starej treści.
  useEffect(() => () => {
    if (isSupported()) speechSynthesis.cancel();
  }, [pathname]);

  if (!supported) return null;

  function toggle() {
    speechSynthesis.cancel();
    const id = ++run.current;
    const stop = () => { if (run.current === id) setReadingOn(null); };
    if (speaking) return stop();

    const selected = window.getSelection()?.toString().trim();
    const parts = chunks(selected || document.getElementById("tresc")?.innerText || "");
    if (parts.length === 0) return;

    const voice = speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith("pl"));
    parts.forEach((part, i) => {
      const u = new SpeechSynthesisUtterance(part);
      u.lang = "pl-PL";
      if (voice) u.voice = voice;
      u.onerror = stop;
      if (i === parts.length - 1) u.onend = stop;
      speechSynthesis.speak(u);
    });
    setReadingOn(pathname);
  }

  return (
    <button type="button" aria-pressed={speaking} onClick={toggle} className={className}>
      <SpeakerWaveIcon aria-hidden className="size-5" />
      Czytaj na głos
    </button>
  );
}
