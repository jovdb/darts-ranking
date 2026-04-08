import {
  createEmptyAppState,
  type AppState,
  type PlayedMatch,
  type Player,
} from "~/types/app-state";

type LegacyPlayedMatch = {
  datePlayedGmt: string;
  losingPlayer: string;
  winningPlayer: string;
};

export interface AppStorage {
  load(): AppState;
  save(state: AppState): void;
}

let memoryState = createEmptyAppState();

const clonePlayers = (players: Player[]): Player[] =>
  players.map((player) => ({ ...player }));

const clonePlayedMatches = (playedMatches: PlayedMatch[]): PlayedMatch[] =>
  playedMatches.map((playedMatch) => ({
    ...playedMatch,
    losingPlayers: [...playedMatch.losingPlayers],
  }));

const cloneState = (state: AppState): AppState => ({
  players: clonePlayers(state.players),
  playedMatches: clonePlayedMatches(state.playedMatches),
});

const isPlayer = (value: unknown): value is Player =>
  typeof value === "object" &&
  value !== null &&
  "name" in value &&
  typeof value.name === "string";

const isLegacyPlayedMatch = (value: unknown): value is LegacyPlayedMatch =>
  typeof value === "object" &&
  value !== null &&
  "datePlayedGmt" in value &&
  typeof value.datePlayedGmt === "string" &&
  "winningPlayer" in value &&
  typeof value.winningPlayer === "string" &&
  "losingPlayer" in value &&
  typeof value.losingPlayer === "string";

const isPlayedMatch = (value: unknown): value is PlayedMatch =>
  typeof value === "object" &&
  value !== null &&
  "datePlayedGmt" in value &&
  typeof value.datePlayedGmt === "string" &&
  "winningPlayer" in value &&
  typeof value.winningPlayer === "string" &&
  "losingPlayers" in value &&
  Array.isArray(value.losingPlayers) &&
  value.losingPlayers.every((playerName) => typeof playerName === "string");

const isAnyPlayedMatch = (value: unknown): value is PlayedMatch | LegacyPlayedMatch =>
  isPlayedMatch(value) || isLegacyPlayedMatch(value);

const normalizePlayedMatch = (
  playedMatch: PlayedMatch | LegacyPlayedMatch,
): PlayedMatch => {
  if ("losingPlayers" in playedMatch) {
    return {
      datePlayedGmt: playedMatch.datePlayedGmt,
      losingPlayers: [...playedMatch.losingPlayers],
      winningPlayer: playedMatch.winningPlayer,
    };
  }

  return {
    datePlayedGmt: playedMatch.datePlayedGmt,
    losingPlayers: [playedMatch.losingPlayer],
    winningPlayer: playedMatch.winningPlayer,
  };
};

const isAppState = (value: unknown): value is AppState =>
  typeof value === "object" &&
  value !== null &&
  "players" in value &&
  Array.isArray(value.players) &&
  value.players.every(isPlayer) &&
  "playedMatches" in value &&
  Array.isArray(value.playedMatches) &&
  value.playedMatches.every(isAnyPlayedMatch);

export function createLocalAppStorage(
  storageKey = "darts-ranking/app-state",
): AppStorage {
  return {
    load() {
      if (typeof window === "undefined") {
        return cloneState(memoryState);
      }

      try {
        const rawState = window.localStorage.getItem(storageKey);

        if (!rawState) {
          return cloneState(memoryState);
        }

        const parsedState: unknown = JSON.parse(rawState);

        if (isAppState(parsedState)) {
          memoryState = cloneState({
            players: parsedState.players,
            playedMatches: parsedState.playedMatches.map(normalizePlayedMatch),
          });
        }
      } catch {
        return cloneState(memoryState);
      }

      return cloneState(memoryState);
    },
    save(state) {
      memoryState = cloneState(state);

      if (typeof window === "undefined") {
        return;
      }

      try {
        window.localStorage.setItem(storageKey, JSON.stringify(memoryState));
      } catch {
        return;
      }
    },
  };
}
