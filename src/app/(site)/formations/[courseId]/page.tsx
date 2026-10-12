import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  Award,
  BarChart3,
  Building2,
  Check,
  ChevronDown,
  ClipboardCheck,
  Clock,
  FileText,
  Infinity as InfinityIcon,
  Layers,
  MonitorSmartphone,
  PlayCircle,
  QrCode,
  Sparkles,
  Users,
} from "lucide-react";
import { BrandDots } from "@/components/brand/brand-decor";
import { CourseCover } from "@/components/learning/course-card";
import { CatalogCard } from "@/components/site/catalog-card";
import { buttonClasses } from "@/components/ui/button";
import { formatClock, formatDate, formatDuration, plural } from "@/lib/format";
import { COURSE_LEVELS } from "@/lib/labels";
import { uuidSchema } from "@/lib/validation";
import { getViewer } from "@/server/auth";
import { getCatalog, getPublicCourse, type PublicCourse } from "@/server/queries/public";

async function load(courseId: string) {
  if (!uuidSchema.safeParse(courseId).success) return null;
  return getPublicCourse(courseId);
}

export async function generateMetadata({ params }: PageProps<"/formations/[courseId]">): Promise<Metadata> {
  const course = await load((await params).courseId);
  if (!course) return { title: "Formation introuvable" };
  return { title: course.title, description: course.summary || undefined };
}

function lessonMeta(l: PublicCourse["modules"][number]["lessons"][number]) {
  if (l.kind === "video" && l.video_duration_seconds) return formatClock(l.video_duration_seconds);
  if (l.kind === "pdf" && l.pdf_page_count) return `${l.pdf_page_count} p.`;
  return l.estimated_minutes ? formatDuration(l.estimated_minutes) : "";
}

