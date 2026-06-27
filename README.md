# info contracte — echipa ideo ideis

Formular intern pentru colectarea datelor necesare întocmirii contractelor și a
plăților, pentru echipa **ideo ideis**:

- **persoane fizice (membri echipă):** date personale, document de identitate
  (CI în curs de valabilitate, încărcat ca poză/scan) și cont bancar (IBAN);
- **firme (persoane juridice):** date de facturare (denumire, CUI, nr. Reg.
  Comerțului, sediu social), cont bancar, telefon și e-mail.

Construit cu Vite + React + TypeScript + Tailwind, cu stocare în Supabase.

## Dezvoltare locală

```bash
npm install
npm run dev      # http://localhost:8080
```

Variabilele de mediu (Supabase) sunt în `.env` (vezi `.env.example`). Cheia
folosită în browser este cea **publishable** (anon); datele sunt protejate prin
Row Level Security.

## Build

```bash
npm run build    # output în dist/
npm run preview  # servește build-ul de producție local
```

## Deploy — GitHub Pages

Deploy automat prin GitHub Actions ([.github/workflows/deploy.yml](.github/workflows/deploy.yml))
la fiecare push pe `main`. Site-ul live:

**https://ideoideis.github.io/info-contracte/**

În producție, `base` este `/info-contracte/` (vezi `vite.config.ts`), iar valorile
publice de Supabase sunt în `.env.production`.

## Bază de date (Supabase)

Migrațiile sunt în [`supabase/migrations/`](supabase/migrations):

- `001_echipa_contracte.sql` — tabelul `echipa_contracte` + politici RLS
  (oricine poate insera prin formular, doar utilizatorii autentificați pot citi);
- `002_echipa_ci_bucket.sql` — bucket **privat** `echipa-ci` pentru pozele CI.

Pozele de CI sunt **private** (nu sunt accesibile public) și sunt denumite după
persoană, ex. `Andrei Popescu.jpg`. Se vizualizează prin URL-uri semnate
temporar (`createSignedUrl`) doar de către utilizatori autentificați.
