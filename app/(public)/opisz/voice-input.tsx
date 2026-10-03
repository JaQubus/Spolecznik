"use client";

import { MicIcon, SquareIcon } from "lucide-react";
import { useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

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
      <Button
        type="button"
        size="lg"
        variant={listening ? "destructive" : "secondary"}
        onClick={() => (listening ? recognition.current?.stop() : start())}
        className="h-14 gap-3 px-6 text-lg"
      >
        {listening
          ? <><SquareIcon aria-hidden className="size-5" /> Zakończ nagrywanie</>
          : <><MicIcon aria-hidden className="size-6" /> {label}</>}
      </Button>
      <p aria-live="polite" className="min-h-6 text-muted-foreground">
        {listening && (interim || "Słucham… Mów spokojnie, tekst pojawi się w polu poniżej.")}
      </p>
      {error && <p role="alert" className="text-destructive">{error}</p>}
    </div>
  );
}
