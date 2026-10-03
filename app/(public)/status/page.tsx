import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
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
    <section className="max-w-md space-y-4">
      <h1 className="text-3xl font-bold">Sprawdź status zgłoszenia</h1>
      <form action={go} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="kod" className="text-lg">Kod zgłoszenia</Label>
          <Input id="kod" name="kod" placeholder="SPL-4K7Q" required autoComplete="off" className="text-lg uppercase" />
        </div>
        <Button type="submit" size="lg">Sprawdź</Button>
      </form>
    </section>
  );
}
