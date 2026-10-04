import { formatDate } from "@/lib/pl";

/**
 * Nagłówek widoczny tylko na wydruku: co to za kartka, skąd i kiedy — żeby kartka była zrozumiała bez ekranu.
 * Renderowany po działaniu użytkownika (wynik z API), więc data z przeglądarki nie psuje hydratacji.
 */
export function PrintHeader({ title, details }: { title: string; details?: string[] }) {
  return (
    <div className="hidden space-y-1 border-b border-border-strong pb-3 text-base print:block">
      <p>
        <strong>{title}</strong> · Społecznik · {formatDate(new Date().toISOString())}
      </p>
      {details?.map((d) => <p key={d}>{d}</p>)}
    </div>
  );
}
