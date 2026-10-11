"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Award,
  BookMarked,
  BookOpen,
  Building2,
  ChartColumn,
  ChartNoAxesCombined,
  ClipboardCheck,
  ClipboardList,
  FileText,
  History,
  Inbox,
  LayoutDashboard,
  Library,
  Mail,
  Settings,
  ShieldCheck,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

export type Area = "teacher" | "institution" | "admin";
/** admin area: admin | manager | trainer — institution area: admin | supervisor. */
export type NavRole = "admin" | "manager" | "trainer" | "supervisor";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}
interface NavSection {
  title?: string;
  items: NavItem[];
}

export function navigationFor(area: Area, institutionId?: string, role: NavRole = "admin"): NavSection[] {
  if (area === "admin" && role === "trainer") {
    return [{ items: [{ href: "/admin/formations", label: "Mes formations", icon: Library }] }];
  }
  if (area === "admin" && role === "manager") {
    return [
      { items: [{ href: "/admin", label: "Tableau de bord", icon: LayoutDashboard, exact: true }] },
      {
        title: "Pédagogie",
        items: [
          { href: "/admin/formations", label: "Formations", icon: Library },
          { href: "/admin/bibliotheque", label: "Bibliothèque", icon: BookMarked },
          { href: "/admin/suivi", label: "Suivi pédagogique", icon: ChartColumn },
          { href: "/admin/rapports", label: "Rapports et statistiques", icon: ChartNoAxesCombined },
          { href: "/admin/certificats", label: "Certificats", icon: Award },
        ],
      },
    ];
  }
  if (area === "admin") {
    return [
      { items: [{ href: "/admin", label: "Tableau de bord", icon: LayoutDashboard, exact: true }] },
      {
        title: "Pédagogie",
        items: [
          { href: "/admin/formations", label: "Formations", icon: Library },
          { href: "/admin/bibliotheque", label: "Bibliothèque", icon: BookMarked },
          { href: "/admin/suivi", label: "Suivi pédagogique", icon: ChartColumn },
          { href: "/admin/rapports", label: "Rapports et statistiques", icon: ChartNoAxesCombined },
          { href: "/admin/certificats", label: "Certificats", icon: Award },
        ],
      },
      {
        title: "Organisation",
        items: [
          { href: "/admin/etablissements", label: "Établissements", icon: Building2 },
          { href: "/admin/enseignants", label: "Gestion des enseignants", icon: Users },
          { href: "/admin/demandes", label: "Demandes d’accès", icon: Inbox },
          { href: "/admin/invitations", label: "Invitations", icon: Mail },
        ],
      },
      {
        title: "Plateforme",
        items: [
          { href: "/admin/journal", label: "Journal d’activité", icon: History },
          { href: "/admin/administrateurs", label: "Équipe SANADY", icon: ShieldCheck },
          { href: "/admin/parametres", label: "Paramètres", icon: Settings },
        ],
      },
    ];
  }
  if (area === "institution" && institutionId) {
    const base = `/etablissement/${institutionId}`;
    return [
      {
        items: [
          { href: base, label: "Tableau de bord", icon: LayoutDashboard, exact: true },
          { href: `${base}/enseignants`, label: "Nos enseignants", icon: Users },
          { href: `${base}/formations`, label: "Formations autorisées", icon: Library },
          { href: `${base}/suivi`, label: "Suivi individuel", icon: ClipboardList },
          { href: `${base}/statistiques`, label: "Statistiques", icon: ChartNoAxesCombined },
          { href: `${base}/rapports`, label: "Rapports", icon: FileText },
          { href: "/espace/bibliotheque", label: "Bibliothèque", icon: BookMarked },
        ],
      },
    ];
  }
  return [
    {
      items: [
        { href: "/espace", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
        { href: "/espace/formations", label: "Mes formations", icon: BookOpen },
        { href: "/espace/evaluations", label: "Mes évaluations", icon: ClipboardCheck },
        { href: "/espace/certificats", label: "Mes certificats", icon: Award },
        { href: "/espace/bibliotheque", label: "Bibliothèque", icon: BookMarked },
        { href: "/espace/profil", label: "Mon profil", icon: UserRound },
      ],
    },
  ];
}

export function SidebarNav({
  area,
  institutionId,
  role,
  onNavigate,
}: {
  area: Area;
  institutionId?: string;
  role?: NavRole;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const sections = navigationFor(area, institutionId, role);

  return (
    <nav aria-label="Navigation principale" className="space-y-6">
      {sections.map((section, i) => (
        <div key={i}>
          {section.title ? (
            <p className="mb-1.5 px-3 text-caption font-semibold uppercase tracking-wider text-ink-400">{section.title}</p>
          ) : null}
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group flex h-9 items-center gap-3 rounded-md px-3 text-body font-medium transition-colors",
                      active ? "bg-accent-50 text-ink-900 shadow-[inset_3px_0_0_var(--color-accent-500)]" : "text-ink-600 hover:bg-ink-50 hover:text-ink-900",
                    )}
                  >
                    <Icon
                      className={cn("size-[1.0625rem] shrink-0", active ? "text-accent-600" : "text-ink-400 group-hover:text-ink-600")}
                      aria-hidden
                    />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
