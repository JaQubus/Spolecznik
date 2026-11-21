"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { useLiveThread } from "@/components/rozmowa/use-live-thread";

/** Nowa wiadomość od autora (albo ROPS) odświeża stronę eksperta bez przeładowania (Realtime Broadcast). */
export function ThreadLive({ threadId }: { threadId: string | null }) {
  const router = useRouter();
  const refresh = useCallback(() => router.refresh(), [router]);
  useLiveThread(threadId, refresh);
  return null;
}
