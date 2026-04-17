import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines class names using clsx and tailwind-merge.
 * This ensures Tailwind classes are properly merged without conflicts.
 *
 * Usage:
 * ```tsx
 * cn("px-4 py-2", isActive && "bg-primary", className)
 * ```
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a raw phone number string into (123) 456-7890 or +1 (123) 456-7890.
 * Handles 10-digit, 11-digit (+1 prefix), and already-formatted strings.
 * Returns the original string unchanged if it cannot be parsed.
 */
export function formatPhone(raw: string | null | undefined): string {
  if (!raw) return "";
  // Strip everything except digits and leading +
  const hasPlus = raw.trimStart().startsWith("+");
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    // +1 (NXX) NXX-XXXX
    const area = digits.slice(1, 4);
    const prefix = digits.slice(4, 7);
    const line = digits.slice(7, 11);
    return `+1 (${area}) ${prefix}-${line}`;
  }
  if (digits.length === 10) {
    const area = digits.slice(0, 3);
    const prefix = digits.slice(3, 6);
    const line = digits.slice(6, 10);
    if (hasPlus) {
      return `+1 (${area}) ${prefix}-${line}`;
    }
    return `(${area}) ${prefix}-${line}`;
  }
  // Fallback: return original
  return raw;
}

/**
 * Generates a short random ID for local-first records.
 */
export function generateId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
