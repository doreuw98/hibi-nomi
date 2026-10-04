// Client mirror of the backend hydration target formula (for instant preview).
// Backend remains the source of truth and recomputes on save.
export const ACTIVITY_LEVELS = ["sedentary", "light", "moderate", "active", "very_active"] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];

const BONUS: Record<string, number> = {
  sedentary: 0,
  light: 250,
  moderate: 500,
  active: 750,
  very_active: 1000,
};

export function calculateTarget(weightKg?: number | null, activity?: string | null): number {
  const w = weightKg && weightKg > 0 ? weightKg : 60;
  const base = w * 35;
  const bonus = BONUS[activity || "light"] ?? 250;
  const total = Math.round((base + bonus) / 50) * 50;
  return Math.min(Math.max(total, 1500), 4000);
}
