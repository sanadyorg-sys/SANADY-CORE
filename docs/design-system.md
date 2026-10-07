# Design system

All tokens live in `src/app/globals.css` (Tailwind CSS 4 `@theme`). Components read only these tokens.

## Brand — placeholder

> **The official SANADY logo has not been supplied.** The palette below uses the temporary values from the brief. When the logo arrives:
> 1. Extract its primary and secondary colours; regenerate the `navy` and `teal` scales (keep the step names).
> 2. Check contrast: text on `navy-700` and `teal-600` must stay ≥ 4.5:1.
> 3. Replace `src/components/brand/wordmark.tsx` with the original asset (`/public/brand/sanady-logo.svg`), respecting proportions and clear space; never recolour or redraw it.
> 4. Update `COLORS` in `src/lib/pdf/common.ts` and the e-mail templates (`src/server/email.ts`, `supabase/templates/`).

| Token | Value | Use |
|---|---|---|
| `navy-700` | #123653 | Primary actions, brand surfaces |
| `teal-600` | #287F78 | Accent, focus ring, progress |
| `ink-50` | #F3F6F9 | Page canvas |
| `ink-0` | #FFFFFF | Surfaces |
| `ink-200 / 300` | lines | Borders |
| `success / warning / danger` | semantic | Status only |

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
| `Button` | primary, accent, secondary, ghost, danger, danger-ghost · sm/md/lg/icon · `loading` · `asChild` |
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

- Visible focus (`:focus-visible`, 2 px teal outline) on every interactive element.
- Skip link to main content; landmarks; one `h1` per page.
- All form controls labelled; errors announced (`role="alert"`).
- Keyboard: dialogs and menus (Radix), video shortcuts (Space/K, ←/→, J/L, M, F), PDF page navigation (←/→), reordering by buttons (no drag-only interactions).
- Touch targets ≥ 24 px (most controls 32–44 px).
- `prefers-reduced-motion` disables transitions and animations.
- Automated axe checks run in the e2e suite on public pages for three viewports.
