import { BookOpen, Compass, GraduationCap, Hammer, Palette, School, type LucideIcon } from "lucide-react";
import type { InterventionField } from "@/lib/partnerships";

/** Icon of each field of intervention (public pages and administration). */
export const FIELD_ICONS: Record<InterventionField, LucideIcon> = {
  "soutien-scolaire": BookOpen,
  "formation-continue": GraduationCap,
  orientation: Compass,
  bourses: School,
  parascolaire: Palette,
  rehabilitation: Hammer,
};
