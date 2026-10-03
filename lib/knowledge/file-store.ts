import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  areaFromRow, areaToRow, factFromRow, factToRow, innovationFromRow, innovationToRow,
  materialFromRow, materialToRow, personaFromRow,
} from "./rows";
import { StoreError, type Entity, type EntityKind, type KnowledgeStore } from "./store";

// Dane startowe w repo (generuje data/knowledge_seed.py) i lokalne zmiany z panelu (.data/, poza gitem).
const SEED_DIR = path.join(process.cwd(), "content", "knowledge");
const LOCAL_DIR = path.join(process.cwd(), ".data", "knowledge");

const FILES = { obszar: "areas", fakt: "facts", material: "materials", innowacja: "innovations" } as const;

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
  obszar: (e: Entity["obszar"]) => areaToRow(e),
  fakt: (e: Entity["fakt"]) => factToRow(e, "area"),
  material: (e: Entity["material"]) => materialToRow(e),
  innowacja: (e: Entity["innowacja"]) => innovationToRow(e, "groups"),
};
const rowId = (kind: EntityKind, r: Row) => (kind === "obszar" ? r.key : r.id);

/** Tryb bez kluczy: czyta content/knowledge, zmiany z panelu zapisuje w .data/knowledge. */
export const fileStore: KnowledgeStore = {
  mode: "pliki",
  areas: async () => (await readRows("areas")).map(areaFromRow),
  facts: async () => (await readRows("facts")).map(factFromRow),
  materials: async () => (await readRows("materials")).map(materialFromRow),
  innovations: async () => (await readRows("innovations")).map(innovationFromRow),
  personas: async () => (await readRows("personas")).map(personaFromRow),

  async save(kind, entity) {
    const name = FILES[kind];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mapowanie zależne od rodzaju
    const row: Row = { ...(TO_ROW[kind] as (e: any) => Row)(entity) };
    const rows = await readRows(name);
    const at = rows.findIndex((r) => rowId(kind, r) === rowId(kind, row));
    // Zachowujemy pola, których formularz nie edytuje (np. materials_zip, sign_language).
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
