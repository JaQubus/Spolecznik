import { Alert } from "@/components/ui/alert";
import { StoryTile, StoryTiles } from "@/components/ui/story-tile";
import { isGroup, listInnovations, type InnovationTile } from "@/lib/library";
import { formatNumber, plural } from "@/lib/pl";
import { GROUP_LABELS } from "@/lib/taxonomy";
import { AskLibrary } from "./ask-library";
import { GroupFilter } from "./group-filter";

export const metadata = { title: "Biblioteka i wiedza" };

function excerpt(text: string | null, max = 160): string | null {
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max).replace(/\s+\S*$/, "")}…` : text;
}

export default async function Page(props: PageProps<"/biblioteka">) {
  const params = await props.searchParams;
  const group = isGroup(params.dla) ? params.dla : null;

  let innovations: InnovationTile[] = [];
  let unavailable = false;
  try {
    innovations = await listInnovations(group ?? undefined);
  } catch (e) {
    console.error("[biblioteka]", e);
    unavailable = true;
  }
  const n = innovations.length;

  return (
    <div className="space-y-16">
      <section className="space-y-6">
        <h1 className="text-3xl font-bold">Biblioteka i wiedza</h1>
        <p className="max-w-2xl text-lg">
          Rozwiązania, które już działają w Polsce. Każde opisujemy w czterech krokach: jaki był problem, co zrobiono,
          skąd wiemy, że działa, i jak możesz z tego skorzystać.
        </p>

        <GroupFilter current={group} />

        {unavailable ? (
          <Alert tone="error" title="Biblioteka jest chwilowo niedostępna">
            <p>Nie udało się pobrać rozwiązań. Spróbuj ponownie za kilka minut.</p>
          </Alert>
        ) : (
          <>
            <p role="status" className="text-base text-muted-foreground">
              {n === 0
                ? group
                  ? `Nie ma jeszcze rozwiązań w kategorii „${GROUP_LABELS[group]}”.`
                  : "Biblioteka jest jeszcze pusta."
                : `${n} ${plural(n, "rozwiązanie", "rozwiązania", "rozwiązań")}${group ? ` w kategorii „${GROUP_LABELS[group]}”` : ""}`}
            </p>
            {n > 0 && (
              <StoryTiles>
                {innovations.map((i) => (
                  <StoryTile
                    key={i.id}
                    href={`/biblioteka/${i.slug}`}
                    title={i.title}
                    badge={i.synthetic ? "Przykład" : undefined}
                    meta={
                      [i.category, i.testsCount > 0 ? `przetestowano ${i.testsCount} ${plural(i.testsCount, "raz", "razy", "razy")}${i.avgRating != null ? `, średnio ${formatNumber(i.avgRating)} na 5` : ""}` : null]
                        .filter(Boolean)
                        .join(" · ") || undefined
                    }
                    note={excerpt(i.etrSummary ?? i.solution)}
                  />
                ))}
              </StoryTiles>
            )}
          </>
        )}
      </section>

      <section aria-labelledby="zapytaj-biblioteke" className="space-y-4">
        <h2 id="zapytaj-biblioteke" className="text-2xl font-bold">Zapytaj Bibliotekę</h2>
        <p className="max-w-2xl">Zadaj pytanie o sytuację w Małopolsce albo o innowacje społeczne.</p>
        <AskLibrary />
      </section>
    </div>
  );
}
