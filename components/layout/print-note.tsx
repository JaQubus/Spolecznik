import { formatDate } from "@/lib/pl";

/**
 * Linia widoczna tylko na wydruku dokumentu z [data-print-root] (globals.css): mówi, co to za kartka
 * i skąd pochodzi, żeby była zrozumiała bez ekranu. Na ekranie jej nie ma.
 */
export function PrintNote({ children, dated = false }: { children: React.ReactNode; dated?: boolean }) {
  return (
    <p className="hidden text-base print:block">
      {children}
      {dated && ` · ${formatDate(new Date().toISOString())}`}
    </p>
  );
}
