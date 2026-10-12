import {
  Award,
  BookOpen,
  Building2,
  ClipboardCheck,
  Clock,
  FileText,
  Gift,
  type LucideIcon,
  MessageSquareText,
  MonitorSmartphone,
  PlayCircle,
  QrCode,
  ShieldCheck,
} from "lucide-react";

type Item = { icon: LucideIcon; label: string };

/** Only what the platform actually does today. */
const ROW_A: Item[] = [
  { icon: PlayCircle, label: "Vidéos courtes" },
  { icon: FileText, label: "Fiches à télécharger" },
  { icon: ClipboardCheck, label: "Évaluation à chaque module" },
  { icon: MessageSquareText, label: "Explication après chaque réponse" },
  { icon: QrCode, label: "Certificat vérifiable par QR code" },
  { icon: BookOpen, label: "Bibliothèque pédagogique" },
];
const ROW_B: Item[] = [
  { icon: MonitorSmartphone, label: "Téléphone, tablette, ordinateur" },
  { icon: Clock, label: "À votre rythme" },
  { icon: Gift, label: "100 % gratuit" },
  { icon: Award, label: "Progression enregistrée" },
  { icon: Building2, label: "Suivi pour les établissements" },
  { icon: ShieldCheck, label: "Données protégées" },
];

function Row({ items, reverse }: { items: Item[]; reverse?: boolean }) {
  const pills = (hidden: boolean) =>
    items.map((it) => (
      <li
        key={it.label + hidden}
        aria-hidden={hidden || undefined}
        className="flex shrink-0 items-center gap-2.5 rounded-full border border-line bg-surface px-5 py-2.5 text-body font-semibold text-ink-800 shadow-xs"
      >
        <it.icon className="size-4.5 text-accent-700" aria-hidden />
        {it.label}
      </li>
    ));
  return (
    <div className="marquee-mask overflow-hidden">
      {/* Two identical halves: translating by -50 % loops seamlessly. */}
      <ul className={reverse ? "marquee-track marquee-reverse" : "marquee-track"}>
        {pills(false)}
        {pills(true)}
      </ul>
    </div>
  );
}

/**
 * Edraak-style band of two ribbons moving in opposite directions.
 * Pauses on hover; with reduced motion the pills simply wrap, centred.
 */
export function FeaturesMarquee() {
  return (
    <section aria-labelledby="atouts" className="overflow-hidden bg-ink-25 py-14 sm:py-16">
      <div className="mx-auto max-w-3xl px-4 text-center">
        <p className="text-label font-bold uppercase tracking-wider text-accent-700">Apprendre gratuitement</p>
        <h2 id="atouts" className="mt-2 text-[1.625rem] font-extrabold leading-tight tracking-tight text-ink-900 sm:text-[1.875rem]">
          Tout ce qu’il faut pour progresser, sans frais
        </h2>
      </div>
      <div className="mt-8 space-y-4">
        <Row items={ROW_A} />
        <Row items={ROW_B} reverse />
      </div>
    </section>
  );
}
