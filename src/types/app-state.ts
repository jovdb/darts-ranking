export type Player = {
  name: string;
};

export type PlayedMatch = {
  datePlayedGmt: string;
  losingPlayers: string[];
  winningPlayer: string;
};

export type AppState = {
  players: Player[];
  playedMatches: PlayedMatch[];
};

export const createEmptyAppState = (): AppState => ({
  players: [],
  playedMatches: [],
});
