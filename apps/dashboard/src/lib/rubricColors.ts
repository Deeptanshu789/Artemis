import type { SubScores } from "@artemis/shared";

/** Soft palette — same order as Trends stacked bars (bottom → top) */
export const PARAM_COLORS: Record<keyof SubScores, string> = {
  problem_solving: "#6eb8ae",
  communication: "#6f8fd4",
  structure: "#a89bc8",
  depth: "#e4b890",
  collaboration: "#d4927a",
  professionalism: "#c45c5c",
};
