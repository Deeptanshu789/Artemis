/** Distinct series colors for interviewees on the radar chart (dark UI). */
export const PARTICIPANT_PALETTE = [
  "#5ec4b6",
  "#6f8fd4",
  "#e4b890",
  "#e07a6a",
  "#c4a035",
  "#9b7ad4",
  "#5ca8c4",
  "#d46f9b",
  "#7ac46f",
  "#c47a5c",
  "#72a0e4",
  "#d4c46f",
] as const;

export function participantColor(index: number): string {
  return PARTICIPANT_PALETTE[index % PARTICIPANT_PALETTE.length]!;
}
