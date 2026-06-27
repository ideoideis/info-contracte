-- ───────────────────────────────────────────────────────────────────────────
-- info-contracte — full schema. Idempotent: safe to run multiple times.
-- Paste into the Supabase SQL Editor and Run, or `supabase db push`.
-- (Concatenation of migrations 001 + 002.)
-- ───────────────────────────────────────────────────────────────────────────

-- 001 — echipa_contracte table + RLS ─────────────────────────────────────────
create table if not exists public.echipa_contracte (
  id uuid primary key default gen_random_uuid(),

  tip text not null,                 -- 'fizica' | 'juridica'

  -- persoană fizică (membru echipă)
  nume_complet text,
  cnp text,
  serie_ci text,
  numar_ci text,
  ci_eliberat_de text,
  ci_valabilitate text,
  ci_path text,

  -- persoană juridică (firmă) — date de facturare
  nume_firma text,
  cui text,
  nr_reg_com text,
  sediu_social text,
  reprezentant text,

  -- comune ambelor tipuri
  telefon text not null,
  email text not null,
  cont_bancar text,
  banca text,

  acord_gdpr boolean not null default false,

  created_at timestamptz not null default now()
);

alter table public.echipa_contracte enable row level security;

drop policy if exists "Anyone can insert echipa contracte" on public.echipa_contracte;
create policy "Anyone can insert echipa contracte"
  on public.echipa_contracte for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Authenticated can read echipa contracte" on public.echipa_contracte;
create policy "Authenticated can read echipa contracte"
  on public.echipa_contracte for select
  to authenticated
  using (true);

-- 002 — private echipa-ci storage bucket + policies ──────────────────────────
insert into storage.buckets (id, name, public)
values ('echipa-ci', 'echipa-ci', false)
on conflict (id) do nothing;

drop policy if exists "Anyone can upload echipa CI" on storage.objects;
create policy "Anyone can upload echipa CI"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'echipa-ci');

drop policy if exists "Authenticated can read echipa CI" on storage.objects;
create policy "Authenticated can read echipa CI"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'echipa-ci');
