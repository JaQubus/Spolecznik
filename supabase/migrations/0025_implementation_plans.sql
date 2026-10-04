-- Wdrożenie (#99): szkice planów wdrożenia z „Jak to wdrożyć u nas?”. Panel → Wdrożenia pokazuje,
-- które innowacje gminy chcą wdrażać. Zapisuje /api/middleman kluczem service_role (także bez konta).
-- plan to dokument po sprawdzeniu na serwerze (lib/implementation-plan.ts → CheckedPlan), input to pola formularza.
create table if not exists implementation_plans (
  id               uuid primary key default gen_random_uuid(),
  innovation_id    uuid not null references innovations on delete cascade,
  teryt            text not null references gminy,
  institution_type text not null check (institution_type in ('jst','ops','pcpr','cus','ngo','pes')),
  input            jsonb not null,
  plan             jsonb not null,
  author_id        uuid references auth.users on delete set null,
  created_at       timestamptz not null default now()
);

create index if not exists implementation_plans_created on implementation_plans (created_at desc);
create index if not exists implementation_plans_innovation on implementation_plans (innovation_id, created_at desc);

-- Plan zdradza, która instytucja z której gminy planuje wdrożenie, więc nie jest publiczny: autor i admin.
alter table implementation_plans enable row level security;
create policy "autor lub admin" on implementation_plans for select using (author_id = auth.uid() or is_admin());
