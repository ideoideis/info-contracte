-- echipa_contracte: contract data collected from the internal ideo ideis team.
-- One row per submission. A submission is either a "persoană fizică" (a team
-- member, with their ID card + bank account) or a "persoană juridică" (a firm,
-- with billing data). Type-specific columns are nullable and only filled for
-- the matching `tip`.
create table if not exists public.echipa_contracte (
  id uuid primary key default gen_random_uuid(),

  tip text not null,                 -- 'fizica' | 'juridica'

  -- ── persoană fizică (membru echipă) ──
  department text,                   -- echipă: Tehnic, Welcoming, Producție, … (CI scans grouped by it)
  nume_complet text,                 -- also used to name the uploaded CI scan
  cnp text,
  serie_ci text,
  numar_ci text,
  ci_eliberat_de text,               -- emitent (SPCLEP / poliție)
  ci_valabilitate text,              -- valabil până la (CI în curs de valabilitate)
  ci_path text,                      -- storage key in the private `echipa-ci` bucket

  -- ── persoană juridică (firmă) — date de facturare ──
  nume_firma text,
  cui text,                          -- cod unic de înregistrare
  nr_reg_com text,                   -- nr. de la Registrul Comerțului
  sediu_social text,
  reprezentant text,                 -- reprezentant legal (opțional)

  -- ── comune ambelor tipuri ──
  telefon text not null,
  email text not null,
  cont_bancar text,                  -- IBAN
  banca text,

  acord_gdpr boolean not null default false,

  created_at timestamptz not null default now()
);

-- RLS: public form may INSERT, only authenticated users may READ (admin).
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
