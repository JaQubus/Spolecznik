/**
 * Drukuje stronę z tytułem dokumentu ustawionym na czas druku — przeglądarka bierze go za nazwę pliku
 * przy „Zapisz jako PDF” (zamiast „Jak to wdrożyć u nas? · Społecznik”). Potem przywraca tytuł.
 */
export function printAs(title: string): void {
  const previous = document.title;
  const restore = () => {
    document.title = previous;
    window.removeEventListener("afterprint", restore);
  };
  window.addEventListener("afterprint", restore);
  document.title = title;
  window.print();
}
