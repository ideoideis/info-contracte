# Supabase — info-contracte

This project uses the **same** Supabase project as `info-trupe-21` /
`a-moment-of-trust`, but its own table and storage bucket (no collisions).

## Apply migrations

Open the Supabase SQL Editor for project
`https://waqyaewaldphstmiobjj.supabase.co` and run, in order:

1. `migrations/001_echipa_contracte.sql` — creates the `echipa_contracte` table + RLS policies.
2. `migrations/002_echipa_ci_bucket.sql` — creates the **private** `echipa-ci` storage bucket + policies.

Or, with the Supabase CLI linked to the project:

```bash
supabase db push
```

## Storage layout

CI scans (persoane fizice) go into the private `echipa-ci` bucket, named after
the person — e.g. `Andrei Popescu.jpg`. The bucket is **not** public: the form
may upload (anon insert), but reading requires auth and a short-lived signed URL
(`supabase.storage.from('echipa-ci').createSignedUrl(path, 60)`).

## Environment variables

See `.env.example`. Already wired in `.env` with the publishable anon key.
