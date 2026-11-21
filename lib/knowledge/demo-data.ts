import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Dane demonstracyjne z pipeline'u (data/seed_initiatives.py → data/out/demo.json) dla trybu bez bazy:
 * Panel pokazuje wtedy trendy, luki i grupy na tych samych syntetycznych inicjatywach, które seed ładuje do bazy.
 */
export type DemoInitiative = {
  id: string;
  status_code: string;
  teryt: string | null;
  created_at: string;
  title: string;
  summary: string;
  domains: string[];
  published?: boolean;
  card: { keywords?: string[]; summary?: string };
};

export type DemoChallenge = {
  id: string;
  teryt: string | null;
  created_at: string;
  best_fit: number | null;
  is_gap: boolean;
  card: { summary?: string; domains?: string[]; keywords?: string[] };
};

type Demo = { initiatives: DemoInitiative[]; challenges: DemoChallenge[] };

let cache: Promise<Demo> | null = null;

export function demoData(): Promise<Demo> {
  cache ??= readFile(path.join(process.cwd(), "data", "out", "demo.json"), "utf8")
    .then((s) => JSON.parse(s) as Partial<Demo>)
    .then((d) => ({ initiatives: d.initiatives ?? [], challenges: d.challenges ?? [] }))
    .catch(() => ({ initiatives: [], challenges: [] }));
  return cache;
}

export const hasDatabase = () => !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
