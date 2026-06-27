import { useMemo, useState } from "react";
import { Plus, AlertCircle, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { supabase, ECHIPA_CI_BUCKET } from "@/lib/supabase";
import { LegalDialog } from "@/components/LegalDialog";
import termeniMd from "@/content/termeni.md?raw";
import confidentialitateMd from "@/content/confidentialitate.md?raw";
import etichetaLogo from "@/assets/eticheta-ideoideis.png";
import echipaPhoto from "@/assets/echipa-ideoideis.jpg";

const REQUIRED = "câmp obligatoriu";

// Normalize a name into a safe storage key: strip diacritics and anything that
// isn't a letter/number/space/_/-, so "Ștefan Popa" → "Stefan Popa".
const safeName = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9 _-]+/g, "")
    .replace(/\s+/g, " ")
    .trim();

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

type Tip = "" | "fizica" | "juridica";

// Departamentele echipei ideo ideis. CI-urile se organizează pe departament în
// bucket-ul privat `echipa-ci`: "echipa-ci/<Departament>/<Nume>.<ext>".
const DEPARTMENTS = [
  "Directori",
  "Artistic",
  "Comunicare",
  "Foto",
  "Video",
  "Welcoming",
  "Tehnic",
  "Producție",
  "Financiar",
] as const;

