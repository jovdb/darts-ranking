import {
  createEmptyAppState,
  type AppState,
  type PlayedMatch,
  type Player,
} from "~/types/app-state";

export interface AppStorage {
  load(): AppState;
  save(state: AppState): void;
}

let memoryState = createEmptyAppState();

const clonePlayers = (players: Player[]): Player[] =>
  players.map((player) => ({ ...player }));

const clonePlayedMatches = (playedMatches: PlayedMatch[]): PlayedMatch[] =>
  playedMatches.map((playedMatch) => ({ ...playedMatch }));

const cloneState = (state: AppState): AppState => ({
  players: clonePlayers(state.players),
  playedMatches: clonePlayedMatches(state.playedMatches),
});

const isPlayer = (value: unknown): value is Player =>
  typeof value === "object" &&
  value !== null &&
  "name" in value &&
  typeof value.name === "string";

const isPlayedMatch = (value: unknown): value is PlayedMatch =>
  typeof value === "object" &&
  value !== null &&
  "datePlayedGmt" in value &&
  typeof value.datePlayedGmt === "string" &&
  "winningPlayer" in value &&
  typeof value.winningPlayer === "string" &&
  "losingPlayer" in value &&
  typeof value.losingPlayer === "string";

const isAppState = (value: unknown): value is AppState =>
  typeof value === "object" &&
  value !== null &&
  "players" in value &&
  Array.isArray(value.players) &&
  value.players.every(isPlayer) &&
  "playedMatches" in value &&
  Array.isArray(value.playedMatches) &&
  value.playedMatches.every(isPlayedMatch);

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
          memoryState = cloneState(parsedState);
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
