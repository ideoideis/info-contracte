-- Department of the team member (persoană fizică). CI scans are organised per
-- department in the private `echipa-ci` bucket: "<Departament>/<Nume>.<ext>".
-- Additive + nullable, so it is safe to run on an already-populated table.
alter table public.echipa_contracte
  add column if not exists department text;
