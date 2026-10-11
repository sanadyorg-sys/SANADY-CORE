"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const BAR_MAX = 24;
const PAD = { top: 12, right: 8, bottom: 26, left: 32 };
const HEIGHT = 180;

/** Clean upper bound and 3–5 integer ticks. */
function niceTicks(max: number) {
  if (max <= 4) return Array.from({ length: Math.max(max, 1) + 1 }, (_, i) => i);
  const rough = max / 4;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= rough)!;
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: top / step + 1 }, (_, i) => i * step);
}

const shortDate = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

/**
 * Single-series weekly column chart (brand orange, validated ≥ 3:1 on the
 * surface). Each column is focusable and shows a tooltip on hover/focus;
 * every value is also in the data table below (never gated by the tooltip).
 */
export function WeeklyChart({
  title,
  description,
  points,
  unit,
}: {
  title: string;
  description?: string;
  points: Array<{ week: string; value: number }>;
  /** e.g. « enseignants actifs » — used in tooltips and the table. */
  unit: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry!.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const ticks = useMemo(() => niceTicks(Math.max(0, ...points.map((p) => p.value))), [points]);
  const top = ticks.at(-1)!;
  const total = points.reduce((s, p) => s + p.value, 0);
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const band = points.length ? plotW / points.length : 0;
  const barW = Math.max(2, Math.min(BAR_MAX, band - 2));
  const y = (v: number) => PAD.top + plotH - (top ? (v / top) * plotH : 0);
  const labelEvery = Math.max(1, Math.ceil(points.length / Math.max(1, Math.floor(plotW / 64))));
  const peak = points.reduce((best, p, i) => (p.value > (points[best]?.value ?? -1) ? i : best), 0);

  return (
    <figure className="rounded-xl border border-line bg-surface p-5">
      <figcaption className="mb-3">
        <p className="text-card font-semibold text-ink-900">{title}</p>
        {description ? <p className="text-caption text-ink-500">{description}</p> : null}
      </figcaption>
      <div ref={ref} className="relative">
        {width > 0 ? (
          <svg width={width} height={HEIGHT} role="img" aria-label={`${title} : ${total} au total sur la période. Détail dans le tableau ci-dessous.`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--color-ink-200)" strokeWidth={1} />
                <text x={PAD.left - 6} y={y(t)} dy="0.32em" textAnchor="end" className="fill-ink-500 text-[11px] tabular-nums">
                  {t}
                </text>
              </g>
            ))}
            {points.map((p, i) => {
              const cx = PAD.left + band * i + band / 2;
              const h = Math.max(0, y(0) - y(p.value));
              const r = Math.min(4, h, barW / 2);
              const x = cx - barW / 2;
              const yTop = y(p.value);
              return (
                <g
                  key={p.week}
                  tabIndex={0}
                  role="img"
                  aria-label={`Semaine du ${shortDate(p.week)} : ${p.value} ${unit}`}
                  onPointerEnter={() => setActive(i)}
                  onPointerLeave={() => setActive((a) => (a === i ? null : a))}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive((a) => (a === i ? null : a))}
                  className="cursor-default outline-none"
                >
                  {/* Hit target: the whole band, taller than the mark. */}
                  <rect x={PAD.left + band * i} y={PAD.top} width={band} height={plotH} fill="transparent" />
                  {h > 0 ? (
                    <path
                      d={`M${x},${y(0)} V${yTop + r} Q${x},${yTop} ${x + r},${yTop} H${x + barW - r} Q${x + barW},${yTop} ${x + barW},${yTop + r} V${y(0)} Z`}
                      fill="#F95A05"
                      opacity={active === null || active === i ? 1 : 0.55}
                    />
                  ) : null}
                  {i % labelEvery === 0 ? (
                    <text x={cx} y={HEIGHT - 8} textAnchor="middle" className="fill-ink-500 text-[11px]">
                      {shortDate(p.week)}
                    </text>
                  ) : null}
                  {i === peak && p.value > 0 && active === null ? (
                    <text x={cx} y={yTop - 4} textAnchor="middle" className="fill-ink-700 text-[11px] font-semibold tabular-nums">
                      {p.value}
                    </text>
                  ) : null}
                </g>
              );
            })}
            <line x1={PAD.left} x2={width - PAD.right} y1={y(0)} y2={y(0)} stroke="var(--color-ink-300)" strokeWidth={1} />
          </svg>
        ) : (
          <div style={{ height: HEIGHT }} />
        )}
        {active !== null && points[active] && width > 0 ? (
          <div
            role="status"
            className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-md border border-line bg-surface px-3 py-2 text-caption shadow-md"
            style={{
              left: Math.min(Math.max(PAD.left + band * active + band / 2, 70), width - 70),
              top: Math.max(0, y(points[active].value) - 52),
            }}
          >
            <p className="text-body font-semibold tabular-nums text-ink-900">
              {points[active].value} {unit}
            </p>
            <p className="text-ink-500">Semaine du {shortDate(points[active].week)}</p>
          </div>
        ) : null}
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer text-label font-medium text-accent-700 hover:underline">Voir les données</summary>
        <table className="mt-2 w-full text-label">
          <thead>
            <tr className="text-left text-ink-500">
              <th className="py-1 font-medium">Semaine du</th>
              <th className="py-1 text-right font-medium">{unit}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.week} className="border-t border-line">
                <td className="py-1 text-ink-700">{shortDate(p.week)}</td>
                <td className="py-1 text-right tabular-nums text-ink-900">{p.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
