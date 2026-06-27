-- License plate for team members who come by car (persoană fizică). Optional,
-- nullable, additive — safe to run on an already-populated table.
alter table public.echipa_contracte
  add column if not exists nr_inmatriculare text;
