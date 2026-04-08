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
import { PlayerGrid } from "~/components/PlayerGrid";
import { RankingGraph } from "~/components/RankingGraph";
import { RankingList } from "~/components/RankingList";
import {
  calculateHistoricalMatches,
  calculateRankingTimeline,
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
  const [selectedPlayerHistory, setSelectedPlayerHistory] = createSignal<{
    playerName: string;
    type: "all" | "losses" | "wins";
  } | null>(null);
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
  const rankingTimeline = createMemo(() => {
    return calculateRankingTimeline(players(), playedMatches());
  });
  const selectedPlayerMatchHistory = createMemo(() => {
    const selectedHistory = selectedPlayerHistory();

    if (!selectedHistory) {
      return [];
    }

    return matchHistory().filter((match) => {
      if (selectedHistory.type === "wins") {
        return match.winningPlayer.name === selectedHistory.playerName;
      }

      if (selectedHistory.type === "losses") {
        return match.losingPlayer.name === selectedHistory.playerName;
      }

      return (
        match.winningPlayer.name === selectedHistory.playerName ||
        match.losingPlayer.name === selectedHistory.playerName
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
    setSelectedPlayerHistory(null);
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
    setSelectedPlayerHistory(null);
    setIsAddingMatch((isOpen) => !isOpen);
  };

  const toggleMatchHistory = () => {
    setIsAddingPlayer(false);
    setIsAddingMatch(false);
    setSelectedPlayerHistory(null);
    setIsViewingMatches((isOpen) => !isOpen);
  };

  const closePlayerMatchHistory = () => {
    setSelectedPlayerHistory(null);
  };

  const openPlayerMatchHistory = (
    playerName: string,
    type: "all" | "losses" | "wins" = "all",
  ) => {
    setIsAddingPlayer(false);
    setIsAddingMatch(false);
    setIsViewingMatches(false);
    setSelectedPlayerHistory({ playerName, type });
  };

  const handleAddMatch = (
    selectedPlayerNames: string[],
    winnerName: string,
  ) => {
    const uniqueSelectedPlayerNames = [...new Set(selectedPlayerNames)]
      .map((playerName) => playerName.trim())
      .filter((playerName) => playerName.length > 0);
    const trimmedWinnerName = winnerName.trim();

    if (uniqueSelectedPlayerNames.length < 2) {
      setMatchError("Select at least two players to start a match.");
      return false;
    }

    if (!uniqueSelectedPlayerNames.includes(trimmedWinnerName)) {
      setMatchError("Select which player won the match.");
      return false;
    }

    const playerNames = new Set(players().map((player) => player.name));

    if (!uniqueSelectedPlayerNames.every((playerName) => playerNames.has(playerName))) {
      setMatchError("All selected players must still exist in the roster.");
      return false;
    }

    const losingPlayers = uniqueSelectedPlayerNames.filter(
      (playerName) => playerName !== trimmedWinnerName,
    );

    setAppState((currentState) => ({
      ...currentState,
      playedMatches: [
        ...currentState.playedMatches,
        {
          datePlayedGmt: new Date().toISOString(),
          losingPlayers,
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
              <div class="ranking-header-actions">
                <button
                  class="player-count player-count-button"
                  type="button"
                  onClick={toggleMatchHistory}
                >
                  {playedMatches().length} match
                  {playedMatches().length === 1 ? "" : "es"}
                </button>
                <button
                  class="secondary-button ranking-header-button"
                  type="button"
                  disabled={players().length < 2}
                  onClick={toggleMatchForm}
                >
                  Add match
                </button>
              </div>
            </div>
            <RankingList
              onSelectPlayerHistory={openPlayerMatchHistory}
              rankings={rankings()}
            />
            <div class="ranking-actions">
              <button
                class="secondary-button ranking-action-button"
                type="button"
                onClick={togglePlayerForm}
              >
                {isAddingPlayer() ? "Cancel" : "Add player"}
              </button>
            </div>
          </section>

          <RankingGraph rankings={rankings()} timeline={rankingTimeline()} />

          <PlayerGrid
            historicalMatches={matchHistory()}
            playedMatches={playedMatches()}
            players={rankings()}
          />
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

        <Show when={selectedPlayerHistory() !== null}>
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
                    {selectedPlayerHistory()?.playerName}{" "}
                    {selectedPlayerHistory()?.type === "all"
                      ? "matches"
                      : selectedPlayerHistory()?.type}
                  </h2>
                  <p class="card-copy">
                    Full list of recorded{" "}
                    {selectedPlayerHistory()?.type === "all"
                      ? "results"
                      : selectedPlayerHistory()?.type}{" "}
                    for {selectedPlayerHistory()?.playerName}, from recent to
                    oldest.
                  </p>
                </div>
              </div>

              <Show
                when={selectedPlayerMatchHistory().length > 0}
                fallback={
                  <p class="helper-text">
                    {selectedPlayerHistory()?.playerName} has no recorded{" "}
                    {selectedPlayerHistory()?.type === "all"
                      ? "matches"
                      : selectedPlayerHistory()?.type}{" "}
                    yet.
                  </p>
                }
              >
                <ul class="match-history-list">
                  <For each={selectedPlayerMatchHistory()}>
                    {(match) => (
                      <MatchHistoryRow
                        focusedPlayerName={selectedPlayerHistory()?.playerName}
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
