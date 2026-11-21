import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  domainFromRow, domainToRow, factFromRow, factToRow, materialFromRow, materialToRow, patternFromRow, patternToRow,
} from "./rows";
import { StoreError, type Entity, type EntityKind, type KnowledgeStore } from "./store";

// Dane startowe w repo (generuje data/knowledge_seed.py) i lokalne zmiany z panelu (.data/, poza gitem).
const SEED_DIR = path.join(process.cwd(), "content", "library");
const LOCAL_DIR = path.join(process.cwd(), ".data", "library");

const FILES = { dziedzina: "domains", fakt: "facts", material: "materials", rozwiazanie: "patterns" } as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- surowe wiersze JSON
type Row = Record<string, any>;

async function readRows(name: string): Promise<Row[]> {
  for (const dir of [LOCAL_DIR, SEED_DIR]) {
    try {
      return JSON.parse(await readFile(path.join(dir, `${name}.json`), "utf8"));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
  }
  return [];
}

async function writeRows(name: string, rows: Row[]): Promise<void> {
  try {
    await mkdir(LOCAL_DIR, { recursive: true });
    await writeFile(path.join(LOCAL_DIR, `${name}.json`), JSON.stringify(rows, null, 2));
  } catch (e) {
    console.error("[knowledge] zapis do .data/ nieudany:", e);
    throw new StoreError("Nie udało się zapisać zmian. Bez bazy danych zapis działa tylko na komputerze lokalnym.");
  }
}

const TO_ROW = {
  dziedzina: (e: Entity["dziedzina"]) => domainToRow(e),
  fakt: (e: Entity["fakt"]) => factToRow(e, "domain"),
  material: (e: Entity["material"]) => materialToRow(e),
  rozwiazanie: (e: Entity["rozwiazanie"]) => patternToRow(e),
};
const rowId = (kind: EntityKind, r: Row) => (kind === "dziedzina" ? r.key : r.id);

/** Tryb bez kluczy: czyta content/library, zmiany z panelu zapisuje w .data/library. */
export const fileStore: KnowledgeStore = {
  mode: "pliki",
  domains: async () => (await readRows("domains")).map(domainFromRow),
  facts: async () => (await readRows("facts")).map(factFromRow),
  materials: async () => (await readRows("materials")).map(materialFromRow),
  patterns: async () => (await readRows("patterns")).map(patternFromRow),

  async save(kind, entity) {
    const name = FILES[kind];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mapowanie zależne od rodzaju
    const row: Row = { ...(TO_ROW[kind] as (e: any) => Row)(entity) };
    const rows = await readRows(name);
    const at = rows.findIndex((r) => rowId(kind, r) === rowId(kind, row));
    // Zachowujemy pola, których formularz nie edytuje (np. materials_zip, lemmas).
    if (at >= 0) rows[at] = { ...rows[at], ...row };
    else rows.push(row);
    await writeRows(name, rows);
  },

  async remove(kind, id) {
    const name = FILES[kind];
    await writeRows(name, (await readRows(name)).filter((r) => rowId(kind, r) !== id));
  },

  async writeBlocker() {
    return process.env.VERCEL
      ? "Zapis wymaga bazy danych. Bez niej zmiany da się zapisać tylko na komputerze lokalnym."
      : null;
  },
};