export default function Index() {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  // Becomes true after the first blocked submit; then errors show live and
  // clear as each field is filled in.
  const [showErrors, setShowErrors] = useState(false);

  const [tip, setTip] = useState<Tip>("");

  // ── comune ──
  const [telefon, setTelefon] = useState("");
  const [email, setEmail] = useState("");
  const [contBancar, setContBancar] = useState("");
  const [banca, setBanca] = useState("");

  // ── persoană fizică ──
  const [department, setDepartment] = useState("");
  const [numeComplet, setNumeComplet] = useState("");
  const [cnp, setCnp] = useState("");
  const [serieCi, setSerieCi] = useState("");
  const [numarCi, setNumarCi] = useState("");
  const [ciEliberatDe, setCiEliberatDe] = useState("");
  const [ciValabilitate, setCiValabilitate] = useState("");
  const [ciFile, setCiFile] = useState<File | null>(null);
  const [nrInmatriculare, setNrInmatriculare] = useState("");

  // ── persoană juridică (firmă) ──
  const [numeFirma, setNumeFirma] = useState("");
  const [cui, setCui] = useState("");
  const [nrRegCom, setNrRegCom] = useState("");
  const [sediuSocial, setSediuSocial] = useState("");
  const [reprezentant, setReprezentant] = useState("");

  const [acord, setAcord] = useState(false);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    const has = (v: string) => v.trim().length > 0;

    if (!tip) e.tip = REQUIRED;

    if (tip === "fizica") {
      if (!has(department)) e.department = REQUIRED;
      if (!has(numeComplet)) e.numeComplet = REQUIRED;
      if (!has(cnp)) e.cnp = REQUIRED;
      if (!has(serieCi)) e.serieCi = REQUIRED;
      if (!has(numarCi)) e.numarCi = REQUIRED;
      if (!has(ciValabilitate)) e.ciValabilitate = REQUIRED;
      if (!ciFile) e.ciFile = "atașează poza CI-ului";
      if (!has(contBancar)) e.contBancar = REQUIRED;
      if (!has(banca)) e.banca = REQUIRED;
    } else if (tip === "juridica") {
      if (!has(numeFirma)) e.numeFirma = REQUIRED;
      if (!has(cui)) e.cui = REQUIRED;
      if (!has(nrRegCom)) e.nrRegCom = REQUIRED;
      if (!has(sediuSocial)) e.sediuSocial = REQUIRED;
      if (!has(contBancar)) e.contBancar = REQUIRED;
      if (!has(banca)) e.banca = REQUIRED;
    }

    if (tip) {
      if (!has(telefon)) e.telefon = REQUIRED;
      if (!has(email)) e.email = REQUIRED;
      else if (!isEmail(email)) e.email = "adresă de e-mail invalidă";
      if (!acord) e.acord = "trebuie să fii de acord pentru a trimite";
    }

    return e;
  }, [
    tip, telefon, email, contBancar, banca,
    department, numeComplet, cnp, serieCi, numarCi, ciValabilitate, ciFile,
    numeFirma, cui, nrRegCom, sediuSocial, acord,
  ]);

  const fieldError = (id: string) => (showErrors ? errors[id] : undefined);

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setShowErrors(true);

    const missing = Object.keys(errors);
    if (missing.length > 0) {
      // Scroll to the first field with an error.
      const first = document.getElementById(`field-${missing[0]}`);
      first?.scrollIntoView({ behavior: "smooth", block: "center" });
      toast.error(
        missing.length === 1
          ? "A mai rămas un câmp obligatoriu de completat."
          : `Au mai rămas ${missing.length} câmpuri de completat.`,
        { description: "Câmpurile lipsă sunt evidențiate cu roșu mai jos." }
      );
      return;
    }

    if (!supabase) {
      toast.error("Supabase neconfigurat. Lipsesc cheile din .env.");
      return;
    }

    // Validation above guarantees a type is selected; narrow it for the rest.
    if (tip !== "fizica" && tip !== "juridica") return;

    setSubmitting(true);
    try {
      // Upload the CI scan into the PRIVATE `echipa-ci` bucket, organised per
      // department and named after the person:
      //   "echipa-ci/<Departament>/<nume complet>.<ext>".
      // The bucket is INSERT-only for the public form (no overwrite), so on a
      // name clash we fall back to "name (2)", "name (3)", … instead of
      // overwriting or failing.
      let ci_path: string | null = null;
      if (tip === "fizica" && ciFile) {
        const folder = safeName(department) || "fara-departament";
        const base = safeName(numeComplet) || "ci";
        const ext = ciFile.name.split(".").pop()?.toLowerCase() ?? "jpg";
        for (let n = 1; n < 50; n++) {
          const name = n === 1 ? `${base}.${ext}` : `${base} (${n}).${ext}`;
          const key = `${folder}/${name}`;
          const { error: upErr } = await supabase.storage
            .from(ECHIPA_CI_BUCKET)
            .upload(key, ciFile, { contentType: ciFile.type, upsert: false });
          if (!upErr) {
            ci_path = key;
            break;
          }
          const status = String((upErr as { statusCode?: string }).statusCode ?? "");
          if (status !== "409" && !/exist/i.test(upErr.message)) throw upErr;
        }
        if (!ci_path) throw new Error("Nu am putut încărca poza CI-ului. Încearcă din nou.");
      }

      const row: Record<string, string | boolean | null> =
        tip === "fizica"
          ? {
              tip,
              department,
              nume_complet: numeComplet,
              cnp,
              serie_ci: serieCi,
              numar_ci: numarCi,
              ci_eliberat_de: ciEliberatDe || null,
              ci_valabilitate: ciValabilitate,
              ci_path,
              nr_inmatriculare: nrInmatriculare || null,
              telefon,
              email,
              cont_bancar: contBancar,
              banca,
              acord_gdpr: acord,
            }
          : {
              tip,
              nume_firma: numeFirma,
              cui,
              nr_reg_com: nrRegCom,
              sediu_social: sediuSocial,
              reprezentant: reprezentant || null,
              nr_inmatriculare: nrInmatriculare || null,
              telefon,
              email,
              cont_bancar: contBancar,
              banca,
              acord_gdpr: acord,
            };

      const { error } = await supabase.from("echipa_contracte").insert(row);
      if (error) throw error;

      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
      toast.success("Mulțumim! Datele au fost trimise.");
    } catch (err) {
      console.error("[echipa_contracte] submit failed", err);
      // Supabase errors are plain objects (not Error instances), so pull the
      // real message out instead of rendering a useless "[object Object]".
      const description =
        err instanceof Error
          ? err.message
          : err && typeof err === "object" && "message" in err
          ? String((err as { message?: unknown }).message)
          : JSON.stringify(err);
      toast.error("A apărut o eroare la trimitere.", { description });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    // Little hearts that drift up behind the message. Fixed positions so the
    // animation is deterministic (no Math.random).
    const hearts = [
      { left: "8%", delay: 0, size: "2rem", dur: 5.5 },
      { left: "22%", delay: 1.2, size: "1.25rem", dur: 6.5 },
      { left: "38%", delay: 0.6, size: "1.6rem", dur: 5 },
      { left: "60%", delay: 1.8, size: "1.25rem", dur: 6 },
      { left: "74%", delay: 0.3, size: "2.2rem", dur: 5.8 },
      { left: "88%", delay: 2.1, size: "1.5rem", dur: 6.8 },
    ];
    return (
      <main className="relative min-h-screen overflow-hidden bg-primary text-primary-foreground flex items-center justify-center px-6 py-24">
        {hearts.map((h, i) => (
          <motion.span
            key={i}
            aria-hidden
            className="pointer-events-none absolute bottom-0 select-none opacity-30"
            style={{ left: h.left, fontSize: h.size }}
            initial={{ y: "10vh", opacity: 0 }}
            animate={{ y: "-95vh", opacity: [0, 0.45, 0] }}
            transition={{ duration: h.dur, delay: h.delay, repeat: Infinity, ease: "easeInOut" }}
          >
            ❤️
          </motion.span>
        ))}

        <motion.div
          initial={{ scale: 0.85, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 16 }}
          className="relative text-center max-w-xl"
        >
          {/* Framed team photo — white "polaroid" box that gently floats, with a
              little 🎉 badge tucked in the corner. */}
          <motion.figure
            className="relative mx-auto mb-9 w-full max-w-md bg-white p-3 pb-4 shadow-2xl"
            animate={{ y: [0, -9, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          >
            <img src={echipaPhoto} alt="Echipa ideo ideis" className="w-full h-auto" />
            <figcaption className="mt-3 text-xs font-medium uppercase tracking-[0.15em] text-primary">
              echipa ideo ideis
            </figcaption>
            <motion.span
              aria-hidden
              className="absolute -right-4 -top-5 text-4xl md:text-5xl leading-none"
              animate={{ scale: [1, 1.2, 1], rotate: [0, -10, 10, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 0.7 }}
            >
              🎉
            </motion.span>
          </motion.figure>

          <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
            Gata, te-am notat!
          </h1>
          <span className="red-line mx-auto mt-6 w-24" style={{ background: "white" }} />
          <p className="mt-8 text-base md:text-lg leading-relaxed opacity-95">
            Datele tale au ajuns cu bine la noi și le folosim doar pentru
            contracte și plăți. Acum poți să te întorci la treburile importante.
            Festivalul nu se face singur. 💪
          </p>
          <p className="mt-7 text-lg md:text-xl font-bold">
            Te pupăm,
            <br />
            echipa ideo ideis ❤️
          </p>

          {/* Reminder: formularul de scenografie (Steff pregătește o surpriză) */}
          <div className="mt-10 border-t border-white/25 pt-7">
            <p className="text-sm md:text-base leading-relaxed opacity-95">
              P.S. Ai completat deja formularul de <strong>scenografie</strong>?
              Steff pregătește o surpriză drăguță pentru toți. Dacă încă nu l-ai
              completat:
            </p>
            <a
              href="https://forms.gle/u2d8Nv8GnX7ns1w17"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "mt-4 inline-flex items-center gap-2 px-5 py-2.5",
                "bg-white text-primary hover:bg-white/90 transition-colors text-sm font-medium"
              )}
            >
              <ExternalLink className="size-4" />
              formularul de scenografie
            </a>
          </div>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-primary text-primary-foreground">
      <div className="max-w-7xl mx-auto px-6 md:px-10 pb-16 md:pb-24">
        {/* Eticheta: logo ideo ideis */}
        <div className="mb-12 inline-block bg-white p-3 md:p-4">
          <img
            src={etichetaLogo}
            alt="ideo ideis"
            className="h-16 w-auto md:h-20"
          />
        </div>

        {/* Hero / intro */}
        <header>
          <span className="micro-label">echipa ideo ideis #21</span>
          <h1 className="mt-3 text-5xl md:text-7xl font-bold tracking-tight leading-[0.95]">
            date pentru
            <br />
            contracte
          </h1>
          <div className="mt-10 space-y-4 max-w-2xl text-base md:text-lg leading-relaxed">
            <p>
              Salut, <strong>echipă</strong>! Pentru a putea încheia contractele
              și a face plățile fără întârzieri, avem nevoie de câteva date de la
              fiecare membru al echipei și de la firmele cu care colaborăm.
            </p>
            <p>
              Te rugăm să verifici că tot ce completezi este corect și complet
              și să folosești diacritice acolo unde este cazul. Documentele de
              identitate trebuie să fie <strong>în curs de valabilitate</strong>.
            </p>
            <p>Mulțumim!</p>
          </div>
        </header>

        {/* Form card */}
        <form
          onSubmit={handleSubmit}
          noValidate
          className="mt-12 bg-background text-foreground p-8 md:p-14 space-y-12"
        >
          <Field id="tip" label="persoană fizică / firmă?" required error={fieldError("tip")}>
            <Select value={tip} onValueChange={(v) => setTip(v as Tip)} required>
              <SelectTrigger>
                <SelectValue placeholder="…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fizica">persoană fizică</SelectItem>
                <SelectItem value="juridica">firmă (persoană juridică)</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          {/* ───────── persoană fizică ───────── */}
          {tip === "fizica" && (
            <div className="space-y-12">
              <section className="space-y-8">
                <h2 className="text-3xl md:text-4xl font-bold text-primary lowercase">
                  date personale
                </h2>

                <Field
                  id="department"
                  label="departament"
                  required
                  error={fieldError("department")}
                >
                  <Select value={department} onValueChange={setDepartment} required>
                    <SelectTrigger>
                      <SelectValue placeholder="alege departamentul" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field id="numeComplet" label="nume complet" required error={fieldError("numeComplet")}>
                  <Input
                    value={numeComplet}
                    onChange={(e) => setNumeComplet(e.target.value)}
                    placeholder="Prenume Nume"
                    required
                  />
                </Field>

                <Field id="cnp" label="CNP" required error={fieldError("cnp")}>
                  <Input
                    inputMode="numeric"
                    value={cnp}
                    onChange={(e) => setCnp(e.target.value)}
                    placeholder="…"
                    required
                  />
                </Field>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <Field id="serieCi" label="serie CI" required error={fieldError("serieCi")}>
                    <Input
                      value={serieCi}
                      onChange={(e) => setSerieCi(e.target.value)}
                      placeholder="ex. TR"
                      required
                    />
                  </Field>
                  <Field id="numarCi" label="număr CI" required error={fieldError("numarCi")}>
                    <Input
                      inputMode="numeric"
                      value={numarCi}
                      onChange={(e) => setNumarCi(e.target.value)}
                      placeholder="ex. 123456"
                      required
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <Field id="ciEliberatDe" label="eliberat de" helper="opțional (SPCLEP / poliție)">
                    <Input
                      value={ciEliberatDe}
                      onChange={(e) => setCiEliberatDe(e.target.value)}
                      placeholder="…"
                    />
                  </Field>
                  <Field
                    id="ciValabilitate"
                    label="valabil până la"
                    required
                    helper="CI-ul trebuie să fie în curs de valabilitate"
                    error={fieldError("ciValabilitate")}
                  >
                    <Input
                      value={ciValabilitate}
                      onChange={(e) => setCiValabilitate(e.target.value)}
                      placeholder="ZZ.LL.AAAA"
                      required
                    />
                  </Field>
                </div>

                <Field
                  id="ciFile"
                  label="poză / scan CI"
                  required
                  helper="format: jpg, jpeg, png, pdf"
                  error={fieldError("ciFile")}
                >
                  <label
                    className={cn(
                      "inline-flex items-center gap-2 px-4 py-2 cursor-pointer",
                      "bg-primary text-primary-foreground hover:bg-primary/90 transition-colors",
                      "text-sm font-medium"
                    )}
                  >
                    <Plus className="size-4" />
                    {ciFile ? ciFile.name : "alege un fișier"}
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                      className="hidden"
                      onChange={(e) => setCiFile(e.target.files?.[0] ?? null)}
                      required={!ciFile}
                    />
                  </label>
                </Field>
              </section>

              <ContactBancarSection
                telefon={telefon}
                setTelefon={setTelefon}
                email={email}
                setEmail={setEmail}
                contBancar={contBancar}
                setContBancar={setContBancar}
                banca={banca}
                setBanca={setBanca}
                fieldError={fieldError}
              />
            </div>
          )}

          {/* ───────── firmă ───────── */}
          {tip === "juridica" && (
            <div className="space-y-12">
              <section className="space-y-8">
                <h2 className="text-3xl md:text-4xl font-bold text-primary lowercase">
                  date de facturare
                </h2>

                <Field id="numeFirma" label="denumire firmă" required error={fieldError("numeFirma")}>
                  <Input
                    value={numeFirma}
                    onChange={(e) => setNumeFirma(e.target.value)}
                    placeholder="ex. Exemplu SRL"
                    required
                  />
                </Field>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <Field id="cui" label="CUI / CIF" required error={fieldError("cui")}>
                    <Input
                      value={cui}
                      onChange={(e) => setCui(e.target.value)}
                      placeholder="ex. RO12345678"
                      required
                    />
                  </Field>
                  <Field id="nrRegCom" label="nr. Registrul Comerțului" required error={fieldError("nrRegCom")}>
                    <Input
                      value={nrRegCom}
                      onChange={(e) => setNrRegCom(e.target.value)}
                      placeholder="ex. J40/1234/2020"
                      required
                    />
                  </Field>
                </div>

                <Field id="sediuSocial" label="sediu social" required error={fieldError("sediuSocial")}>
                  <Input
                    value={sediuSocial}
                    onChange={(e) => setSediuSocial(e.target.value)}
                    placeholder="adresa completă"
                    required
                  />
                </Field>

                <Field id="reprezentant" label="reprezentant legal" helper="opțional">
                  <Input
                    value={reprezentant}
                    onChange={(e) => setReprezentant(e.target.value)}
                    placeholder="Prenume Nume"
                  />
                </Field>
              </section>

              <ContactBancarSection
                telefon={telefon}
                setTelefon={setTelefon}
                email={email}
                setEmail={setEmail}
                contBancar={contBancar}
                setContBancar={setContBancar}
                banca={banca}
                setBanca={setBanca}
                fieldError={fieldError}
              />
            </div>
          )}

          {/* ───────── cazare + transport (pentru ambele tipuri) ───────── */}
          {tip && (
            <div className="space-y-12">
              {/* ───────── vii cu mașina? ───────── */}
              <section className="space-y-8">
                <h2 className="text-3xl md:text-4xl font-bold text-primary lowercase">
                  vii cu mașina?
                </h2>
                <Field
                  id="nrInmatriculare"
                  label="nr. de înmatriculare"
                  helper="opțional, completează doar dacă vii cu mașina"
                >
                  <Input
                    value={nrInmatriculare}
                    onChange={(e) => setNrInmatriculare(e.target.value)}
                    placeholder="ex. B 123 ABC"
                  />
                </Field>
              </section>

              {/* ───────── cazare ───────── */}
              <section className="space-y-5 border-l-2 border-primary pl-6">
                <h2 className="text-3xl md:text-4xl font-bold text-primary lowercase">
                  cazare
                </h2>
                <p className="text-sm md:text-base leading-relaxed text-foreground/90">
                  Ai nevoie de cazare? Ai completat deja schema de cazare pentru
                  White House?
                </p>
                <a
                  href="https://docs.google.com/spreadsheets/d/19KV4fMSG7dAenh3xwirwMBMas8C9SX5_MduH1rPE5I4/edit?gid=0#gid=0"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "inline-flex items-center gap-2 px-4 py-2",
                    "bg-primary text-primary-foreground hover:bg-primary/90 transition-colors",
                    "text-sm font-medium"
                  )}
                >
                  <ExternalLink className="size-4" />
                  schema de cazare White House
                </a>
                <p className="text-xs italic text-muted-foreground leading-relaxed">
                  Reminder: deși în formularul ăsta vrem să îți trimitem bani, nu
                  prea stăm bine cu ei și încercăm să ocupăm toate spațiile de
                  cazare oferite de White.
                </p>
              </section>
            </div>
          )}

          {/* ───────── acord GDPR + submit ───────── */}
          {tip && (
            <section className="space-y-8 border-t border-border pt-10">
              <div
                id="field-acord"
                className={cn(
                  "scroll-mt-24 flex items-start gap-3",
                  fieldError("acord") && "text-destructive"
                )}
              >
                <Checkbox
                  id="acord"
                  checked={acord}
                  onCheckedChange={(c) => setAcord(c === true)}
                  className="mt-1"
                />
                <Label htmlFor="acord" className="text-sm font-normal leading-relaxed cursor-pointer">
                  Sunt de acord cu prelucrarea datelor cu caracter personal în
                  scopul întocmirii contractelor și a plăților și am citit{" "}
                  <LegalDialog
                    trigger={
                      <button type="button" className="text-primary underline">
                        politica de confidențialitate
                      </button>
                    }
                    title="politica de confidențialitate"
                    content={confidentialitateMd}
                  />{" "}
                  și{" "}
                  <LegalDialog
                    trigger={
                      <button type="button" className="text-primary underline">
                        termenii și condițiile
                      </button>
                    }
                    title="termeni și condiții"
                    content={termeniMd}
                  />
                  . *
                </Label>
              </div>
              {fieldError("acord") && (
                <p className="-mt-4 text-xs font-medium text-destructive">{fieldError("acord")}</p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className={cn(
                  "inline-flex items-center justify-center gap-2 px-8 py-3 w-full sm:w-auto",
                  "bg-primary text-primary-foreground hover:bg-primary/90 transition-colors",
                  "text-base font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                )}
              >
                {submitting ? "se trimite…" : "trimite datele"}
              </button>

              {showErrors && Object.keys(errors).length > 0 && (
                <p className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="size-4 shrink-0" />
                  Verifică câmpurile evidențiate mai sus.
                </p>
              )}
            </section>
          )}
        </form>
      </div>
    </main>
  );
}

// Shared contact + bank-account block (identical for both person types).
function ContactBancarSection({
  telefon, setTelefon,
  email, setEmail,
  contBancar, setContBancar,
  banca, setBanca,
  fieldError,
}: {
  telefon: string; setTelefon: (v: string) => void;
  email: string; setEmail: (v: string) => void;
  contBancar: string; setContBancar: (v: string) => void;
  banca: string; setBanca: (v: string) => void;
  fieldError: (id: string) => string | undefined;
}) {
  return (
    <>
      <section className="space-y-8">
        <h2 className="text-3xl md:text-4xl font-bold text-primary lowercase">
          cont bancar
        </h2>
        <Field id="contBancar" label="IBAN" required helper="contul în care se vor face plățile" error={fieldError("contBancar")}>
          <Input
            value={contBancar}
            onChange={(e) => setContBancar(e.target.value)}
            placeholder="RO00 BANK 0000 0000 0000 0000"
            required
          />
        </Field>
        <Field id="banca" label="banca" required error={fieldError("banca")}>
          <Input
            value={banca}
            onChange={(e) => setBanca(e.target.value)}
            placeholder="ex. Banca Transilvania"
            required
          />
        </Field>
      </section>

      <section className="space-y-8">
        <h2 className="text-3xl md:text-4xl font-bold text-primary lowercase">
          contact
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Field id="telefon" label="nr. telefon" required error={fieldError("telefon")}>
            <Input
              type="tel"
              value={telefon}
              onChange={(e) => setTelefon(e.target.value)}
              placeholder="07…"
              required
            />
          </Field>
          <Field id="email" label="e-mail" required error={fieldError("email")}>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nume@exemplu.ro"
              required
            />
          </Field>
        </div>
      </section>
    </>
  );
}

function Field({
  id,
  label,
  required,
  helper,
  error,
  children,
}: {
  id?: string;
  label: string;
  required?: boolean;
  helper?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div id={id ? `field-${id}` : undefined} className="scroll-mt-24">
      <Label
        className={cn(
          "text-sm font-normal lowercase",
          error && "text-destructive font-medium"
        )}
      >
        {label} {required && "*"}
      </Label>
      <div
        className={cn(
          "mt-2",
          error &&
            "rounded-md ring-2 ring-destructive ring-offset-2 ring-offset-background"
        )}
      >
        {children}
      </div>
      {error ? (
        <p className="mt-2 text-xs font-medium text-destructive">{error}</p>
      ) : helper ? (
        <p className="mt-2 text-xs italic text-muted-foreground">{helper}</p>
      ) : null}
    </div>
  );
}
