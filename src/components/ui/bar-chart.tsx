"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { formatAmount } from "@/lib/partnerships";

/**
 * Grouped bar chart (one group per period, one bar per series), drawn in
 * SVG. Identity is never colour alone: a legend names each series and the
 * tooltip and data table repeat the values in text. Colours come from the
 * validated chart tokens (--color-chart-1, --color-chart-2).
 */

export interface BarSeries {
  key: string;
  label: string;
  color: string;
  values: number[];
}

const H = 220;
const M = { top: 12, right: 8, bottom: 26, left: 64 };

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

/** Bar with 4px rounded data end, square on the baseline. */
function barPath(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

export function BarChart({
  title,
  categories,
  series,
  currency,
  className,
}: {
  title: string;
  categories: string[];
  series: BarSeries[];
  /** Amounts in this currency (never converted). */
  currency: string;
  className?: string;
}) {
  const format = (v: number) => formatAmount(v, currency) ?? `0 ${currency}`;
  const short = (v: number) => new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 }).format(v);
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [active, setActive] = useState<number | null>(null);
  const tableId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(260, Math.floor(e!.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const max = niceMax(Math.max(0, ...series.flatMap((s) => s.values)));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const innerW = width - M.left - M.right;
  const innerH = H - M.top - M.bottom;
  const band = innerW / categories.length;
  const groupW = Math.min(band * 0.72, 22 * series.length + 2 * (series.length - 1));
  const gap = 2;
  const barW = (groupW - gap * (series.length - 1)) / series.length;
  const y = (v: number) => M.top + innerH - (v / max) * innerH;
  const label = (i: number) => `${categories[i]} : ${series.map((s) => `${s.label} ${format(s.values[i] ?? 0)}`).join(", ")}`;
  const empty = series.every((s) => s.values.every((v) => !v));
  // On narrow screens, label every other period.
  const step = band < 30 ? 2 : 1;

  return (
    <figure className={cn("space-y-3", className)}>
      <figcaption className="sr-only">{title}</figcaption>
      {series.length > 1 ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-label text-ink-700" aria-label="Légende">
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-xs" style={{ background: s.color }} aria-hidden />
              {s.label}
            </li>
          ))}
        </ul>
      ) : null}
      <div ref={ref} className="relative" onMouseLeave={() => setActive(null)}>
        {empty ? (
          <p className="flex h-[120px] items-center justify-center rounded-xl bg-ink-50 text-label text-ink-500">Aucun montant sur la période.</p>
        ) : (
          <svg width="100%" height={H} viewBox={`0 0 ${width} ${H}`} role="group" aria-label={title} className="block overflow-visible">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} stroke="var(--color-ink-200)" strokeWidth={1} shapeRendering="crispEdges" />
                <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-ink-500 text-[11px] tabular-nums">
                  {short(t)}
                </text>
              </g>
            ))}
            {categories.map((c, i) => {
              const x0 = M.left + band * i + (band - groupW) / 2;
              return (
                <g key={c}>
                  {active === i ? <rect x={M.left + band * i} y={M.top} width={band} height={innerH} fill="var(--color-ink-100)" /> : null}
                  {series.map((s, si) => {
                    const v = s.values[i] ?? 0;
                    if (!v) return null;
                    const top = y(v);
                    return <path key={s.key} d={barPath(x0 + si * (barW + gap), top, barW, Math.max(1, M.top + innerH - top))} fill={s.color} />;
                  })}
                  {i % step === 0 ? (
                    <text x={M.left + band * i + band / 2} y={H - 8} textAnchor="middle" className="fill-ink-500 text-[11px]">
                      {c}
                    </text>
                  ) : null}
                  {/* Hit target: the whole column, larger than the bars. */}
                  <rect
                    x={M.left + band * i}
                    y={M.top}
                    width={band}
                    height={innerH}
                    fill="transparent"
                    tabIndex={0}
                    aria-label={label(i)}
                    className="cursor-default outline-none focus-visible:stroke-accent-600"
                    strokeWidth={2}
                    onMouseEnter={() => setActive(i)}
                    onFocus={() => setActive(i)}
                    onBlur={() => setActive(null)}
                  />
                </g>
              );
            })}
            <line x1={M.left} x2={width - M.right} y1={M.top + innerH} y2={M.top + innerH} stroke="var(--color-ink-300)" strokeWidth={1} shapeRendering="crispEdges" />
          </svg>
        )}
        {active !== null && !empty ? (
          <div
            role="status"
            className="pointer-events-none absolute top-0 z-10 min-w-36 rounded-lg border border-line bg-surface px-3 py-2 text-label shadow-pop"
            style={{
              left: Math.min(Math.max(0, M.left + band * active + band / 2 - 80), width - 168),
            }}
          >
            <p className="font-semibold text-ink-900">{categories[active]}</p>
            {series.map((s) => (
              <p key={s.key} className="mt-0.5 flex items-center justify-between gap-3 text-ink-700">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-xs" style={{ background: s.color }} aria-hidden />
                  {s.label}
                </span>
                <span className="font-medium tabular-nums text-ink-900">{format(s.values[active] ?? 0)}</span>
              </p>
            ))}
          </div>
        ) : null}
      </div>
      <details className="group text-label">
        <summary className="cursor-pointer text-ink-600 hover:text-ink-900" aria-controls={tableId}>
          Afficher les données
        </summary>
        <div className="mt-2 overflow-x-auto">
          <table id={tableId} className="w-full text-left text-label">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr className="border-b border-line text-caption text-ink-500">
                <th scope="col" className="py-1.5 pr-3 font-medium">
                  Période
                </th>
                {series.map((s) => (
                  <th key={s.key} scope="col" className="py-1.5 pl-3 text-right font-medium">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories.map((c, i) => (
                <tr key={c} className="border-b border-line last:border-0">
                  <th scope="row" className="py-1.5 pr-3 font-normal text-ink-700">
                    {c}
                  </th>
                  {series.map((s) => (
                    <td key={s.key} className="py-1.5 pl-3 text-right tabular-nums text-ink-900">
                      {format(s.values[i] ?? 0)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