export default async function PublicCoursePage({ params }: PageProps<"/formations/[courseId]">) {
  const { courseId } = await params;
  const [course, viewer, catalog] = await Promise.all([load(courseId), getViewer(), getCatalog()]);
  if (!course) notFound();

  const lessons = course.modules.flatMap((m) => m.lessons);
  const videos = lessons.filter((l) => l.kind === "video").length;
  const documents = lessons.filter((l) => l.kind === "pdf").length;
  const quizzes = course.modules.filter((m) => m.quiz).length;
  const firstQuiz = course.modules.find((m) => m.quiz)?.quiz;
  const related = catalog.courses.filter((c) => c.id !== course.id && c.category === course.category).slice(0, 3);
  const others = related.length ? related : catalog.courses.filter((c) => c.id !== course.id).slice(0, 3);
  const learnHref = `/espace/formations/${course.id}`;

  const includes = [
    videos ? { icon: PlayCircle, text: `${plural(videos, "vidéo explicative")}` } : null,
    documents ? { icon: FileText, text: `${plural(documents, "document")} à télécharger` } : null,
    quizzes ? { icon: ClipboardCheck, text: `${plural(quizzes, "évaluation")} de module (seuil 70%)` } : null,
    { icon: Award, text: "Certificat vérifiable par QR code" },
    { icon: MonitorSmartphone, text: "Accessible sur ordinateur, tablette et mobile" },
    { icon: InfinityIcon, text: "À suivre à votre rythme" },
  ].filter((x): x is { icon: typeof PlayCircle; text: string } => Boolean(x));

  const enrollBox = (
    <div className="card-shine overflow-hidden rounded-3xl border border-line bg-surface shadow-xl">
      <CourseCover path={course.cover_path} title={course.title} category={course.category} className="aspect-[16/9] border-b border-line" />
      <div className="p-6 sm:p-7">
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-accent-50 px-3 py-1 text-caption font-bold text-accent-800">
            Sur invitation
          </span>
          <span className="flex items-center gap-1 text-caption font-semibold text-success-700">
            <Sparkles className="size-3.5" aria-hidden /> Fondation Sanady
          </span>
        </div>

        <p className="mt-4 text-[2rem] font-extrabold leading-none tracking-tight text-ink-900">Gratuit</p>
        <p className="mt-1 text-label text-ink-500">Formation offerte aux enseignants par la Fondation Sanady</p>

        <div className="mt-6 flex flex-col gap-2.5">
          {viewer ? (
            <Link href={learnHref} className={buttonClasses({ variant: "accent", size: "lg", className: "h-12 rounded-xl font-bold shadow-xs" })}>
              Accéder à la formation <ArrowRight aria-hidden />
            </Link>
          ) : (
            <>
              <Link href={`/demande-acces?formation=${course.id}`} className={buttonClasses({ variant: "accent", size: "lg", className: "h-12 rounded-xl font-bold shadow-xs" })}>
                Demander un accès enseignant <ArrowRight aria-hidden />
              </Link>
              <Link href={`/connexion?suite=${encodeURIComponent(learnHref)}`} className={buttonClasses({ variant: "secondary", size: "lg", className: "rounded-xl" })}>
                Déjà inscrit ? Se connecter
              </Link>
            </>
          )}
        </div>

        <h2 className="mt-7 text-label font-bold uppercase tracking-wider text-ink-900">Cette formation comprend</h2>
        <ul className="mt-3.5 space-y-3">
          {includes.map((i) => (
            <li key={i.text} className="flex items-start gap-3 text-body text-ink-700">
              <i.icon className="mt-0.5 size-4 shrink-0 text-accent-700" aria-hidden />
              <span>{i.text}</span>
            </li>
          ))}
        </ul>

        <div className="mt-6 border-t border-line/80 pt-5 text-center text-caption text-ink-500">
          Certificat délivré par la Fondation Sanady
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* ─── Header band (Pluralsight style dark high contrast + Edraak trust) */}
      <section className="relative bg-brand-800 text-white">
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-dots-light opacity-12" />
          <div className="absolute -right-24 -top-24 size-[28rem] rounded-full bg-accent-500/10 blur-3xl" />
        </div>

        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:px-8 lg:py-16">
          <div className="lg:pr-6">
            <nav aria-label="Fil d’Ariane" className="flex items-center gap-2 text-label text-brand-300">
              <Link href="/formations" className="hover:text-white hover:underline">
                Formations
              </Link>
              {course.category ? (
                <>
                  <span>/</span>
                  <span className="font-semibold text-accent-300">{course.category}</span>
                </>
              ) : null}
            </nav>

            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-caption font-semibold text-brand-100 backdrop-blur-xs">
                <BrandDots /> Formation Fondation Sanady
              </span>
              <span className="rounded-full bg-accent-500/20 px-3 py-1 text-caption font-semibold text-accent-300">
                Certificat vérifiable
              </span>
            </div>

            <h1 className="mt-4 text-[2.25rem] font-extrabold leading-[1.12] tracking-tight sm:text-[2.75rem]">{course.title}</h1>
            {course.summary ? <p className="mt-4 max-w-2xl text-[1.125rem] leading-relaxed text-brand-100">{course.summary}</p> : null}

            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-body text-brand-100">
              <li className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-3 py-1.5 backdrop-blur-xs">
                <BarChart3 className="size-4 text-accent-400" aria-hidden />
                <span>Niveau : {COURSE_LEVELS[course.level]}</span>
              </li>
              <li className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-3 py-1.5 backdrop-blur-xs">
                <Clock className="size-4 text-accent-400" aria-hidden />
                <span>Durée : {formatDuration(course.estimated_minutes)}</span>
              </li>
              <li className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-3 py-1.5 backdrop-blur-xs">
                <Layers className="size-4 text-accent-400" aria-hidden />
                <span>
                  {plural(course.modules.length, "module")} · {plural(lessons.length, "leçon")}
                </span>
              </li>
              <li className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-3 py-1.5 backdrop-blur-xs">
                <Award className="size-4 text-accent-400" aria-hidden />
                <span>Validation : 70 % requis</span>
              </li>
            </ul>

            <div className="mt-6 flex items-center gap-4 text-caption text-brand-300">
              <span>Mise à jour le {formatDate(course.updated_at)}</span>
              <span>·</span>
              <span>Fondation Sanady pour l’éducation</span>
            </div>
          </div>

          <div className="lg:hidden">{enrollBox}</div>
        </div>
      </section>

      {/* ─── Main Content Grid ────────────────────────────────────────────── */}
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:px-8">
        <div className="min-w-0 space-y-12 lg:pr-6">
          {/* ─── Objectives ─────────────────────────────────────────────── */}
          {course.objectives.length ? (
            <section aria-labelledby="objectifs" className="rounded-3xl border border-line bg-surface p-7 sm:p-9 shadow-xs">
              <div className="flex items-center gap-2.5">
                <Sparkles className="size-5 text-accent-600" aria-hidden />
                <h2 id="objectifs" className="text-[1.375rem] font-bold text-ink-900">
                  Ce que vous allez apprendre & mettre en pratique
                </h2>
              </div>
              <ul className="mt-6 grid gap-x-8 gap-y-3.5 md:grid-cols-2">
                {course.objectives.map((o) => (
                  <li key={o} className="flex items-start gap-3 text-body leading-relaxed text-ink-700">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-success-50 text-success-700">
                      <Check className="size-3.5 stroke-[2.5]" aria-hidden />
                    </span>
                    <span>{o}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* ─── Program (Pluralsight Interactive Accordion Style) ─────── */}
          <section aria-labelledby="programme">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="inline-flex items-center gap-2 text-label font-bold uppercase tracking-wider text-accent-700">
                  <BrandDots /> Structure didactique
                </p>
                <h2 id="programme" className="mt-1 text-[1.5rem] font-extrabold text-ink-900 sm:text-[1.75rem]">
                  Programme détaillé de la formation
                </h2>
              </div>
              <div className="rounded-xl border border-line bg-ink-25/80 px-3.5 py-1.5 text-caption font-semibold text-ink-700">
                {plural(course.modules.length, "module")} · {plural(lessons.length, "leçon")} ·{" "}
                {plural(quizzes, "évaluation")}
              </div>
            </div>

            <div className="mt-6 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-xs">
              {course.modules.map((m, mi) => (
                <details key={m.id} className="group" open={mi === 0}>
                  <summary className="flex cursor-pointer list-none items-center gap-4 bg-ink-25/70 px-6 py-4.5 transition hover:bg-ink-50">
                    <ChevronDown className="size-5 shrink-0 text-ink-500 transition-transform duration-200 group-open:rotate-180" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block text-caption font-bold uppercase tracking-wider text-accent-700">Module 0{mi + 1}</span>
                      <span className="block text-section font-bold text-ink-900">{m.title}</span>
                    </span>
                    <span className="shrink-0 rounded-full border border-line bg-surface px-3 py-1 text-caption font-semibold text-ink-600">
                      {plural(m.lessons.length, "leçon")}
                    </span>
                  </summary>
                  <ul className="divide-y divide-line/70 bg-surface">
                    {m.description ? <li className="bg-ink-25/30 px-6 py-3 pl-14 text-body text-ink-600 italic">{m.description}</li> : null}
                    {m.lessons.map((l, li) => (
                      <li key={li} className="flex items-center gap-3.5 px-6 py-3.5 pl-14 text-body transition hover:bg-ink-25/50">
                        {l.kind === "video" ? (
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-700">
                            <PlayCircle className="size-4" aria-label="Vidéo" />
                          </span>
                        ) : (
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-700">
                            <FileText className="size-4" aria-label="Document" />
                          </span>
                        )}
                        <span className="min-w-0 flex-1 font-medium text-ink-800">
                          {l.title}
                          {!l.is_mandatory ? <span className="ml-2 rounded-md bg-ink-100 px-2 py-0.5 text-caption font-normal text-ink-500">facultative</span> : null}
                        </span>
                        <span className="shrink-0 text-caption tabular font-medium text-ink-500">{lessonMeta(l)}</span>
                      </li>
                    ))}
                    {m.quiz ? (
                      <li className="flex items-center gap-3.5 bg-accent-50/20 px-6 py-4 pl-14 text-body border-t border-accent-100/60">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent-100 text-accent-800">
                          <ClipboardCheck className="size-4" aria-label="Évaluation certifiante" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <span className="block font-bold text-accent-900">{m.quiz.title}</span>
                          <span className="block text-caption text-accent-700">
                            Seuil de validation : {m.quiz.pass_threshold}% · 3 tentatives autorisées · Explications immédiates
                          </span>
                        </div>
                        <span className="shrink-0 rounded-full bg-accent-100 px-2.5 py-0.5 text-caption font-bold text-accent-800">
                          {plural(m.quiz.question_count, "question")}
                        </span>
                      </li>
                    ) : null}
                  </ul>
                </details>
              ))}
            </div>
          </section>

          {/* ─── Description ────────────────────────────────────────────── */}
          {course.description ? (
            <section aria-labelledby="description" className="rounded-3xl border border-line bg-surface p-7 sm:p-9 shadow-xs">
              <h2 id="description" className="text-[1.375rem] font-bold text-ink-900">
                À propos de cette formation
              </h2>
              <div className="mt-4 space-y-4 text-reading leading-relaxed text-ink-700">
                {course.description.split(/\n{2,}/).map((p, i) => (
                  <p key={i} className="whitespace-pre-line">
                    {p}
                  </p>
                ))}
              </div>
            </section>
          ) : null}

          {course.trainers?.length ? (
            <section aria-labelledby="formateurs">
              <h2 id="formateurs" className="text-[1.375rem] font-bold text-ink-900">
                {course.trainers.length > 1 ? "Les formateurs" : "Le formateur"}
              </h2>
              <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                {course.trainers.map((t, i) => (
                  <li key={i} className="flex items-center gap-4 rounded-xl border border-line p-4">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent-50 text-card font-bold text-accent-800" aria-hidden>
                      {(t.name ?? "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-card font-semibold text-ink-900">{t.name}</span>
                      {t.job_title ? <span className="block text-label text-ink-600">{t.job_title}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* ─── Pedagogical Supervision & Quality Guarantee (Edraak style) ── */}
          <section className="rounded-3xl border border-line bg-gradient-to-br from-ink-25 to-surface p-7 sm:p-8">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-brand-700 text-white shadow-xs">
                <Building2 className="size-5" aria-hidden />
              </span>
              <div>
                <span className="block text-caption font-bold uppercase tracking-wider text-accent-700">
                  Garantie Pédagogique
                </span>
                <h3 className="block text-section font-bold text-ink-900">
                  Conçu et supervisé par la Fondation Sanady
                </h3>
              </div>
            </div>
            <p className="mt-4 text-body leading-relaxed text-ink-600">
              Chaque formation est relue et validée par l’équipe pédagogique de la Fondation Sanady avant sa publication. Les modules
              apportent des réponses concrètes, directement transposables dans votre classe.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-line/80 bg-surface p-3.5 text-caption font-medium text-ink-700">
                ✓ Relue et validée avant publication
              </div>
              <div className="rounded-xl border border-line/80 bg-surface p-3.5 text-caption font-medium text-ink-700">
                ✓ Ressources prêtes à l’emploi
              </div>
              <div className="rounded-xl border border-line/80 bg-surface p-3.5 text-caption font-medium text-ink-700">
                ✓ Évaluations formatives sans sanction
              </div>
            </div>
          </section>

          {/* ─── Audience & certification ───────────────────────────────── */}
          <section className="grid gap-6 md:grid-cols-2">
            <div className="card-shine rounded-3xl border border-line bg-surface p-7 shadow-xs">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-accent-50 text-accent-700">
                <Users className="size-6" aria-hidden />
              </span>
              <h2 className="mt-4 text-section font-bold text-ink-900">Public visé</h2>
              <p className="mt-2 text-body leading-relaxed text-ink-600">{course.target_audience || "Tous les enseignants et encadrants pédagogiques."}</p>
            </div>
            <div className="card-shine rounded-3xl border border-line bg-surface p-7 shadow-xs">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-accent-50 text-accent-700">
                <QrCode className="size-6" aria-hidden />
              </span>
              <h2 className="mt-4 text-section font-bold text-ink-900">Certification vérifiable</h2>
              <p className="mt-2 text-body leading-relaxed text-ink-600">
                Validez chaque module avec au moins {firstQuiz?.pass_threshold ?? 70}&nbsp;% de réussite ({firstQuiz?.max_attempts ?? 3}{" "}
                tentatives). Votre certificat est délivré avec un identifiant unique et un QR code{" "}
                <Link href="/verifier" className="font-semibold text-accent-700 underline hover:text-accent-800">
                  vérifiable en ligne
                </Link>
                .
              </p>
            </div>
          </section>
        </div>

        {/* Desktop: the box rises into the band, then stays in view while reading. */}
        <aside aria-label="Inscription" className="relative z-10 hidden lg:block">
          <div className="sticky top-24 -mt-72">{enrollBox}</div>
        </aside>
      </div>

      {/* ─── Related ──────────────────────────────────────────────────────── */}
      {others.length ? (
        <section className="border-t border-line bg-ink-25">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="inline-flex items-center gap-2 text-label font-bold uppercase tracking-wider text-accent-700">
                  <BrandDots /> Poursuivre votre montée en compétences
                </p>
                <h2 className="mt-1 text-[1.5rem] font-bold text-ink-900 sm:text-[1.75rem]">
                  {related.length ? "Dans le même domaine d'apprentissage" : "Autres formations recommandées"}
                </h2>
              </div>
              <Link href="/formations" className={buttonClasses({ variant: "secondary", size: "lg", className: "rounded-xl" })}>
                Tout le catalogue <ArrowRight aria-hidden />
              </Link>
            </div>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {others.map((c) => (
                <CatalogCard key={c.id} course={c} />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
