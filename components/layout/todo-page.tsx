/** Tymczasowa strona-szkielet: tytuł + lista tego, co ma tu powstać. */
export function TodoPage({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="text-muted-foreground">Ta część jest w budowie. Plan:</p>
      <ul className="list-disc space-y-1 pl-6">
        {items.map((i) => <li key={i}>{i}</li>)}
      </ul>
    </section>
  );
}
