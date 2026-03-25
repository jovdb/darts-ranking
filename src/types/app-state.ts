export type Player = {
  name: string;
};

export type PlayedMatch = {
  datePlayedGmt: string;
  winningPlayer: string;
  losingPlayer: string;
};

export type AppState = {
  players: Player[];
  playedMatches: PlayedMatch[];
};

export const createEmptyAppState = (): AppState => ({
  players: [],
  playedMatches: [],
});
