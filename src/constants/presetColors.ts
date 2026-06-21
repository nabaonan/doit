// 标签/分类共用的预设颜色（与 antdv-next 默认推荐的 16 色一致）

export const PRESET_COLORS = [
  "#EF4444", "#F97316", "#F59E0B", "#EAB308", "#84CC16",
  "#22C55E", "#10B981", "#14B8A6", "#06B6D4", "#3B82F6",
  "#6366F1", "#8B5CF6", "#A855F7", "#D946EF", "#EC4899",
  "#6B7280",
];

export function buildColorPresets() {
  return [
    {
      label: "预设颜色",
      colors: PRESET_COLORS,
      defaultOpen: true,
    },
  ];
}
