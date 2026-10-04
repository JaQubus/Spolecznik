import { ChatBubbleLeftEllipsisIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { Badge } from "@/components/ui/badge";
import type { ThreadWaiting } from "@/lib/thread-types";
import { waitingThreads } from "@/lib/threads";

/** Rozmowy czekające na człowieka; bez migracji 0019 skrzynka działa dalej, tylko bez tej informacji. */
export async function waitingOrEmpty(...args: Parameters<typeof waitingThreads>) {
  try {
    return await waitingThreads(...args);
  } catch (e) {
    console.error("[panel] rozmowy czekające:", e);
    return new Map<string, Exclude<ThreadWaiting, null>>();
  }
}

/** Etykieta rozmowy, która czeka na człowieka — ze słowami i ikoną, nie tylko kolorem. */
export function WaitingBadge({ waiting }: { waiting: ThreadWaiting }) {
  if (!waiting) return null;
  return (
    <li>
      {waiting === "pilne" ? (
        <Badge><ExclamationTriangleIcon aria-hidden className="size-4" /> Pilne: odpowiedź AI nie pomogła</Badge>
      ) : (
        <Badge variant="outline"><ChatBubbleLeftEllipsisIcon aria-hidden className="size-4" /> Rozmowa czeka na człowieka</Badge>
      )}
    </li>
  );
}
