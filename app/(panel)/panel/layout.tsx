import { signOut } from "@/app/(public)/logowanie/actions";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth";

export default async function PanelLayout({ children }: LayoutProps<"/panel">) {
  const user = await requireAdmin();
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] bg-secondary px-5 py-3">
        <p className="text-base"><strong>Panel ROPS</strong> · zalogowano jako {user.email}</p>
        <form action={signOut}>
          <Button type="submit" variant="outline" size="sm">Wyloguj się</Button>
        </form>
      </div>
      {children}
    </div>
  );
}
