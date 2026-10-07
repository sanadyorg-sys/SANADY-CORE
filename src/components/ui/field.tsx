"use client";

import {
  cloneElement,
  isValidElement,
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

const controlBase =
  "block w-full rounded-md border bg-surface text-body text-ink-900 shadow-xs transition-colors " +
  "placeholder:text-ink-400 disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-ink-500 " +
  "focus-visible:outline-none focus-visible:border-teal-600 focus-visible:ring-3 focus-visible:ring-teal-600/15";

const controlState = (invalid?: boolean) =>
  invalid ? "border-danger-600 focus-visible:border-danger-600 focus-visible:ring-danger-600/15" : "border-line-strong hover:border-ink-400";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export function Input({ className, invalid, ...props }: InputProps) {
  return (
    <input
      className={cn(controlBase, controlState(invalid), "h-9 px-3", className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export function Textarea({ className, invalid, rows = 4, ...props }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      className={cn(controlBase, controlState(invalid), "px-3 py-2 leading-relaxed", className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

/** Native select: fully accessible and reliable on mobile devices. */
export function Select({ className, invalid, children, ...props }: SelectProps) {
  return (
    <div className={cn("relative", className)}>
      <select
        className={cn(controlBase, controlState(invalid), "h-9 appearance-none pl-3 pr-9")}
        aria-invalid={invalid || undefined}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-500" aria-hidden />
    </div>
  );
}

export function Label({ htmlFor, children, optional, className }: {
  htmlFor?: string;
  children: ReactNode;
  optional?: boolean;
  className?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={cn("block text-label font-medium text-ink-800", className)}>
      {children}
      {optional ? <span className="ml-1 font-normal text-ink-500">(facultatif)</span> : null}
    </label>
  );
}

/**
 * Wires a label, hint and error message to a single control via ids
 * (aria-describedby / aria-invalid), so every form is accessible by default.
 */
export function Field({
  label,
  hint,
  error,
  optional,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  children: ReactElement<{ id?: string; "aria-describedby"?: string; invalid?: boolean }>;
  className?: string;
}) {
  const generated = useId();
  const id = children.props.id ?? generated;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} optional={optional}>
        {label}
      </Label>
      {isValidElement(children)
        ? cloneElement(children, { id, "aria-describedby": describedBy, invalid: Boolean(error) || children.props.invalid })
        : children}
      {hint && !error ? (
        <p id={hintId} className="text-caption text-ink-500">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-caption font-medium text-danger-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Checkbox({
  label,
  description,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; description?: ReactNode }) {
  const id = useId();
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <input
        id={props.id ?? id}
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 cursor-pointer rounded-xs border-line-strong accent-teal-600"
        {...props}
      />
      <label htmlFor={props.id ?? id} className="cursor-pointer text-body text-ink-800">
        <span className="font-medium">{label}</span>
        {description ? <span className="mt-0.5 block text-label text-ink-500">{description}</span> : null}
      </label>
    </div>
  );
}
