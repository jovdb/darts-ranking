import { EloRankingAlgorithmService } from "~/services/elo-scoring";
import { PercentWonRankingAlgorithmService } from "~/services/percent-won-ranking";
import type { RankingAlgorithm } from "~/types/app-state";

export type RankingPlayerLabel = {
  name: string;
  rank: number;
  score: number;
};

export interface IRankingAlgorithmGeneral {
  readonly algorithm: RankingAlgorithm;
  readonly initialScore: number;
  readonly label: string;
  formatScore(score: number): string;
  formatScoreChange(score: number): string;
  formatScoreWithUnit(score: number): string;
  formatPlayerLabel(player: RankingPlayerLabel): string;
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
  formatHistoryPlayerLabel(player: RankingPlayerLabel): string;
  formatHistoryTotal(totalScore: number): string;
}

export interface IAddMatchAlgorithm {
  getScoreChangePreviewTitle(): string;
}

export interface IRankingAlgorithmService
  extends IRankingAlgorithmGeneral,
    IRankingAlgorithmGraph,
    IMatchHistoryRowAlgorithm,
    IAddMatchAlgorithm {}

const rankingAlgorithmServices: Record<RankingAlgorithm, IRankingAlgorithmService> = {
  elo: new EloRankingAlgorithmService(),
  "percent-won": new PercentWonRankingAlgorithmService(),
};

export const getRankingAlgorithmService = (
  algorithm: RankingAlgorithm,
): IRankingAlgorithmService => {
  return rankingAlgorithmServices[algorithm];
};
