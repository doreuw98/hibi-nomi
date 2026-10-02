// Client mirror of the backend hydration target formula (for instant preview).
// Backend remains the source of truth and recomputes on save.
export const ACTIVITY_OPTIONS = [
  { value: "sedentary", label: "Sedentary", hint: "Little exercise" },
  { value: "light", label: "Light", hint: "1-2 days/week" },
  { value: "moderate", label: "Moderate", hint: "3-4 days/week" },
  { value: "active", label: "Active", hint: "5-6 days/week" },
  { value: "very_active", label: "Very active", hint: "Daily training" },
] as const;

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
