import { ChatBubbleLeftEllipsisIcon, CpuChipIcon } from "@heroicons/react/24/outline";
import { Badge } from "@/components/ui/badge";
import { AI_LABELS, type Waiting } from "@/lib/panel/conversations";

/** Etykiety wiersza skrzynki: rozmowa czeka na człowieka i co zrobił w niej asystent AI. Elementy listy <li>. */
export function WaitingBadges({ waiting }: { waiting?: Waiting }) {
  if (!waiting) return null;
  return (
    <>
      <li><Badge variant="outline"><ChatBubbleLeftEllipsisIcon aria-hidden className="size-4" /> Czeka na odpowiedź ROPS</Badge></li>
      {waiting.ai && <li><Badge variant="outline"><CpuChipIcon aria-hidden className="size-4" /> {AI_LABELS[waiting.ai]}</Badge></li>}
    </>
  );
}
