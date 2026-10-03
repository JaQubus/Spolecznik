"use client";

import { MicrophoneIcon, StopIcon } from "@heroicons/react/24/outline";
import { useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";

// Web Speech API nie ma typów w lib.dom — minimalna deklaracja tego, czego używamy.
type RecognitionEvent = { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> };
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: RecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};
type RecognitionCtor = new () => Recognition;

function getCtor(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}
const noopSubscribe = () => () => {};

/**
 * „Opowiedz problem” — duży przycisk mikrofonu (Chrome/Edge). Rozpoznany tekst trafia do pola,
 * gdzie można go poprawić przed wysłaniem. W innych przeglądarkach przycisk się nie pokazuje.
 */
export function VoiceInput({ onText, label = "Opowiedz problem" }: { onText: (chunk: string) => void; label?: string }) {
  const supported = useSyncExternalStore(noopSubscribe, () => getCtor() !== null, () => false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognition = useRef<Recognition | null>(null);

  if (!supported) return null;

  function start() {
    const Ctor = getCtor();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = "pl-PL";
    r.interimResults = true;
    r.continuous = true;
    r.onresult = (e) => {
      let finalText = "";
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText += res[0].transcript;
        else interimText += res[0].transcript;
      }
      if (finalText) onText(finalText.trim());
      setInterim(interimText);
    };
    r.onerror = (e) => {
      setError(e.error === "not-allowed"
        ? "Brak zgody na mikrofon. Możesz wpisać opis w polu tekstowym."
        : "Nie udało się rozpoznać mowy. Spróbuj jeszcze raz albo wpisz opis.");
    };
    r.onend = () => { setListening(false); setInterim(""); };
    setError(null);
    recognition.current = r;
    r.start();
    setListening(true);
  }

  return (
    <div className="space-y-2">
      {/* Drugorzędny (obrys), bo obok jest pole i zielony przycisk wysyłania. Nagrywanie = wypełnienie + puls, nie czerwień. */}
      <Button
        type="button"
        variant="outline"
        aria-pressed={listening}
        onClick={() => (listening ? recognition.current?.stop() : start())}
        className="aria-pressed:bg-foreground aria-pressed:text-background aria-pressed:hover:bg-foreground motion-safe:aria-pressed:animate-[mic-pulse_1.4s_ease-in-out_infinite]"
      >
        {listening
          ? <><StopIcon aria-hidden /> Słucham… kliknij, by zakończyć</>
          : <><MicrophoneIcon aria-hidden className="size-6" /> {label}</>}
      </Button>
      <p aria-live="polite" className="min-h-7 text-base text-muted-foreground">
        {listening && (interim || "Słucham… Mów spokojnie, tekst pojawi się w polu poniżej.")}
      </p>
      <FieldError role="alert">{error}</FieldError>
    </div>
  );
}
