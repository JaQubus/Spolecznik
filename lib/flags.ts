// Linki do modułów, których jeszcze nie ma. Włączamy je zmienną środowiskową, gdy moduł będzie gotowy,
// żeby przyciski nie prowadziły donikąd. Gotowe moduły (Wdrożenie, Próba, Raport gminy) nie mają już flag.
export const flags = {
  /** „Przejdź do wniosku o grant” pod planem wdrożenia: generator wniosku do „Usługi Wrażliwej” — osobne zadanie (#99). */
  wniosekUslugaWrazliwa: process.env.NEXT_PUBLIC_FLAG_WNIOSEK_UW === "1",
};
