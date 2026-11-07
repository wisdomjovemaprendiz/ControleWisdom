import type { CourseClass } from "./domain";
export const classPalette = [
  "#2457A7",
  "#08796B",
  "#8650A5",
  "#AD5318",
  "#AC3165",
  "#53751F",
  "#4E55A5",
  "#A0443A",
  "#087C96",
  "#805A92",
  "#8B6C16",
  "#4F6D7B",
  "#9A436C",
  "#397249",
  "#735FA7",
  "#9E5D30",
];
export function classColor(course: Pick<CourseClass, "id" | "color">) {
  if (course.color && /^#[0-9a-f]{6}$/i.test(course.color)) return course.color;
  let hash = 0;
  for (const c of course.id)
    hash = (Math.imul(hash, 31) + c.charCodeAt(0)) >>> 0;
  return classPalette[hash % classPalette.length];
}
export function classFrame(course: Pick<CourseClass, "id" | "color">) {
  return {
    "--class-color": classColor(course),
  } as import("react").CSSProperties;
}
export function occupancyInfo(enrolled: number, capacity: number) {
  const percent = capacity > 0 ? Math.round((enrolled / capacity) * 100) : 0;
  const tone =
    percent < 40
      ? "low"
      : percent < 70
        ? "moderate"
        : percent < 90
          ? "balanced"
          : "near-full";
  const color = {
    low: "#C43B43",
    moderate: "#B98517",
    balanced: "#63962E",
    "near-full": "#218361",
  }[tone];
  const label =
    percent >= 100
      ? "Lotada"
      : percent < 40
        ? "Baixa ocupação"
        : percent < 70
          ? "Ocupação moderada"
          : percent < 90
            ? "Boa ocupação"
            : "Próxima da lotação";
  return {
    percent,
    tone,
    color,
    label,
    available: Math.max(0, capacity - enrolled),
  };
}
