"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Award,
  Building,
  CheckCircle2,
  ChevronDown,
  Globe,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { BrandDots } from "@/components/brand/brand-decor";

const PARTNER_METRICS = [
  { value: "100%", label: "Gratuit et à but non-lucratif", icon: Sparkles, live: true },
  { value: "12", label: "Académies régionales du Royaume", icon: Building },
  { value: "70%", label: "Seuil de maîtrise pour valider", icon: Award },
  { value: "QR Code", label: "Certificat sécurisé et vérifiable", icon: ShieldCheck },
];

export interface RegionalAref {
  id: string;
  name: string;
  arabicName: string;
  category: string;
  zone: "Centre" | "Nord & Est" | "Atlas & Sud" | "Sahara" | "National";
  logoSrc: string;
  fbLogoSrc?: string;
  provinces: string;
  isMinistry?: boolean;
}

export const AREF_PARTNERS: RegionalAref[] = [
  {
    id: "menps",
    name: "Ministère de l'Éducation Nationale",
    arabicName: "وزارة التربية الوطنية والتعليم الأولي والرياضة",
    category: "Royaume du Maroc",
    zone: "National",
    logoSrc: "/brand/partners/menps-officiel-fr.png",
    provinces: "Tutelle nationale • Réseau des 12 académies régionales",
    isMinistry: true,
  },
  {
    id: "casa",
    name: "AREF Casablanca-Settat",
    arabicName: "أكاديمية جهة الدار البيضاء - سطات",
    category: "Académie Régionale",
    zone: "Centre",
    logoSrc: "/brand/partners/aref-casablanca-settat.png",
    fbLogoSrc: "/brand/partners/fb-aref-casablanca.jpg",
    provinces: "Casablanca, Mohammedia, El Jadida, Settat, Berrechid, Benslimane, Sidi Bennour",
  },
  {
    id: "rabat",
    name: "AREF Rabat-Salé-Kénitra",
    arabicName: "أكاديمية جهة الرباط - سلا - القنيطرة",
    category: "Académie Régionale",
    zone: "Centre",
    logoSrc: "/brand/partners/aref-rabat-sale-kenitra.png",
    fbLogoSrc: "/brand/partners/fb-aref-rabat.jpg",
    provinces: "Rabat, Salé, Skhirate-Témara, Kénitra, Khémisset, Sidi Kacem, Sidi Slimane",
  },
  {
    id: "marrakech",
    name: "AREF Marrakech-Safi",
    arabicName: "أكاديمية جهة مراكش - آسفي",
    category: "Académie Régionale",
    zone: "Centre",
    logoSrc: "/brand/partners/aref-marrakech-safi.png",
    fbLogoSrc: "/brand/partners/fb-aref-marrakech.jpg",
    provinces: "Marrakech, Safi, Essaouira, El Kelâa des Sraghna, Chichaoua, Al Haouz, Rehamna, Youssoufia",
  },
  {
    id: "fes",
    name: "AREF Fès-Meknès",
    arabicName: "أكاديمية جهة فاس - مكناس",
    category: "Académie Régionale",
    zone: "Nord & Est",
    logoSrc: "/brand/partners/aref-fes-meknes.png",
    provinces: "Fès, Meknès, Taza, Sefrou, Taounate, El Hajeb, Ifrane, Boulemane, Moulay Yacoub",
  },
  {
    id: "tanger",
    name: "AREF Tanger-Tétouan-Al Hoceïma",
    arabicName: "أكاديمية جهة طنجة - تطوان - الحسيمة",
    category: "Académie Régionale",
    zone: "Nord & Est",
    logoSrc: "/brand/partners/aref-tanger-tetouan-al-hoceima.png",
    fbLogoSrc: "/brand/partners/fb-aref-tanger.jpg",
    provinces: "Tanger-Assilah, Tétouan, M'diq-Fnideq, Larache, Chefchaouen, Al Hoceïma, Ouezzane, Fahs-Anjra",
  },
  {
    id: "souss",
    name: "AREF Souss-Massa",
    arabicName: "أكاديمية جهة سوس - ماسة",
    category: "Académie Régionale",
    zone: "Atlas & Sud",
    logoSrc: "/brand/partners/aref-souss-massa.png",
    provinces: "Agadir Ida-Outanane, Inezgane Aït Melloul, Chtouka Aït Baha, Taroudant, Tiznit, Tata",
  },
  {
    id: "beni_mellal",
    name: "AREF Béni Mellal-Khénifra",
    arabicName: "أكاديمية جهة بني ملال - خنيفرة",
    category: "Académie Régionale",
    zone: "Atlas & Sud",
    logoSrc: "/brand/partners/aref-beni-mellal-khenifra.png",
    provinces: "Béni Mellal, Khouribga, Fquih Ben Salah, Khénifra, Azilal",
  },
  {
    id: "oriental",
    name: "AREF L'Oriental",
    arabicName: "أكاديمية جهة الشرق",
    category: "Académie Régionale",
    zone: "Nord & Est",
    logoSrc: "/brand/partners/aref-oriental.png",
    fbLogoSrc: "/brand/partners/fb-aref-oriental.jpg",
    provinces: "Oujda-Angad, Berkane, Nador, Taourirt, Driouch, Jerada, Guercif, Figuig",
  },
  {
    id: "draa",
    name: "AREF Drâa-Tafilalet",
    arabicName: "أكاديمية جهة درعة - تافيلالت",
    category: "Académie Régionale",
    zone: "Atlas & Sud",
    logoSrc: "/brand/partners/aref-draa-tafilalet.png",
    fbLogoSrc: "/brand/partners/fb-aref-draa.jpg",
    provinces: "Errachidia, Ouarzazate, Tinghir, Zagora, Midelt",
  },
  {
    id: "guelmim",
    name: "AREF Guelmim-Oued Noun",
    arabicName: "أكاديمية جهة كلميم - واد نون",
    category: "Académie Régionale",
    zone: "Sahara",
    logoSrc: "/brand/partners/aref-guelmim-oued-noun.png",
    provinces: "Guelmim, Tan-Tan, Sidi Ifni, Assa-Zag",
  },
  {
    id: "laayoune",
    name: "AREF Laâyoune-Sakia El Hamra",
    arabicName: "أكاديمية جهة العيون - الساقية الحمراء",
    category: "Académie Régionale",
    zone: "Sahara",
    logoSrc: "/brand/partners/aref-laayoune-sakia-el-hamra.png",
    fbLogoSrc: "/brand/partners/fb-aref-laayoune.jpg",
    provinces: "Laâyoune, Boujdour, Tarfaya, Es-Semara",
  },
  {
    id: "dakhla",
    name: "AREF Dakhla-Oued Ed-Dahab",
    arabicName: "أكاديمية جهة الداخلة - وادي الذهب",
    category: "Académie Régionale",
    zone: "Sahara",
    logoSrc: "/brand/partners/aref-dakhla-oued-ed-dahab.png",
    provinces: "Oued Ed-Dahab, Aousserd",
  },
  {
    id: "indh",
    name: "INDH Maroc",
    arabicName: "المبادرة الوطنية للتنمية البشرية",
    category: "Développement Humain",
    zone: "National",
    logoSrc: "/brand/partners/indh-maroc.jpg",
    provinces: "Partenaire national pour l'épanouissement scolaire et l'égalité des chances",
  },
  {
    id: "sanady",
    name: "Fondation SANADY",
    arabicName: "مؤسسة سندي للتعليم والتضامن",
    category: "Utilité Publique",
    zone: "National",
    logoSrc: "/brand/sanady-logo.png",
    provinces: "Plateforme de formation continue et d'appui pédagogique aux enseignants",
  },
];

