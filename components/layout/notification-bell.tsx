"use client";

import { BellIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "cn";
import { NOTIFICATION_EVENT, type NotificationItem, type NotificationsResponse } from "@/lib/notification-types";
import { createClient } from "@/lib/supabase/client";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/key";

const FALLBACK_POLL_MS = 60_000;

async function fetchNotifications(): Promise<NotificationsResponse | null> {
  try {
    const res = await fetch("/api/powiadomienia", { cache: "no-store" });
    return res.ok ? ((await res.json()) as NotificationsResponse) : null;
  } catch {
    return null;
  }
}

const when = (iso: string) =>
  new Date(iso).toLocaleString("pl-PL", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

/**
 * Dzwonek w nagłówku (README §6, „Ścieżka komunikacji”): dla zalogowanych — admin widzi nowe zgłoszenia,
 * pomysły i wiadomości, autor z kontem zmiany statusu, odpowiedzi i nabory. Niezalogowany nie widzi nic
 * (status sprawdza po kodzie). Na żywo przez Supabase Broadcast, zapasowo co minutę, gdy karta jest widoczna.
 */
export function NotificationBell({ buttonClassName }: { buttonClassName: string }) {
  const [data, setData] = useState<Extract<NotificationsResponse, { enabled: true }> | null>(null);
  const [open, setOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const button = useRef<HTMLButtonElement>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const lastUnread = useRef<number | null>(null);

  const apply = useCallback((json: NotificationsResponse | null) => {
    if (!json) return; // brak sieci: dzwonek zostaje z poprzednią listą
    if (!json.enabled) return setData(null);
    // Ogłaszamy tylko przyrost w trakcie wizyty, nie stan po wejściu na stronę.
    if (lastUnread.current !== null && json.unread > lastUnread.current) {
      const fresh = json.items.find((i) => i.unread);
      setAnnouncement(json.unread - lastUnread.current === 1 && fresh ? `Nowe powiadomienie: ${fresh.text}` : `Nowe powiadomienia: ${json.unread}`);
    }
    lastUnread.current = json.unread;
    setData(json);
  }, []);
  const load = useCallback(() => fetchNotifications().then(apply), [apply]);

  useEffect(() => {
    void fetchNotifications().then(apply);
    const onVisible = () => { if (document.visibilityState === "visible") void load(); };
    const timer = setInterval(onVisible, FALLBACK_POLL_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [apply, load]);

  const channels = data?.channels.join(",") ?? "";
  useEffect(() => {
    if (!channels || !SUPABASE_URL || !SUPABASE_KEY) return;
    const supabase = createClient();
    const subs = channels.split(",").map((name) =>
      supabase.channel(name).on("broadcast", { event: NOTIFICATION_EVENT }, () => void load()).subscribe(),
    );
    return () => { for (const s of subs) void supabase.removeChannel(s); };
  }, [channels, load]);

  // Klik poza listą zamyka ją (jak podpowiedzi gmin).
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => { if (!wrapper.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  if (!data) return null;
  const { items, unread } = data;

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0 && items[0]) {
      // Widziane do najnowszego pokazanego. Znacznik „nowe” przy pozycjach zostaje do zamknięcia listy.
      void fetch("/api/powiadomienia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seenAt: items[0].createdAt }),
      });
      lastUnread.current = 0;
      setData({ ...data!, unread: 0 });
    }
    if (!next) setData({ ...data!, items: items.map((i) => ({ ...i, unread: false })) });
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "Escape" || !open) return;
    e.stopPropagation(); // nie zamykaj przy okazji panelu „Dostępność” w tym samym pasku
    toggle();
    button.current?.focus();
  }

  return (
    <div ref={wrapper} className="relative" onKeyDown={onKeyDown}>
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls="powiadomienia"
        onClick={toggle}
        className={buttonClassName}
      >
        <BellIcon aria-hidden className="size-5" />
        Powiadomienia
        {unread > 0 && (
          <span className={cn("rounded-full px-2 text-sm", open ? "bg-background text-foreground" : "bg-foreground text-background")}>
            {unread > 99 ? "99+" : unread}
            <span className="sr-only"> {unread === 1 ? "nowe" : "nowych"}</span>
          </span>
        )}
      </button>

      {/* Ogłoszenie nowych powiadomień dla czytnika ekranu, bez przenoszenia fokusu. */}
      <p role="status" className="sr-only">{announcement}</p>

      <div
        id="powiadomienia"
        hidden={!open}
        className="absolute left-0 top-full z-50 mt-2 w-[min(28rem,calc(100vw-2rem))] rounded-[16px] border-2 border-border-strong bg-background p-4 shadow-[var(--shadow-overlay)]"
      >
        <h2 className="mb-2 text-lg font-bold">Powiadomienia</h2>
        {items.length === 0 ? (
          <p className="text-base">Nie masz jeszcze powiadomień.</p>
        ) : (
          <ul className="max-h-[60vh] divide-y overflow-y-auto">
            {items.map((n) => <Row key={n.id} n={n} onNavigate={() => setOpen(false)} />)}
          </ul>
        )}
      </div>
    </div>
  );
}

function Row({ n, onNavigate }: { n: NotificationItem; onNavigate: () => void }) {
  const body = (
    <>
      <span className={cn("block", n.unread && "font-bold")}>
        {n.unread && <span className="mr-2 rounded-full border border-foreground px-2 text-sm font-bold">nowe</span>}
        {n.text}
      </span>
      <span className="block text-sm text-muted-foreground">{when(n.createdAt)}</span>
    </>
  );
  return (
    <li className="py-2">
      {n.href ? (
        <Link href={n.href} onClick={onNavigate} className="block rounded-lg px-2 py-1 text-base underline decoration-1 underline-offset-4 hover:bg-secondary hover:decoration-2">
          {body}
        </Link>
      ) : (
        <p className="px-2 py-1 text-base">{body}</p>
      )}
    </li>
  );
}
