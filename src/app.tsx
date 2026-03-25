import {
  Show,
  createEffect,
  createMemo,
  createSignal,
  onMount,
} from "solid-js";

import { AddMatchForm } from "~/components/AddMatchForm";
import { AddPlayerForm } from "~/components/AddPlayerForm";
import { RankingList } from "~/components/RankingList";
import { calculateRankings } from "~/services/ranking";
import { createLocalAppStorage } from "~/services/storage";
import { createEmptyAppState, type AppState } from "~/types/app-state";

import "./app.css";

const appStorage = createLocalAppStorage();

export default function App() {
  const [appState, setAppState] = createSignal<AppState>(createEmptyAppState());
  const [isAddingPlayer, setIsAddingPlayer] = createSignal(false);
  const [isAddingMatch, setIsAddingMatch] = createSignal(false);
  const [matchError, setMatchError] = createSignal("");
  const [playerError, setPlayerError] = createSignal("");
  const [hasLoaded, setHasLoaded] = createSignal(false);

  const players = () => appState().players;
  const playedMatches = () => appState().playedMatches;
  const rankings = createMemo(() => {
    return calculateRankings(players(), playedMatches(), new Date());
  });

  onMount(() => {
    setAppState(appStorage.load());
    setHasLoaded(true);
  });

  createEffect(() => {
    if (!hasLoaded()) {
      return;
    }

    appStorage.save(appState());
  });

  const handleAddPlayer = (rawName: string) => {
    const name = rawName.trim();

    if (name.length === 0) {
      setPlayerError("Enter a player name.");
      return false;
    }

    const normalizedName = name.toLowerCase();
    const hasDuplicate = players().some(
      (player) => player.name.toLowerCase() === normalizedName,
    );

    if (hasDuplicate) {
      setPlayerError("Player names must be unique.");
      return false;
    }

    setAppState((currentState) => ({
      ...currentState,
      players: [...currentState.players, { name }],
    }));
    setPlayerError("");

    return true;
  };

  const togglePlayerForm = () => {
    setPlayerError("");
    setIsAddingMatch(false);
    setIsAddingPlayer((isOpen) => !isOpen);
  };

  const handleAddPlayerFromRanking = (rawName: string) => {
    const didAddPlayer = handleAddPlayer(rawName);

    if (didAddPlayer) {
      setIsAddingPlayer(false);
    }

    return didAddPlayer;
  };

  const toggleMatchForm = () => {
    if (players().length < 2) {
      return;
    }

    setMatchError("");
    setIsAddingPlayer(false);
    setIsAddingMatch((isOpen) => !isOpen);
  };

  const handleAddMatch = (
    firstPlayerName: string,
    secondPlayerName: string,
    winnerName: string,
  ) => {
    const trimmedFirstPlayerName = firstPlayerName.trim();
    const trimmedSecondPlayerName = secondPlayerName.trim();
    const trimmedWinnerName = winnerName.trim();

    if (!trimmedFirstPlayerName || !trimmedSecondPlayerName) {
      setMatchError("Select two players to start a match.");
      return false;
    }

    if (trimmedFirstPlayerName === trimmedSecondPlayerName) {
      setMatchError("A match requires two different players.");
      return false;
    }

    if (
      trimmedWinnerName !== trimmedFirstPlayerName &&
      trimmedWinnerName !== trimmedSecondPlayerName
    ) {
      setMatchError("Select which player won the match.");
      return false;
    }

    const playerNames = new Set(players().map((player) => player.name));

    if (
      !playerNames.has(trimmedFirstPlayerName) ||
      !playerNames.has(trimmedSecondPlayerName)
    ) {
      setMatchError("Both selected players must still exist in the roster.");
      return false;
    }

    const losingPlayer =
      trimmedWinnerName === trimmedFirstPlayerName
        ? trimmedSecondPlayerName
        : trimmedFirstPlayerName;

    setAppState((currentState) => ({
      ...currentState,
      playedMatches: [
        ...currentState.playedMatches,
        {
          datePlayedGmt: new Date().toISOString(),
          losingPlayer,
          winningPlayer: trimmedWinnerName,
        },
      ],
    }));
    setIsAddingMatch(false);
    setMatchError("");

    return true;
  };

  return (
    <main class="app-shell">
      <section class="app-panel">
        <header class="app-intro">
          <p class="eyebrow">Darts Ranking</p>
          <h1>Ranking</h1>
          <p class="copy">
            Build a local roster, record matches, and keep the current ranking
            in sync with each result.
          </p>
        </header>

        <div class="app-grid">
          <section class="card card-wide">
            <div class="card-header">
              <div>
                <h2>Current ranking</h2>
                <p class="card-copy">
                  Recorded matches: {playedMatches().length}
                </p>
              </div>
              <span class="player-count">
                {playedMatches().length} match
                {playedMatches().length === 1 ? "" : "es"}
              </span>
            </div>
            <RankingList rankings={rankings()} />
            <div class="ranking-actions">
              <button
                class="secondary-button ranking-action-button"
                type="button"
                disabled={players().length < 2}
                onClick={toggleMatchForm}
              >
                Add match
              </button>
              <button
                class="secondary-button ranking-action-button"
                type="button"
                onClick={togglePlayerForm}
              >
                {isAddingPlayer() ? "Cancel" : "Add player"}
              </button>

              <Show when={players().length < 2}>
                <p class="helper-text ranking-helper-text">
                  Add at least two players before starting a match.
                </p>
              </Show>
            </div>
          </section>
        </div>

        <Show when={isAddingMatch()}>
          <div
            class="popup-backdrop"
            role="presentation"
            onClick={toggleMatchForm}
          >
            <section
              class="popup-card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="add-match-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div class="card-header popup-header">
                <div>
                  <h2 id="add-match-title">Start a match</h2>
                  <p class="card-copy">
                    Choose two players, preview the available points, and confirm
                    the winner.
                  </p>
                </div>
              </div>
              <AddMatchForm
                error={matchError()}
                onCancel={toggleMatchForm}
                onAddMatch={handleAddMatch}
                players={rankings()}
              />
            </section>
          </div>
        </Show>

        <Show when={isAddingPlayer()}>
          <div
            class="popup-backdrop"
            role="presentation"
            onClick={togglePlayerForm}
          >
            <section
              class="popup-card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="add-player-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div class="card-header popup-header">
                <div>
                  <h2 id="add-player-title">Add player</h2>
                </div>
              </div>
              <AddPlayerForm
                error={playerError()}
                onAddPlayer={handleAddPlayerFromRanking}
                onCancel={togglePlayerForm}
              />
            </section>
          </div>
        </Show>
      </section>
    </main>
  );
}
