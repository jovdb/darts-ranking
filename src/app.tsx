import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  onMount,
} from "solid-js";

import { AddMatchForm } from "~/components/AddMatchForm";
import { AddPlayerForm } from "~/components/AddPlayerForm";
import { MatchHistoryRow } from "~/components/MatchHistoryRow";
import { RankingList } from "~/components/RankingList";
import { getRematchRestriction } from "~/services/match-rules";
import {
  calculateHistoricalMatches,
  calculateRankings,
} from "~/services/ranking";
import { createLocalAppStorage } from "~/services/storage";
import { createEmptyAppState, type AppState } from "~/types/app-state";

import "./app.css";

const appStorage = createLocalAppStorage();

export default function App() {
  const [appState, setAppState] = createSignal<AppState>(createEmptyAppState());
  const [isAddingPlayer, setIsAddingPlayer] = createSignal(false);
  const [isAddingMatch, setIsAddingMatch] = createSignal(false);
  const [isViewingMatches, setIsViewingMatches] = createSignal(false);
  const [selectedPlayerName, setSelectedPlayerName] = createSignal("");
  const [matchError, setMatchError] = createSignal("");
  const [playerError, setPlayerError] = createSignal("");
  const [hasLoaded, setHasLoaded] = createSignal(false);

  const players = () => appState().players;
  const playedMatches = () => appState().playedMatches;
  const rankings = createMemo(() => {
    return calculateRankings(players(), playedMatches(), new Date());
  });
  const matchHistory = createMemo(() => {
    return calculateHistoricalMatches(players(), playedMatches());
  });
  const selectedPlayerMatchHistory = createMemo(() => {
    const playerName = selectedPlayerName();

    return matchHistory().filter((match) => {
      return (
        match.winningPlayer.name === playerName ||
        match.losingPlayer.name === playerName
      );
    });
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
    setIsViewingMatches(false);
    setSelectedPlayerName("");
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
    setIsViewingMatches(false);
    setSelectedPlayerName("");
    setIsAddingMatch((isOpen) => !isOpen);
  };

  const toggleMatchHistory = () => {
    setIsAddingPlayer(false);
    setIsAddingMatch(false);
    setSelectedPlayerName("");
    setIsViewingMatches((isOpen) => !isOpen);
  };

  const closePlayerMatchHistory = () => {
    setSelectedPlayerName("");
  };

  const openPlayerMatchHistory = (playerName: string) => {
    setIsAddingPlayer(false);
    setIsAddingMatch(false);
    setIsViewingMatches(false);
    setSelectedPlayerName(playerName);
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

    const rematchRestriction = getRematchRestriction(
      playedMatches(),
      trimmedFirstPlayerName,
      trimmedSecondPlayerName,
    );

    if (rematchRestriction.isBlocked) {
      setMatchError(rematchRestriction.message);
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
        <div class="app-grid">
          <section class="card card-wide">
            <div class="card-header">
              <div>
                <h1>Smartphoto darts ranking</h1>
              </div>
              <button
                class="player-count player-count-button"
                type="button"
                onClick={toggleMatchHistory}
              >
                {playedMatches().length} match
                {playedMatches().length === 1 ? "" : "es"}
              </button>
            </div>
            <RankingList
              onSelectPlayer={openPlayerMatchHistory}
              rankings={rankings()}
            />
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
                  <ul class="card-copy">
                    <li>x170</li>
                    <li>Single Out</li>
                    <li>First to 2 legs wins</li>
                    <li>Bull off</li>
                  </ul>
                </div>
              </div>
              <AddMatchForm
                error={matchError()}
                onCancel={toggleMatchForm}
                onAddMatch={handleAddMatch}
                playedMatches={playedMatches()}
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

        <Show when={isViewingMatches()}>
          <div
            class="popup-backdrop"
            role="presentation"
            onClick={toggleMatchHistory}
          >
            <section
              class="popup-card popup-card-wide"
              role="dialog"
              aria-modal="true"
              aria-labelledby="match-history-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div class="card-header popup-header">
                <div>
                  <h2 id="match-history-title">Played matches</h2>
                  <p class="card-copy">
                    Full list of recorded results from recent to oldest.
                  </p>
                </div>
              </div>

              <Show
                when={matchHistory().length > 0}
                fallback={
                  <p class="helper-text">No matches have been recorded yet.</p>
                }
              >
                <ul class="match-history-list">
                  <For each={matchHistory()}>
                    {(match) => <MatchHistoryRow match={match} />}
                  </For>
                </ul>
              </Show>

              <div class="popup-footer">
                <button
                  class="secondary-button popup-footer-button"
                  type="button"
                  onClick={toggleMatchHistory}
                >
                  Close
                </button>
              </div>
            </section>
          </div>
        </Show>

        <Show when={selectedPlayerName().length > 0}>
          <div
            class="popup-backdrop"
            role="presentation"
            onClick={closePlayerMatchHistory}
          >
            <section
              class="popup-card popup-card-wide"
              role="dialog"
              aria-modal="true"
              aria-labelledby="player-match-history-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div class="card-header popup-header">
                <div>
                  <h2 id="player-match-history-title">
                    {selectedPlayerName()} matches
                  </h2>
                  <p class="card-copy">
                    Full list of recorded results for {selectedPlayerName()},
                    from recent to oldest.
                  </p>
                </div>
              </div>

              <Show
                when={selectedPlayerMatchHistory().length > 0}
                fallback={
                  <p class="helper-text">
                    {selectedPlayerName()} has no recorded matches yet.
                  </p>
                }
              >
                <ul class="match-history-list">
                  <For each={selectedPlayerMatchHistory()}>
                    {(match) => (
                      <MatchHistoryRow
                        focusedPlayerName={selectedPlayerName()}
                        match={match}
                      />
                    )}
                  </For>
                </ul>
              </Show>

              <div class="popup-footer">
                <button
                  class="secondary-button popup-footer-button"
                  type="button"
                  onClick={closePlayerMatchHistory}
                >
                  Close
                </button>
              </div>
            </section>
          </div>
        </Show>
      </section>
    </main>
  );
}
