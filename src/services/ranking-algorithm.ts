import { DEFAULT_ELO_RATING } from "~/services/elo-scoring";
import type { RankingAlgorithm } from "~/types/app-state";

type RankingPlayerLabel = {
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

class EloRankingAlgorithmService implements IRankingAlgorithmService {
  readonly algorithm = "elo" as const;
  readonly initialScore = DEFAULT_ELO_RATING;
  readonly label = "ELO ranking";

  formatScore(score: number): string {
    return String(Math.round(score));
  }

  formatScoreChange(score: number): string {
    const prefix = score >= 0 ? "+" : "";

    return `${prefix}${this.formatScore(score)} rating`;
  }

  formatScoreWithUnit(score: number): string {
    return `${this.formatScore(score)} rating`;
  }

  formatPlayerLabel(player: RankingPlayerLabel): string {
    return `#${player.rank} ${player.name} (${this.formatScoreWithUnit(player.score)})`;
  }

  formatAxisValue(value: number): string {
    return this.formatScore(value);
  }

  formatGraphMatchSummary(
    winnerName: string,
    losingPlayers: string[],
    earnedScore: number,
  ): string {
    return `${winnerName} beats ${losingPlayers.join(", ")}: ${this.formatScoreChange(earnedScore)}`;
  }

  formatGraphPlayerChange(
    playerName: string,
    scoreBeforeMatch: number,
    scoreChange: number,
  ): string {
    return `${playerName}: ${this.formatScoreWithUnit(scoreBeforeMatch)}, ${this.formatScoreChange(scoreChange)}`;
  }

  getAxisTitle(axis: "x" | "y"): string {
    if (axis === "y") {
      return "Rating";
    }

    return "Matches played";
  }

  getGraphDescription(): string {
    return "Elo rating progression by match step. The x-axis only advances when a match was played.";
  }

  formatHistoryChange(scoreChange: number): string {
    return this.formatScoreChange(scoreChange);
  }

  formatHistoryPlayerLabel(player: RankingPlayerLabel): string {
    return this.formatPlayerLabel(player);
  }

  formatHistoryTotal(totalScore: number): string {
    return this.formatScoreWithUnit(totalScore);
  }

  getScoreChangePreviewTitle(): string {
    return "Rating change preview";
  }
}

class PercentWonRankingAlgorithmService implements IRankingAlgorithmService {
  readonly algorithm = "percent-won" as const;
  readonly initialScore = 0;
  readonly label = "Percent won";

  formatScore(score: number): string {
    return `${Math.round(score)}%`;
  }

  formatScoreChange(score: number): string {
    const prefix = score >= 0 ? "+" : "";

    return `${prefix}${Math.round(score)} pp`;
  }

  formatScoreWithUnit(score: number): string {
    return `${this.formatScore(score)} won`;
  }

  formatPlayerLabel(player: RankingPlayerLabel): string {
    return `#${player.rank} ${player.name} (${this.formatScoreWithUnit(player.score)})`;
  }

  formatAxisValue(value: number): string {
    return this.formatScore(value);
  }

  formatGraphMatchSummary(
    winnerName: string,
    losingPlayers: string[],
    earnedScore: number,
  ): string {
    return `${winnerName} beats ${losingPlayers.join(", ")}: ${this.formatScoreChange(earnedScore)}`;
  }

  formatGraphPlayerChange(
    playerName: string,
    scoreBeforeMatch: number,
    scoreChange: number,
  ): string {
    return `${playerName}: ${this.formatScoreWithUnit(scoreBeforeMatch)}, ${this.formatScoreChange(scoreChange)}`;
  }

  getAxisTitle(axis: "x" | "y"): string {
    if (axis === "y") {
      return "Percent won";
    }

    return "Matches played";
  }

  getGraphDescription(): string {
    return "Percent won progression by match step. The x-axis only advances when a match was played.";
  }

  formatHistoryChange(scoreChange: number): string {
    return this.formatScoreChange(scoreChange);
  }

  formatHistoryPlayerLabel(player: RankingPlayerLabel): string {
    return this.formatPlayerLabel(player);
  }

  formatHistoryTotal(totalScore: number): string {
    return this.formatScoreWithUnit(totalScore);
  }

  getScoreChangePreviewTitle(): string {
    return "Score change preview";
  }
}

const rankingAlgorithmServices: Record<RankingAlgorithm, IRankingAlgorithmService> = {
  elo: new EloRankingAlgorithmService(),
  "percent-won": new PercentWonRankingAlgorithmService(),
};

export const getRankingAlgorithmService = (
  algorithm: RankingAlgorithm,
): IRankingAlgorithmService => {
  return rankingAlgorithmServices[algorithm];
};
