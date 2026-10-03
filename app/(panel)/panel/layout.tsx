import { signOut } from "@/app/(public)/logowanie/actions";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth";
import { PanelNav } from "./panel-nav";

export default async function PanelLayout({ children }: LayoutProps<"/panel">) {
  const user = await requireAdmin();
  return (
    <div className="space-y-8">
      <div className="space-y-4 rounded-[16px] bg-secondary px-5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-base"><strong>Panel ROPS</strong> · zalogowano jako {user.label}</p>
          <form action={signOut}>
            <Button type="submit" variant="outline" size="sm">Wyloguj się</Button>
          </form>
        </div>
        <PanelNav />
      </div>
      {children}
    </div>
  );
}
