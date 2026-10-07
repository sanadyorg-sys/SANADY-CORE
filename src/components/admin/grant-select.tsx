"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import type { ActionState } from "@/lib/types";

/** Select an item and apply a server action to it (e.g. authorize a course). */
export function GrantSelect({
  options,
  label,
  placeholder,
  buttonLabel,
  onGrant,
  emptyMessage,
}: {
  options: Array<{ value: string; label: string }>;
  label: string;
  placeholder: string;
  buttonLabel: string;
  onGrant: (value: string) => Promise<ActionState>;
  emptyMessage: string;
}) {
  const id = useId();
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();

  if (options.length === 0) return <p className="text-label text-ink-500">{emptyMessage}</p>;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="min-w-0 flex-1 space-y-1.5">
        <label htmlFor={id} className="block text-label font-medium text-ink-800">
          {label}
        </label>
        <Select id={id} value={value} onChange={(e) => setValue(e.target.value)}>
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>
      <Button
        disabled={!value}
        loading={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await onGrant(value);
            toast({ tone: res.ok ? "success" : "danger", title: res.message ?? (res.ok ? "Enregistré." : "Échec de l’opération.") });
            if (res.ok) {
              setValue("");
              router.refresh();
            }
          })
        }
      >
        <Plus aria-hidden /> {buttonLabel}
      </Button>
    </div>
  );
}
