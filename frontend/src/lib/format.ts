// Volume formatting respecting the user's preferred unit (ml | l).
export type Unit = "ml" | "l";

export function formatVolume(ml: number, unit: Unit): string {
  if (unit === "l") {
    const liters = ml / 1000;
    // up to 2 decimals, trim trailing zeros
    const s = liters.toFixed(2).replace(/\.?0+$/, "");
    return `${s} L`;
  }
  return `${Math.round(ml)} ml`;
}

export function formatVolumeValue(ml: number, unit: Unit): string {
  if (unit === "l") {
    const liters = ml / 1000;
    return liters.toFixed(2).replace(/\.?0+$/, "");
  }
  return `${Math.round(ml)}`;
}

export function unitLabel(unit: Unit): string {
  return unit === "l" ? "L" : "ml";
}
