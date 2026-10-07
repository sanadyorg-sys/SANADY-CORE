import { clsx, type ClassValue } from "clsx";

/**
 * Joins class names. Components are designed so that a `className` passed by
 * a caller only ADDS layout concerns (margins, width); it never needs to
 * override a component's own colours or typography.
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
