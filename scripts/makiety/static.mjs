// Makiety statyczne: stany, które w aplikacji powstają dopiero po odpowiedzi LLM (Groq) albo za logowaniem
// (Panel ROPS). Skrypt wstawia je do <main> prawdziwej strony, więc nagłówek i stopka są z aplikacji,
// a treść jest złożona z komponentów systemu projektowego (docs/design-system/reference.css, klasy hm-*).
// Wszystkie dane są syntetyczne.

const ICONS = {
  info: "m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z",
  success: "M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  error: "M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z",
  check: "m4.5 12.75 6 6 9-13.5",
  arrow: "M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3",
  users: "M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z",
  shield: "M12 9v3.75m0-10.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.25-8.25-3.286Zm0 13.036h.008v.008H12v-.008Z",
};

const icon = (name) =>
  `<svg class="hm-ico" viewBox="0 0 24 24" stroke-width="1.5" aria-hidden="true"><path d="${ICONS[name]}"/></svg>`;

const alert = (tone, title, body, role = "status") =>
  `<div class="hm-alert${tone === "info" ? "" : ` hm-alert--${tone}`}" role="${role}">${icon(tone)}<div><p class="hm-alert__title">${title}</p>${body ? `<p class="hm-alert__body">${body}</p>` : ""}</div></div>`;

const chips = (items) => `<ul class="hm-chips" aria-label="Obszary">${items.map((c) => `<li class="hm-chip">${c}</li>`).join("")}</ul>`;

const fitLabel = (fit) => (fit >= 80 ? "Bardzo dobrze pasuje" : fit >= 65 ? "Dobrze pasuje" : "Może pasować");

const result = ({ title, fit, why, adapt, areas }) => `
  <li class="hm-result">
    <h3 class="hm-result__title"><a href="#">${title}</a></h3>
    <div class="hm-fit"><span><strong>${fitLabel(fit)}</strong> · dopasowanie ${fit} na 100</span>
      <span class="hm-fit__track" aria-hidden="true"><span class="hm-fit__bar" style="width:${fit}%"></span></span></div>
    ${chips(areas)}
    <dl><dt>Dlaczego pasuje</dt><dd>${why}</dd><dt>Co dostosować u Ciebie</dt><dd>${adapt}</dd></dl>
    <div class="hm-result__actions">
      <a class="hm-btn hm-btn--secondary hm-btn--sm" href="#">Jak to wdrożyć u nas?</a>
      <a class="hm-btn hm-btn--quiet hm-btn--sm" href="#">Chcę przetestować</a>
      <a class="hm-btn hm-btn--quiet hm-btn--sm" href="#">Zapytaj eksperta</a>
    </div>
  </li>`;

const code = (c) =>
  `<div class="mk-code"><p>Twój kod zgłoszenia: <strong class="mk-mono">${c}</strong></p><p>Zapisz go. Po tym kodzie sprawdzisz, co dzieje się z Twoim zgłoszeniem — bez zakładania konta.</p></div>`;

const section = (h, body) => `<section class="mk-section"><h2 class="mk-h2">${h}</h2>${body}</section>`;

