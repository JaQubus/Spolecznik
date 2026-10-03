-- Testy innowacji z seed_synthetic.py też muszą być oznaczone jako syntetyczne
-- (pozostałe tabele z danymi demo mają tę kolumnę od 0001).
alter table tests add column if not exists synthetic boolean not null default false;
