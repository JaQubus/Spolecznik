import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FieldHint } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const metadata = { title: "Sprawdź status" };

async function go(formData: FormData) {
  "use server";
  const kod = String(formData.get("kod") ?? "").trim().toUpperCase();
  if (kod) redirect(`/status/${encodeURIComponent(kod)}`);
}

export default function Page() {
  return (
    <section className="max-w-md space-y-6">
      <h1 className="text-3xl font-bold">Sprawdź status zgłoszenia</h1>
      <form action={go} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="kod">Kod zgłoszenia</Label>
          <FieldHint id="kod-pomoc">Kod jest w potwierdzeniu zgłoszenia, np. <span className="font-mono">SPL-4K7Q</span>.</FieldHint>
          {/* Kody do przepisania: Atkinson Hyperlegible Mono, żeby 0 i O się nie myliły. */}
          <Input id="kod" name="kod" aria-describedby="kod-pomoc" required autoComplete="off" spellCheck={false} className="max-w-xs font-mono tracking-wider uppercase" />
        </div>
        <Button type="submit" className="w-full sm:w-auto">Sprawdź</Button>
      </form>
    </section>
  );
}