export const STATIC = {
  // I · Dopasuj — wyniki po odpowiedzi silnika dopasowań
  wyniki: `
    <h1 class="mk-h1">Opisz problem</h1>
    <section class="mk-stack" aria-live="polite">
      <h2 class="mk-h2">Znaleźliśmy 3 rozwiązania</h2>
      <p class="mk-measure"><strong>Zrozumieliśmy tak:</strong> w przysiółkach gminy Lanckorona seniorzy są samotni, a autobus jeździ dwa razy dziennie, więc trudno im wyjść z domu.</p>
      ${chips(["Seniorzy", "Samotność", "Transport"])}
      ${code("SPL-4K7Q")}
      <ol class="hm-results">
        ${result({ title: "Senior CUDER — sąsiedzka opieka nad seniorami", fit: 86, areas: ["Seniorzy", "Wolontariat"], why: "Gmina wiejska z rozproszonymi przysiółkami; rozwiązanie działa bez transportu, sąsiedzi odwiedzają seniorów.", adapt: "Zacznij od 2 sołectw z najwyższym odsetkiem osób 65+; koordynację może przejąć GOPS." })}
        ${result({ title: "Organizator kompleksowej opieki w miejscu zamieszkania", fit: 78, areas: ["Seniorzy", "Opieka"], why: "Jedna osoba łączy usługi opiekuńcze, dowóz i wizyty lekarza u seniora w domu.", adapt: "Potrzebny etat w GOPS lub CUS; sprawdź, czy gmina ma już asystentów osobistych." })}
        ${result({ title: "Kody QR na pomoc seniorom", fit: 64, areas: ["Seniorzy", "Bezpieczeństwo"], why: "Szybki kontakt z sąsiadem lub opiekunem bez smartfona u seniora.", adapt: "Działa tylko z siecią wolontariuszy — połącz z jednym z rozwiązań wyżej." })}
      </ol>
    </section>
    <section class="mk-stack">
      <h2 class="mk-h3">${icon("users")} 4 inne gminy zgłosiły podobny problem</h2>
      <p>Zawoja, Stryszawa, Budzów, Tokarnia.</p>
      <p class="mk-muted">Razem łatwiej znaleźć rozwiązanie i pieniądze na nie.</p>
      <p><a class="hm-btn hm-btn--secondary" href="#">Połącz się z tymi gminami</a></p>
    </section>`,

  // I · Dopasuj — luka: brak rozwiązania, wejście do Pracowni
  luka: `
    <h1 class="mk-h1">Opisz problem</h1>
    <section class="mk-stack" aria-live="polite">
      <h2 class="mk-h2">Nie znaleźliśmy jeszcze gotowego rozwiązania</h2>
      <p class="mk-measure"><strong>Zrozumieliśmy tak:</strong> młodzi wyjeżdżają z gminy Zawoja, a w świetlicy nie ma zajęć dla nastolatków po 16.</p>
      ${chips(["Młodzież", "Czas wolny"])}
      ${code("SPL-5G4N")}
      ${alert("info", "To ważna informacja", "Najlepsze dopasowanie ma tylko 31 na 100. Zapisaliśmy tę potrzebę na Mapie luk — ROPS zobaczy, gdzie warto otworzyć nabór.<br><br>Masz pomysł, jak to rozwiązać? Pomożemy go opisać.")}
      <p class="mk-actions"><a class="hm-btn hm-btn--primary" href="#">Zgłoś pomysł ${icon("arrow")}</a><a class="hm-btn hm-btn--quiet" href="#">Zapytaj eksperta</a></p>
    </section>`,

  // VII · Wdrożenie — karta wdrożeniowa wygenerowana dla gminy
  karta: `
    <h1 class="mk-h1">Senior CUDER w gminie Lanckorona</h1>
    <p class="mk-lead">Karta wdrożeniowa na podstawie karty innowacji i danych gminy z BDL. Koszty to szacunek — założenia są opisane przy każdej liczbie.</p>
    ${section("Cel", "<p>Seniorzy z przysiółków mają stały kontakt z sąsiadami i wiedzą, do kogo zadzwonić.</p>")}
    ${section("Odbiorcy w Twojej gminie", "<p><strong>2 140 osób ma 65 lat lub więcej</strong> — to co piąta osoba w gminie (BDL, 2024).</p><p>Najwięcej w sołectwach Izdebnik i Skawinki.</p>")}
    ${section("Forma usługi", "<p>Usługa sąsiedzka w ramach Centrum Usług Społecznych; koordynuje ją GOPS.</p>")}
    ${section("Kroki", "<ol class='mk-list'><li>Wybierz 2 sołectwa na start i porozmawiaj z sołtysami.</li><li>Zrekrutuj 10–15 sąsiadów-wolontariuszy.</li><li>Przeszkol ich (1 dzień, materiały z karty innowacji).</li><li>Po 3 miesiącach oceń test i zdecyduj o rozszerzeniu.</li></ol>")}
    ${section("Koszt — szacunek", "<p><strong>45–60 tys. zł rocznie</strong>: pół etatu koordynatora, szkolenia, telefon dyżurny. Założenie: stawki z 2025 r.</p>")}
    ${section("Partnerzy z bazy", "<p>Koło Gospodyń Wiejskich w Izdebniku · parafia · OSP Lanckorona</p>")}
    ${section("Ryzyka i wskaźniki sukcesu", "<ul class='mk-list'><li>Ryzyko: rotacja wolontariuszy — plan B to dyżur GOPS.</li><li>Sukces: 80% seniorów z listy ma co najmniej jedną wizytę w tygodniu.</li></ul>")}
    <p class="mk-actions"><a class="hm-btn hm-btn--primary" href="#">Chcę przetestować</a><a class="hm-btn hm-btn--secondary" href="#">Zapisz jako PDF</a><a class="hm-btn hm-btn--quiet" href="#">Zapytaj eksperta</a></p>`,

  // III · Pracownia — asystent sprawdza nowość, generator składa szkic wniosku
  wniosek: `
    <h1 class="mk-h1">Szkic wniosku</h1>
    <p class="mk-lead">Nabór „Małopolska Innowacji Społecznych 2026” jest otwarty do 30 listopada. Szkic powstał z Twojej fiszki; popraw go, zanim wyślesz.</p>
    ${alert("info", "Podobne już istnieje: Bank czasu w Zatorze", "Asystent sprawdził nowość tym samym silnikiem co dopasowanie. Czym Twój pomysł się różni? Dopisaliśmy to do sekcji „Nowość”.")}
    ${section("Fiszka", "<dl class='mk-dl'><dt>Krótki opis</dt><dd>Wieczorne warsztaty dla nastolatków prowadzone przez studentów z Krakowa, zdalnie i raz w miesiącu na miejscu.</dd><dt>Dla kogo</dt><dd>Młodzież 16–19 lat z gminy Zawoja</dd><dt>Etap</dt><dd>Pomysł do przetestowania</dd></dl>")}
    <fieldset class="hm-fieldset mk-section"><legend class="mk-h2">Kryteria naboru</legend>
      <label class="hm-choice"><input type="checkbox" checked> Opis problemu z danymi (BDL)</label>
      <label class="hm-choice"><input type="checkbox" checked> Grupa docelowa i jej liczebność</label>
      <label class="hm-choice"><input type="checkbox" checked> Nowość względem istniejących rozwiązań</label>
      <label class="hm-choice"><input type="checkbox"> Budżet i harmonogram testu</label>
      <label class="hm-choice"><input type="checkbox"> Partner lokalny (list intencyjny)</label>
    </fieldset>
    <p class="mk-actions"><a class="hm-btn hm-btn--primary" href="#">Drukuj lub zapisz PDF</a><a class="hm-btn hm-btn--quiet" href="#">Wróć do fiszki</a></p>`,

  // V · Rozmowy — status zgłoszenia jak śledzenie przesyłki
  status: `
    <h1 class="mk-h1">Status zgłoszenia</h1>
    <p class="mk-lead">Kod <strong class="mk-mono">SPL-4K7Q</strong> · Gmina Lanckorona · seniorzy</p>
    <ol class="hm-timeline">
      <li class="hm-step hm-step--done"><span class="hm-step__dot">${icon("check")}</span><div><p class="hm-step__title">Zgłoszone</p><p class="hm-step__meta">3 października, 10:42</p></div></li>
      <li class="hm-step hm-step--done"><span class="hm-step__dot">${icon("check")}</span><div><p class="hm-step__title">W analizie</p><p class="hm-step__meta">3 października, 14:05</p></div></li>
      <li class="hm-step hm-step--current" aria-current="step"><span class="hm-step__dot"></span><div><p class="hm-step__title">Przypisano eksperta</p><p class="hm-step__meta">Teraz · ekspertka ROPS czyta Twoje zgłoszenie</p></div></li>
      <li class="hm-step hm-step--todo"><span class="hm-step__dot"></span><div><p class="hm-step__title">Odpowiedź</p><p class="hm-step__meta">Dostaniesz e-mail</p></div></li>
    </ol>
    ${alert("info", "Wiadomość od ROPS", "Dzień dobry, przekazaliśmy zgłoszenie ekspertce od usług opiekuńczych. Odezwie się w wątku w ciągu 3 dni roboczych.")}`,

  // VI · Panel — skrzynka zgłoszeń z triage AI
  panel: `
    <div class="mk-panelbar"><p><strong>Panel ROPS</strong> · zalogowano jako Anna Kowalska (konto demo)</p><a class="hm-btn hm-btn--secondary hm-btn--sm" href="#">Wyloguj się</a>
      <nav aria-label="Panel"><ul class="mk-panelnav"><li><a aria-current="page" href="#">Zgłoszenia</a></li><li><a href="#">Pomysły</a></li><li><a href="#">Nabory</a></li><li><a href="#">Trendy</a></li><li><a href="#">Wiedza</a></li></ul></nav></div>
    <h1 class="mk-h1">Zgłoszenia</h1>
    <nav aria-label="Filtruj zgłoszenia"><ul class="hm-chips">
      <li><button class="hm-chip" aria-pressed="true">${icon("check")} Do przejrzenia</button></li><li><button class="hm-chip">Luki</button></li><li><button class="hm-chip">W analizie</button></li><li><button class="hm-chip">Przypisano eksperta</button></li><li><button class="hm-chip">Wszystkie</button></li></ul></nav>
    <p class="mk-muted" role="status">12 zgłoszeń do przejrzenia</p>
    <ol class="hm-results mk-wide">
      ${[
        ["SPL-4K7Q", "Seniorzy w przysiółkach są samotni, autobus jeździ dwa razy dziennie.", "Lanckorona · 2 godz. temu", "Seniorzy · 3 podobne zgłoszenia · sugerowana ekspertka: dr Ewa Nowak", false],
        ["SPL-5G4N", "W świetlicy nie ma zajęć dla nastolatków po 16, młodzi wyjeżdżają.", "Zawoja · 5 godz. temu", "Młodzież · luka (najlepsze dopasowanie 31 na 100) · sugerowany ekspert: Jan Wiśniewski", false],
        ["SPL-9RTD", "Pani [imię] z ul. [adres] potrzebuje pomocy przy zakupach.", "Sucha Beskidzka · wczoraj", "Seniorzy · możliwe dane osobowe — zanonimizowano przed analizą", true],
      ].map(([c, s, meta, tri, pii]) => `
        <li class="hm-result">
          <p class="mk-mono">${c}</p>
          <h2 class="hm-result__title"><a href="#">${s}</a></h2>
          <p class="mk-muted">${meta}</p>
          <p>${pii ? icon("shield") + " " : ""}<strong>Triage AI:</strong> ${tri}</p>
          <div class="hm-result__actions"><a class="hm-btn hm-btn--secondary hm-btn--sm" href="#">Przypisz eksperta</a><a class="hm-btn hm-btn--quiet hm-btn--sm" href="#">Otwórz wątek</a></div>
        </li>`).join("")}
    </ol>`,

  // VI · Panel — Trendy i Mapa luk
  trendy: `
    <div class="mk-panelbar"><p><strong>Panel ROPS</strong> · zalogowano jako Anna Kowalska (konto demo)</p><a class="hm-btn hm-btn--secondary hm-btn--sm" href="#">Wyloguj się</a>
      <nav aria-label="Panel"><ul class="mk-panelnav"><li><a href="#">Zgłoszenia</a></li><li><a href="#">Pomysły</a></li><li><a href="#">Nabory</a></li><li><a aria-current="page" href="#">Trendy</a></li><li><a href="#">Wiedza</a></li></ul></nav></div>
    <h1 class="mk-h1">Trendy i mapa luk</h1>
    <p class="mk-lead">Potrzeby bez gotowego rozwiązania, wg powiatu i obszaru (ostatnie 90 dni). Tam, gdzie luk jest najwięcej, warto otworzyć nabór.</p>
    <table class="mk-table">
      <caption class="hm-sr">Luki wg powiatu i obszaru</caption>
      <thead><tr><th scope="col">Powiat</th><th scope="col">Obszar</th><th scope="col">Luki</th><th scope="col"><span class="hm-sr">Wykres</span></th></tr></thead>
      <tbody>
        ${[["suski", "Młodzież", 14], ["nowotarski", "Seniorzy", 11], ["gorlicki", "Zdrowie psychiczne", 9], ["miechowski", "Transport", 6], ["olkuski", "Rodzina", 4]]
          .map(([p, o, n]) => `<tr><td>${p}</td><td>${o}</td><td><strong>${n}</strong></td><td><span class="hm-fit__track mk-bar" aria-hidden="true"><span class="hm-fit__bar" style="width:${n * 7}%"></span></span></td></tr>`).join("")}
      </tbody>
    </table>
    ${alert("info", "Tu otwórzcie nabór", "Powiat suski, młodzież: 14 zgłoszeń bez rozwiązania w 90 dni. Klaster nazwany przez AI: „brak zajęć po szkole dla 16+”.")}
    <p class="mk-actions"><a class="hm-btn hm-btn--secondary" href="#">Utwórz nabór dla tej luki</a><a class="hm-btn hm-btn--quiet" href="#">Eksportuj CSV</a></p>`,
};