const INSTITUTIONAL_PARTNERS = [
  {
    name: "Académies Régionales (12 AREF)",
    region: "Casablanca, Rabat, Marrakech, Souss, Fès, Tanger...",
    role: "Partenaires territoriaux officiels pour la diffusion des modules pédagogiques et l'accompagnement des enseignants.",
    tag: "Réseau Public Territorial",
  },
  {
    name: "Ministère de l'Éducation Nationale (MENPS)",
    region: "Cadre Référentiel National",
    role: "Alignement strict avec les orientations curriculaires marocaines et les démarches de la feuille de route 2022-2026.",
    tag: "Conformité Pédagogique",
  },
  {
    name: "Écoles Pionnières & Établissements Partenaires",
    region: "Milieux urbains, périurbains et ruraux",
    role: "Déploiement concret d'outils didactiques innovants et d'évaluations formatives pour la remédiation ciblée.",
    tag: "Impact Écoles du Maroc",
  },
];

export function PartnerTrustBanner() {
  const [showDirectory, setShowDirectory] = useState(false);
  const [selectedZone, setSelectedZone] = useState<string>("Tous");

  const zones = ["Tous", "Centre", "Nord & Est", "Atlas & Sud", "Sahara"];

  const filteredPartners =
    selectedZone === "Tous"
      ? AREF_PARTNERS
      : AREF_PARTNERS.filter((p) => p.zone === selectedZone || p.zone === "National");

  return (
    <section className="relative border-y border-line bg-surface/90 py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <p className="inline-flex items-center gap-2 text-label font-bold uppercase tracking-wider text-accent-700">
            <BrandDots /> Engagement & Réseau National
          </p>
          <h2 className="mt-2 text-[1.5rem] font-extrabold tracking-tight text-ink-900 sm:text-[1.875rem]">
            Une initiative engagée au cœur de l’école marocaine
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-body text-ink-600">
            En synergie avec le Ministère et l&apos;ensemble des 12 Académies Régionales (AREF), pour soutenir le développement professionnel
            des enseignantes et enseignants à travers tout le Royaume.
          </p>
        </div>

        {/* ─── Metrics row with live radar ─────────────────────────────────── */}
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {PARTNER_METRICS.map((m) => (
            <div
              key={m.label}
              className="glow-card group relative flex flex-col items-center rounded-2xl border border-line/80 bg-ink-25/80 p-4 text-center transition duration-300 hover:border-accent-500/40 hover:bg-surface"
            >
              {m.live ? (
                <span className="absolute right-3 top-3">
                  <span className="live-radar" />
                </span>
              ) : null}
              <span className="flex size-10 items-center justify-center rounded-xl bg-accent-50 text-accent-700 transition-transform duration-300 group-hover:scale-110 group-hover:bg-accent-500 group-hover:text-white">
                <m.icon className="size-5" aria-hidden />
              </span>
              <span className="mt-3 text-[1.5rem] font-extrabold tabular tracking-tight text-ink-900">
                {m.value}
              </span>
              <span className="mt-0.5 text-caption font-medium text-ink-600">
                {m.label}
              </span>
            </div>
          ))}
        </div>

        {/* ─── Pluralsight-style Animated Institutional Logo Ticker ───────── */}
        <div className="mt-10">
          <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
            <p className="text-caption font-bold uppercase tracking-widest text-ink-400">
              Logos officiels des 12 Académies Régionales (AREF) & Partenaires
            </p>
            <button
              type="button"
              onClick={() => setShowDirectory(!showDirectory)}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold text-accent-700 transition hover:border-accent-500 hover:bg-accent-50"
            >
              <Globe className="size-3.5" aria-hidden />
              {showDirectory ? "Masquer l'annuaire" : "Explorer les 12 académies"}
              <ChevronDown
                className={`size-3.5 transition-transform duration-200 ${
                  showDirectory ? "rotate-180" : ""
                }`}
                aria-hidden
              />
            </button>
          </div>

          {/* Continuous scrolling marquee with mask */}
          <div className="mt-4 overflow-hidden rounded-2xl border border-line/80 bg-gradient-to-r from-ink-25/50 via-surface to-ink-25/50 py-5 relative [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]">
            <div className="flex w-max items-center gap-5 animate-marquee hover:[animation-play-state:paused]">
              {[...AREF_PARTNERS, ...AREF_PARTNERS].map((p, idx) => (
                <div
                  key={`${p.id}-${idx}`}
                  className="glow-card group flex items-center gap-3.5 rounded-2xl border border-line/90 bg-surface/95 px-4 py-2.5 shadow-2xs backdrop-blur-sm transition duration-300 hover:-translate-y-0.5 hover:border-accent-500/50 hover:bg-surface hover:shadow-md"
                >
                  {/* Real official logo badge */}
                  <div className="relative flex h-10 w-24 shrink-0 items-center justify-center rounded-xl bg-white p-1 ring-1 ring-ink-100/80 transition duration-300 group-hover:scale-105 group-hover:ring-accent-500/40">
                    <Image
                      src={p.logoSrc}
                      alt={p.name}
                      width={120}
                      height={40}
                      className="max-h-8 w-auto max-w-full object-contain"
                      unoptimized
                    />
                    {/* Facebook badge indicator if distinct profile avatar exists */}
                    {p.fbLogoSrc ? (
                      <span
                        className="absolute -bottom-1 -right-1 size-3.5 overflow-hidden rounded-full border-2 border-white bg-blue-600 shadow-xs"
                        title="Logo Facebook officiel vérifié"
                      >
                        <Image
                          src={p.fbLogoSrc}
                          alt=""
                          width={14}
                          height={14}
                          className="size-full object-cover"
                          unoptimized
                        />
                      </span>
                    ) : null}
                  </div>

                  <div className="text-left">
                    <div className="flex items-center gap-1.5">
                      <span className="block text-card font-bold tracking-tight text-ink-900 transition-colors group-hover:text-accent-800">
                        {p.name}
                      </span>
                      <span
                        className="size-1.5 rounded-full bg-emerald-500"
                        title="Académie certifiée"
                      />
                    </div>
                    <span className="block text-[0.6875rem] font-medium text-ink-500" dir="rtl">
                      {p.arabicName}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ─── Expandable 12 Regional Academies Directory (Pluralsight Style) ─── */}
        {showDirectory ? (
          <div className="mt-8 rounded-3xl border border-line/80 bg-surface p-6 shadow-sm transition-all duration-300">
            <div className="flex flex-col items-start justify-between gap-4 border-b border-line/80 pb-5 sm:flex-row sm:items-center">
              <div>
                <h3 className="text-lg font-bold text-ink-900">
                  Répertoire officiel des Académies Régionales d&apos;Éducation et de Formation
                </h3>
                <p className="mt-1 text-xs text-ink-500">
                  Logos officiels du Ministère et des 12 directions régionales à travers les 12 régions du Royaume.
                </p>
              </div>

              {/* Filter tabs */}
              <div className="flex flex-wrap gap-1.5">
                {zones.map((z) => (
                  <button
                    key={z}
                    type="button"
                    onClick={() => setSelectedZone(z)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      selectedZone === z
                        ? "bg-accent-600 text-white shadow-2xs"
                        : "bg-ink-50 text-ink-600 hover:bg-ink-100"
                    }`}
                  >
                    {z}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredPartners.map((item) => (
                <div
                  key={item.id}
                  className="group relative flex flex-col justify-between rounded-2xl border border-line/70 bg-ink-25/50 p-4 transition duration-200 hover:border-accent-500/40 hover:bg-surface hover:shadow-xs"
                >
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex h-12 w-32 items-center justify-center rounded-xl bg-white p-1.5 shadow-2xs ring-1 ring-ink-100">
                        <Image
                          src={item.logoSrc}
                          alt={item.name}
                          width={140}
                          height={48}
                          className="max-h-9 w-auto max-w-full object-contain"
                          unoptimized
                        />
                      </div>

                      {item.fbLogoSrc ? (
                        <div
                          className="flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[0.625rem] font-bold text-blue-700"
                          title="Logo de la page Facebook officielle"
                        >
                          <div className="size-3.5 overflow-hidden rounded-full ring-1 ring-blue-300">
                            <Image
                              src={item.fbLogoSrc}
                              alt="FB"
                              width={14}
                              height={14}
                              className="size-full object-cover"
                              unoptimized
                            />
                          </div>
                          <span>FB Officiel</span>
                        </div>
                      ) : (
                        <span className="rounded-full bg-accent-50 px-2 py-0.5 text-[0.625rem] font-bold text-accent-700">
                          {item.zone}
                        </span>
                      )}
                    </div>

                    <h4 className="mt-3.5 text-sm font-bold text-ink-900 group-hover:text-accent-800">
                      {item.name}
                    </h4>
                    <p className="mt-0.5 text-xs font-medium text-ink-500" dir="rtl">
                      {item.arabicName}
                    </p>
                    <p className="mt-2 text-[0.6875rem] leading-relaxed text-ink-600">
                      <span className="font-semibold text-ink-700">Territoire: </span>
                      {item.provinces}
                    </p>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-line/60 pt-2.5 text-[0.6875rem] text-ink-400">
                    <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                      <CheckCircle2 className="size-3" aria-hidden />
                      Partenaire officiel
                    </span>
                    <span className="font-mono text-ink-400">{item.category}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* ─── Institutional Ecosystem Cards ─────────────────────────────── */}
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {INSTITUTIONAL_PARTNERS.map((p) => (
            <div
              key={p.name}
              className="card-shine glow-card rounded-2xl border border-line bg-surface p-5 shadow-xs transition duration-300 hover:-translate-y-1 hover:border-accent-500/40 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-accent-50 px-2.5 py-0.5 text-caption font-semibold text-accent-800">
                  {p.tag}
                </span>
                <CheckCircle2 className="size-4 text-success-600" aria-hidden />
              </div>
              <h3 className="mt-3 text-card font-bold text-ink-900">{p.name}</h3>
              <p className="mt-1 text-label font-medium text-accent-700">{p.region}</p>
              <p className="mt-2 text-caption leading-relaxed text-ink-500">{p.role}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
