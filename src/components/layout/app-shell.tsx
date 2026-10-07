"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Building2, Check, ChevronsUpDown, GraduationCap, LogOut, Menu as MenuIcon, ShieldCheck, UserRound } from "lucide-react";
import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import { Drawer, Menu, MenuItem, MenuLabel, MenuSeparator } from "@/components/ui/overlay";
import { initials } from "@/lib/format";
import { SidebarNav, type Area } from "./navigation";

export interface ShellContext {
  key: string;
  label: string;
  description: string;
  href: string;
  kind: "admin" | "institution" | "teacher";
}

export interface ShellUser {
  name: string;
  email: string;
}

const areaTitle: Record<Area, string> = {
  admin: "Administration SANADY",
  institution: "Espace établissement",
  teacher: "Espace enseignant",
};

/**
 * Responsive application frame.
 * ≥ 1024 px: fixed sidebar. Below: compact top bar with a navigation drawer.
 */
export function AppShell({
  area,
  institutionId,
  currentContextKey,
  contexts,
  user,
  signOutAction,
  children,
}: {
  area: Area;
  institutionId?: string;
  currentContextKey: string;
  contexts: ShellContext[];
  user: ShellUser;
  signOutAction: () => Promise<void>;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const current = contexts.find((c) => c.key === currentContextKey);

  const sidebar = (onNavigate?: () => void) => (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center px-5">
        <Link href="/" className="rounded-sm" onClick={onNavigate}>
          <Wordmark className="text-[1.0625rem]" />
        </Link>
      </div>
      <div className="px-3 pb-4">
        <ContextSwitcher contexts={contexts} current={current} fallbackLabel={areaTitle[area]} />
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-6">
        <SidebarNav area={area} institutionId={institutionId} onNavigate={onNavigate} />
      </div>
      <div className="border-t border-line px-5 py-3 text-caption text-ink-400">
        <Link href="/confidentialite" className="hover:text-ink-600 hover:underline" onClick={onNavigate}>
          Confidentialité et données
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
      <a
        href="#contenu"
        className="sr-only z-[70] rounded-md bg-navy-700 px-4 py-2 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Aller au contenu
      </a>

      <aside className="sticky top-0 hidden h-dvh border-r border-line bg-surface lg:block">{sidebar()}</aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-surface/85 sm:px-6 lg:px-8">
          <Drawer
            open={mobileOpen}
            onOpenChange={setMobileOpen}
            side="left"
            width="max-w-[300px]"
            title="Menu"
            trigger={
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Ouvrir le menu">
                <MenuIcon />
              </Button>
            }
          >
            {sidebar(() => setMobileOpen(false))}
          </Drawer>
          <Link href="/" className="lg:hidden">
            <Wordmark className="text-[0.9375rem]" />
          </Link>
          <p className="hidden truncate text-label font-medium text-ink-500 lg:block">{current?.label ?? areaTitle[area]}</p>
          <div className="ml-auto flex items-center gap-2">
            <UserMenu user={user} signOutAction={signOutAction} />
          </div>
        </header>

        <main id="contenu" tabIndex={-1} className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 focus:outline-none sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function ContextIcon({ kind, className }: { kind?: ShellContext["kind"]; className?: string }) {
  if (kind === "admin") return <ShieldCheck className={className} aria-hidden />;
  if (kind === "institution") return <Building2 className={className} aria-hidden />;
  return <GraduationCap className={className} aria-hidden />;
}

function ContextSwitcher({
  contexts,
  current,
  fallbackLabel,
}: {
  contexts: ShellContext[];
  current?: ShellContext;
  fallbackLabel: string;
}) {
  const box = (
    <>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-navy-700 text-white">
        <ContextIcon kind={current?.kind} className="size-4" />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-label font-semibold text-ink-900">{current?.label ?? fallbackLabel}</span>
        <span className="block truncate text-caption text-ink-500">{current?.description ?? ""}</span>
      </span>
    </>
  );

  if (contexts.length <= 1) {
    return <div className="flex items-center gap-3 rounded-md border border-line bg-ink-25 px-2.5 py-2">{box}</div>;
  }

  return (
    <Menu
      align="start"
      trigger={
        <button
          className="flex w-full items-center gap-3 rounded-md border border-line bg-ink-25 px-2.5 py-2 hover:border-line-strong hover:bg-ink-50"
          aria-label="Changer d’espace"
        >
          {box}
          <ChevronsUpDown className="size-4 shrink-0 text-ink-400" aria-hidden />
        </button>
      }
    >
      <MenuLabel>Changer d’espace</MenuLabel>
      {contexts.map((c) => {
        return (
          <MenuItem key={c.key} asChild>
            <Link href={c.href}>
              <ContextIcon kind={c.kind} className="text-ink-500" />
              <span className="min-w-0 flex-1 truncate">{c.label}</span>
              {c.key === current?.key ? <Check className="text-teal-600" aria-label="Espace actuel" /> : null}
            </Link>
          </MenuItem>
        );
      })}
    </Menu>
  );
}

function UserMenu({ user, signOutAction }: { user: ShellUser; signOutAction: () => Promise<void> }) {
  return (
    <Menu
      trigger={
        <button className="flex items-center gap-2.5 rounded-md py-1 pl-1 pr-2 hover:bg-ink-50" aria-label="Menu du compte">
          <span className="flex size-8 items-center justify-center rounded-full bg-teal-50 text-caption font-semibold text-teal-800 ring-1 ring-teal-100">
            {initials(user.name, user.email)}
          </span>
          <span className="hidden max-w-[180px] truncate text-label font-medium text-ink-800 sm:block">{user.name}</span>
        </button>
      }
    >
      <div className="px-2.5 py-2">
        <p className="truncate text-body font-medium text-ink-900">{user.name}</p>
        <p className="truncate text-caption text-ink-500">{user.email}</p>
      </div>
      <MenuSeparator />
      <MenuItem asChild>
        <Link href="/espace/profil">
          <UserRound aria-hidden /> Mon profil
        </Link>
      </MenuItem>
      <MenuSeparator />
      <MenuItem
        onSelect={() => {
          void signOutAction();
        }}
      >
        <LogOut aria-hidden /> Se déconnecter
      </MenuItem>
    </Menu>
  );
}
