import type { RankingAlgorithm } from "~/types/app-state";

export interface IRankingPlayerLabel {
  losses: number;
  matchCount: number;
  name: string;
  rank: number;
  score: number;
  wins: number;
}

export interface IRankingScorePreviewRow {
  label: string;
  scoreChange: number | null;
  tone: "negative" | "neutral" | "positive";
}

export interface IRankingAlgorithmGeneral {
  readonly algorithm: RankingAlgorithm;
  readonly initialScore: number;
  readonly label: string;
  formatScore(score: number): string;
  formatScoreChange(score: number): string;
  formatScoreWithUnit(score: number): string;
  formatPlayerLabel(player: IRankingPlayerLabel): string;
}

export interface IRankingAlgorithmGraph {
  formatAxisValue(value: number): string;
  formatGraphMatchSummary(
    winnerName: string,
    losingPlayers: string[],
    earnedScore: number,
  ): string;
  formatGraphPlayerChange(
    playerName: string,
    scoreBeforeMatch: number,
    scoreChange: number,
  ): string;
  getAxisTitle(axis: "x" | "y"): string;
  getGraphDescription(): string;
}

export interface IMatchHistoryRowAlgorithm {
  formatHistoryChange(scoreChange: number): string;
  formatHistoryPlayerLabel(player: IRankingPlayerLabel): string;
  formatHistoryTotal(totalScore: number): string;
}

export interface IAddMatchAlgorithm {
  buildScoreChangePreviewRows(
    selectedPlayers: IRankingPlayerLabel[],
    winnerName: string,
  ): IRankingScorePreviewRow[];
  getExpectedWinPercentage(
    player: IRankingPlayerLabel,
    selectedPlayers: IRankingPlayerLabel[],
  ): number;
  getScoreChangePreviewTooltip(
    playerName: string,
    winnerName: string,
    selectedPlayers: IRankingPlayerLabel[],
  ): string;
  getScoreChangePreviewTitle(): string;
}

export interface IRankingAlgorithmService
  extends IRankingAlgorithmGeneral,
    IRankingAlgorithmGraph,
    IMatchHistoryRowAlgorithm,
    IAddMatchAlgorithm {}