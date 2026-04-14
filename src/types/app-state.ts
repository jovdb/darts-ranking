export type Player = {
  name: string;
};

export type RankingAlgorithm = "elo" | "percent-won";

export const DEFAULT_RANKING_ALGORITHM: RankingAlgorithm = "elo";

export type PlayedMatch = {
  datePlayedGmt: string;
  losingPlayers: string[];
  winningPlayer: string;
};

export type AppState = {
  players: Player[];
  playedMatches: PlayedMatch[];
  rankingAlgorithm: RankingAlgorithm;
};

export const createEmptyAppState = (): AppState => ({
  players: [],
  playedMatches: [],
  rankingAlgorithm: DEFAULT_RANKING_ALGORITHM,
});
