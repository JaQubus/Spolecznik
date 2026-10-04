-- Grupy podobnych potrzeb w /panel/trendy (#23): same grupy liczy aplikacja ze słów kluczowych kart
-- (lib/knowledge/cluster-needs.ts), a tu trzymamy tylko etykiety z LLM. Liczymy je wsadowo przyciskiem
-- w panelu, nie przy każdym wejściu na stronę — darmowy Groq ma 200 tys. tokenów dziennie na klucz
-- wspólny z aplikacją.
create table if not exists need_cluster_labels (
  signature   text primary key,          -- najczęstsze słowa grupy, alfabetycznie, rozdzielone „|”
  keywords    text[] not null,           -- te same słowa: po nich etykieta pasuje też do lekko zmienionej grupy
  label       text not null,
  description text not null,
  needs       int not null,              -- ile zgłoszeń miała grupa przy nadawaniu etykiety
  created_at  timestamptz not null default now()
);

-- Zapis i odczyt tylko przez service_role po sprawdzeniu roli admina w aplikacji; dla pozostałych tylko admin.
alter table need_cluster_labels enable row level security;
create policy "admin czyta etykiety grup" on need_cluster_labels for select using (is_admin());
