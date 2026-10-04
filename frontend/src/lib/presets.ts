// Quick-add preset model shared by Home, Settings and the presets editor.
import { BeerBottle, Coffee, Drop, Jar, PintGlass, Wine, type Icon } from "phosphor-react-native";

export type PresetIconKey = "glass" | "mug" | "bottle" | "drop" | "wine" | "jar";

export type Preset = { amount_ml: number; icon: PresetIconKey };

export const PRESET_ICONS: { key: PresetIconKey; Icon: Icon }[] = [
  { key: "glass", Icon: PintGlass },
  { key: "mug", Icon: Coffee },
  { key: "bottle", Icon: BeerBottle },
  { key: "drop", Icon: Drop },
  { key: "wine", Icon: Wine },
  { key: "jar", Icon: Jar },
];

export const MAX_PRESETS = 6;

export function iconFor(key: string): Icon {
  return PRESET_ICONS.find((i) => i.key === key)?.Icon ?? Drop;
}

export function defaultIcon(ml: number): PresetIconKey {
  if (ml >= 500) return "bottle";
  if (ml >= 300) return "mug";
  return "glass";
}

export const DEFAULT_PRESETS: Preset[] = [100, 200, 250, 300, 500].map((ml) => ({
  amount_ml: ml,
  icon: defaultIcon(ml),
}));
