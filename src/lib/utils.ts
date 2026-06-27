import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Resolves public asset paths for GitHub Pages subpath */
export function asset(path: string) {
  const base = import.meta.env.BASE_URL;
  return base + path.replace(/^\//, "");
}
