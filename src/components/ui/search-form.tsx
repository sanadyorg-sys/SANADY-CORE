import { Search } from "lucide-react";
import type { ReactNode } from "react";

/**
 * GET form that writes filters to the URL. Works without JavaScript and keeps
 * filtered views shareable. Extra filters (selects) can be passed as children.
 */
export function SearchForm({
  action,
  defaultValue,
  placeholder = "Rechercher…",
  label = "Rechercher",
  children,
}: {
  action: string;
  defaultValue?: string;
  placeholder?: string;
  label?: string;
  children?: ReactNode;
}) {
  return (
    <form action={action} method="get" role="search" className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
        <label htmlFor="q" className="sr-only">
          {label}
        </label>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" aria-hidden />
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={defaultValue}
          placeholder={placeholder}
          className="h-9 w-full rounded-md border border-line-strong bg-surface pl-9 pr-3 text-body text-ink-900 shadow-xs placeholder:text-ink-400 hover:border-ink-400 focus-visible:border-teal-600 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-teal-600/15"
        />
      </div>
      {children}
      <button
        type="submit"
        className="h-9 rounded-md border border-line-strong bg-surface px-3.5 text-body font-medium text-ink-800 shadow-xs hover:bg-ink-50"
      >
        Filtrer
      </button>
    </form>
  );
}

export function FilterSelect({
  name,
  label,
  defaultValue,
  options,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div>
      <label htmlFor={`filter-${name}`} className="sr-only">
        {label}
      </label>
      <select
        id={`filter-${name}`}
        name={name}
        defaultValue={defaultValue ?? ""}
        className="h-9 rounded-md border border-line-strong bg-surface pl-3 pr-8 text-body text-ink-800 shadow-xs hover:border-ink-400 focus-visible:border-teal-600 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-teal-600/15"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
