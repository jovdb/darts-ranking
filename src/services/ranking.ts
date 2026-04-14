import {
  getRankingAlgorithmService as resolveRankingAlgorithmService,
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

export const getRankingAlgorithmService = (
  algorithm: RankingAlgorithm,
): IRankingAlgorithmService => {
  return resolveRankingAlgorithmService(algorithm);
};

export const formatScore = (
  score: number,
  algorithm: RankingAlgorithm = "elo",
) => {
  return getRankingAlgorithmService(algorithm).formatScore(score);
};

export function calculateRankings(
  players: Player[],
  playedMatches: PlayedMatch[],
  algorithm: RankingAlgorithm = "elo",
  asOf = new Date(),
): RankedPlayer[] {
  return getRankingAlgorithmService(algorithm).calculateRankings(
    players,
    playedMatches,
    asOf,
  );
}

export function calculateHistoricalMatches(
  players: Player[],
  playedMatches: PlayedMatch[],
  algorithm: RankingAlgorithm = "elo",
): HistoricalMatch[] {
  return getRankingAlgorithmService(algorithm).calculateHistoricalMatches(
    players,
    playedMatches,
  );
}

export function calculateRankingTimeline(
  players: Player[],
  playedMatches: PlayedMatch[],
  algorithm: RankingAlgorithm = "elo",
): RankingTimelineSnapshot[] {
  return getRankingAlgorithmService(algorithm).calculateRankingTimeline(
    players,
    playedMatches,
  );
}
