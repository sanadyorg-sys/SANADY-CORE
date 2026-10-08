# Design system

All tokens live in `src/app/globals.css` (Tailwind CSS 4 `@theme`). Components read only these tokens.

## Brand — Fondation Sanady

Source: the banner supplied by the foundation (`ASSETSSO/fondation-sanady-banner-original.jpg`). Assets are extracted reproducibly by `node scripts/brand/extract-brand-assets.mjs` into `public/brand/`:

| Asset | Use |
|---|---|
| `sanady-logo.png` | Logo on light backgrounds (transparent, colours untouched) |
| `sanady-logo-light.png` | Adaptation for dark backgrounds (black → white, orange kept) |
| `sanady-tagline.png` | « Préparons les adultes du Maroc de demain » |
| `sanady-classroom.jpg`, `sanady-banner.jpg` | Foundation imagery (sign-in page) |
| `src/lib/pdf/brand-logo.ts` | Generated: logo bytes for certificates and reports |

Logo rules: size by height only (`<BrandLogo className="h-10" />`), never recolour, stretch or crop; keep clear space at least the height of the orange dots.

> **Resolution:** the source is a phone screenshot (logo ≈ 300 px wide). It is sharp at the sizes used, but request the original vector (SVG/AI/PDF) from the foundation and re-run the script with it before printing large formats.

| Token | Value | Origin / use |
|---|---|---|
| `brand-700` | #1C1917 | Wordmark black (softened for UI) — primary buttons, headings |
| `accent-500` | #F95A05 | **Official orange** (validated by the foundation) — logo, icons, progress, tiles, and the `brand` button (size `xl`, 19 px bold = large text, 3.2:1) |
| `accent-600` | #E04E00 | Focus ring, fills |
| `accent-700` | #C94400 | Orange **text** and accent buttons (4.9:1 on white) |
| `ink-50` | #F7F6F4 | Page canvas (warm neutral) |
| `success / warning / danger` | semantic | Status only — never use orange for errors |

## Typography (Inter, Latin + Latin Extended)

| Token | Size / line height | Use |
|---|---|---|
| `text-display` | 30 / 38 | Course titles, certificates |
| `text-title` | 24 / 32 | Page titles |
| `text-section` | 17 / 26 | Section headings |
| `text-card` | 15 / 22 | Card headings |
| `text-body` | 14 / 22 | Interface text |
| `text-reading` | 16 / 28 | Learning content, descriptions |
| `text-label` | 13 / 18 | Form labels, secondary text |
| `text-caption` | 12 / 16 | Metadata |
| `text-stat` | 28 / 34 | Numerical statistics (`tabular` figures) |

Weights: 400, 500, 600. French typography: typographic apostrophe (’), guillemets (« »), non-breaking space before `? ! : ;` and `%`.

## Shape and elevation

Radii 3–10 px (restrained). Shadows: `shadow-xs` (controls), `shadow-sm` (cards), `shadow-pop` (menus, dialogs). No gradients except functional overlays (video controls).

## Layout

- ≥ 1024 px: fixed 264 px sidebar, compact 56 px top bar, content max 1280 px.
- < 1024 px: top bar with navigation drawer; content first.
- Course player: content + sticky curriculum panel on desktop; curriculum in a drawer on tablet/mobile.
- Spacing: Tailwind's 4 px scale; page gutters 16 / 24 / 32 px.

## Components (`src/components/ui`)

| Component | Notes |
|---|---|
| `Button` | primary, **brand** (#F95A05, size xl only), accent, accent-outline, secondary, ghost, danger, danger-ghost · sm/md/lg/xl/icon · `loading` · `asChild` |
| `Field`, `Input`, `Textarea`, `Select`, `Checkbox` | `Field` wires label, hint, error (`aria-describedby`, `aria-invalid`) |
| `SearchForm`, `FilterSelect` | GET forms: filters live in the URL |
| `Table`, `Pagination` | Horizontal scroll on small screens; server-side pagination |
| `Dialog`, `Drawer`, `ConfirmDialog`, `Menu` | Radix primitives (focus trap, Escape, ARIA) |
| `Tabs`, `LinkTabs` | In-page (Radix) and route-based tabs |
| `ProgressBar`, `ProgressRing` | `role="progressbar"` with values |
| `Card`, `Badge`, `Alert`, `PageHeader`, `StatTile`, `DescriptionList` | Surfaces and status |
| `EmptyState`, `Skeleton`, `PageSkeleton`, `ErrorView` | Empty, loading and error states |
| `Toaster` | Polite live region, auto-dismiss |

Domain components: `learning/` (course card, curriculum, video player, PDF reader, quiz runner, attempt review), `tracking/learner-progress`, `admin/` (curriculum, lesson and quiz editors, uploaders).

## Accessibility (WCAG 2.2 AA target)

- Visible focus (`:focus-visible`, 2 px orange outline) on every interactive element.
- Skip link to main content; landmarks; one `h1` per page.
- All form controls labelled; errors announced (`role="alert"`).
- Keyboard: dialogs and menus (Radix), video shortcuts (Space/K, ←/→, J/L, M, F), PDF page navigation (←/→), reordering by buttons (no drag-only interactions).
- Touch targets ≥ 24 px (most controls 32–44 px).
- `prefers-reduced-motion` disables transitions and animations.
- Automated axe checks run in the e2e suite on public pages for three viewports.
