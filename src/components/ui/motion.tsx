"use client";

import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Fades its content up when it scrolls into view.
 *
 * Progressive enhancement: the server renders the content visible. Only once
 * JavaScript runs, and only if the element is still below the fold, is it
 * hidden ("pending") and then revealed. No-JS visitors and reduced-motion
 * users always see the content (see globals.css).
 */
export function Reveal({
  as: Tag = "div",
  delay = 0,
  className,
  children,
  ...rest
}: {
  as?: ElementType;
  /** Stagger delay in milliseconds. */
  delay?: number;
  className?: string;
  children: ReactNode;
} & Record<string, unknown>) {
  const ref = useRef<HTMLElement>(null);
  const [state, setState] = useState<"shown" | "pending">("shown");

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return;

    setState("pending");
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setState("shown");
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      data-reveal={state}
      className={cn(className)}
      style={delay ? ({ "--reveal-delay": `${delay}ms` } as React.CSSProperties) : undefined}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/**
 * Counts up to `value` when it enters the viewport. The final value is rendered
 * on the server and exposed to assistive technology at all times.
 */
export function CountUp({
  value,
  prefix = "",
  suffix = "",
  duration = 1600,
  className,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return;

    setDisplay(0);
    let frame = 0;
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        setDisplay(Math.round(value * eased));
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, duration]);

  const final = `${prefix}${value.toLocaleString("fr-FR")}${suffix}`;
  return (
    <span ref={ref} className={cn("tabular", className)}>
      <span aria-hidden>
        {prefix}
        {display.toLocaleString("fr-FR")}
        {suffix}
      </span>
      <span className="sr-only">{final}</span>
    </span>
  );
}
