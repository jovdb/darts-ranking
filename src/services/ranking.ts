import {
  calculateEloHistoricalMatches,
  calculateRankings as calculateEloRankings,
  calculateEloRankingTimeline,
} from "~/services/elo-scoring";
import {
  calculatePercentWonHistoricalMatches,
  calculateRankings as calculatePercentWonRankings,
  calculatePercentWonRankingTimeline,
} from "~/services/percent-won-ranking";
import {
  getRankingAlgorithmService,
} from "~/services/ranking-algorithm";
import type { IRankingAlgorithmService } from "~/services/ranking-interfaces";
import type { PlayedMatch, Player, RankingAlgorithm } from "~/types/app-state";

export { DEFAULT_ELO_RATING } from "~/services/elo-scoring";
export type { PlayedMatch } from "~/types/app-state";

export type RankedPlayer = {
  isInPlacement: boolean;
  kFactor: number;
  losses: number;
  matchCount: number;
  name: string;
  rank: number;
  score: number;
  wins: number;
};

export type HistoricalMatchPlayer = {
  isInPlacement: boolean;
  kFactor: number;
  matchCount: number;
  name: string;
  rank: number;
  score: number;
};

export type HistoricalMatch = {
  datePlayedGmt: string;
  earnedPoints: number;
  losingPlayers: HistoricalMatchPlayer[];
  losingPlayerRatingChanges: number[];
  winnerTotalScore: number;
  winningPlayer: HistoricalMatchPlayer;
};

type LosingPlayerProgress = {
  player: HistoricalMatchPlayer;
  playerName: string;
  ratingChange: number;
};

export type RankingProgressMatch = {
  earnedPoints: number;
  losingPlayersBeforeMatch: LosingPlayerProgress[];
  match: PlayedMatch;
  matchIndex: number;
  rankingsAfterMatch: RankedPlayer[];
  rankingsBeforeMatch: RankedPlayer[];
  winnerTotalScoreAfterMatch: number;
  winningPlayerBeforeMatch: HistoricalMatchPlayer;
};

export type RankingTimelineSnapshot = {
  datePlayedGmt: string;
  earnedPoints: number;
  losingPlayers: string[];
  matchIndex: number;
  playerRatingChanges: { playerName: string; ratingChange: number }[];
  rankings: RankedPlayer[];
  rankingsBeforeMatch: RankedPlayer[];
  winningPlayer: string;
};

export const getRankingAlgorithmMetadata = (
  algorithm: RankingAlgorithm,
): IRankingAlgorithmService => {
  return getRankingAlgorithmService(algorithm);
};

export const formatScore = (
  score: number,
  algorithm: RankingAlgorithm = "elo",
) => {
  return getRankingAlgorithmMetadata(algorithm).formatScore(score);
};

export function calculateRankings(
  players: Player[],
  playedMatches: PlayedMatch[],
  algorithm: RankingAlgorithm = "elo",
  asOf = new Date(),
): RankedPlayer[] {
  if (algorithm === "percent-won") {
    return calculatePercentWonRankings(players, playedMatches, asOf);
  }

  return calculateEloRankings(players, playedMatches, asOf);
}

export function calculateHistoricalMatches(
  players: Player[],
  playedMatches: PlayedMatch[],
  algorithm: RankingAlgorithm = "elo",
): HistoricalMatch[] {
  if (algorithm === "percent-won") {
    return calculatePercentWonHistoricalMatches(players, playedMatches);
  }

  return calculateEloHistoricalMatches(players, playedMatches);
}

export function calculateRankingTimeline(
  players: Player[],
  playedMatches: PlayedMatch[],
  algorithm: RankingAlgorithm = "elo",
): RankingTimelineSnapshot[] {
  if (algorithm === "percent-won") {
    return calculatePercentWonRankingTimeline(players, playedMatches);
  }

  return calculateEloRankingTimeline(players, playedMatches);
}