// Tokeny, których nie ma w globals.css aplikacji (odstępy, promienie, rozmiary), ograniczone do .hm,
// żeby nie nadpisać skali Tailwinda. Wartości z docs/design-system/tokens.json.
export const TOKENS_CSS = `
.hm { --space-1:4px; --space-2:8px; --space-3:12px; --space-4:16px; --space-5:24px; --space-6:32px; --space-7:48px; --space-8:72px;
  --radius-sm:8px; --radius-md:16px; --radius-lg:24px; --radius-pill:999px; --target-min:48px; --control-height:56px; --page-max:1120px;
  --font-sans: var(--font-atkinson), "Atkinson Hyperlegible Next", system-ui, sans-serif;
  --font-mono: var(--font-atkinson-mono), "Atkinson Hyperlegible Mono", monospace;
  background: transparent; display: flex; flex-direction: column; gap: var(--space-6); }
.hm p { margin: 0; }
.hm p > .hm-ico { display: inline-block; vertical-align: -6px; } /* preflight Tailwinda robi z svg blok */
.mk-h1 { margin: 0; font-size: 2rem; line-height: 2.5rem; font-weight: 700; }
.mk-h2 { margin: 0; font-size: 1.5rem; line-height: 2rem; font-weight: 700; }
.mk-h3 { margin: 0; font-size: 1.25rem; line-height: 1.75rem; font-weight: 700; display: flex; gap: var(--space-2); align-items: center; }
.mk-lead { font-size: 1.25rem; line-height: 2rem; max-width: 68ch; }
.mk-measure { max-width: 68ch; }
.mk-muted { color: var(--ink-muted); }
.mk-stack, .mk-section { display: flex; flex-direction: column; gap: var(--space-3); max-width: 48rem; }
.mk-actions { display: flex; flex-wrap: wrap; gap: var(--space-3); }
.mk-list { margin: 0; padding-left: 1.5rem; display: grid; gap: var(--space-2); }
.mk-dl { margin: 0; display: grid; gap: var(--space-1); } .mk-dl dt { font-weight: 700; margin-top: var(--space-2); } .mk-dl dd { margin: 0; }
.mk-mono { font-family: var(--font-mono); font-weight: 500; letter-spacing: 0.04em; }
.mk-code { background: var(--surface-alt); border-radius: var(--radius-md); padding: var(--space-4) var(--space-5); display: grid; gap: var(--space-2); max-width: 48rem; }
.mk-code .mk-mono { font-size: 1.5rem; white-space: nowrap; }
.mk-wide { max-width: 56rem; }
.mk-panelbar { background: var(--surface-alt); border-radius: var(--radius-md); padding: var(--space-3) var(--space-5); display: flex; flex-wrap: wrap; gap: var(--space-3); justify-content: space-between; align-items: center; }
.mk-panelbar nav { flex-basis: 100%; }
.mk-panelnav { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: var(--space-5); }
.mk-panelnav a { color: var(--ink); text-decoration: underline; text-underline-offset: 4px; font-size: 1.125rem; }
.mk-panelnav a[aria-current="page"] { font-weight: 700; text-decoration-thickness: 2px; }
.mk-table { border-collapse: collapse; width: 100%; max-width: 48rem; }
.mk-table th, .mk-table td { text-align: left; padding: var(--space-3) var(--space-3) var(--space-3) 0; border-bottom: 1px solid var(--divider); }
.mk-bar { width: 160px; height: 8px; display: block; }
@media (max-width: 479px) { .mk-bar { width: 64px; } .mk-h1 { font-size: 1.75rem; line-height: 2.25rem; } }
`;
