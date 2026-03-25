import { For, Show, createMemo, createSignal } from "solid-js";

import { MatchHistoryRow } from "~/components/MatchHistoryRow";
import type { HistoricalMatch, RankedPlayer } from "~/services/ranking";
import type { PlayedMatch } from "~/types/app-state";

import "./PlayerGrid.css";

type PlayerGridProps = {
  historicalMatches: HistoricalMatch[];
  playedMatches: PlayedMatch[];
  players: RankedPlayer[];
};

const createMatchKey = (winnerName: string, loserName: string) => {
  return `${winnerName}:::${loserName}`;
};

export function PlayerGrid(props: PlayerGridProps) {
  const [selectedMatchup, setSelectedMatchup] = createSignal<{
    loserName: string;
    winnerName: string;
  } | null>(null);
  const [isViewingAllMatches, setIsViewingAllMatches] = createSignal(false);
  const [selectedPlayerSummary, setSelectedPlayerSummary] = createSignal<{
    playerName: string;
    type: "all" | "losses" | "wins";
  } | null>(null);

  const winsByMatchup = createMemo(() => {
    const wins = new Map<string, number>();

    for (const match of props.playedMatches) {
      const key = createMatchKey(match.winningPlayer, match.losingPlayer);
      wins.set(key, (wins.get(key) ?? 0) + 1);
    }

    return wins;
  });

  const getWins = (winnerName: string, loserName: string) => {
    return winsByMatchup().get(createMatchKey(winnerName, loserName)) ?? 0;
  };

  const winnerTotalWins = createMemo(() => {
    const totals = new Map<string, number>();

    for (const winner of props.players) {
      let totalWins = 0;

      for (const loser of props.players) {
        if (loser.name === winner.name) {
          continue;
        }

        totalWins += getWins(winner.name, loser.name);
      }

      totals.set(winner.name, totalWins);
    }

    return totals;
  });

  const loserTotalLosses = createMemo(() => {
    const totals = new Map<string, number>();

    for (const loser of props.players) {
      let totalLosses = 0;

      for (const winner of props.players) {
        if (winner.name === loser.name) {
          continue;
        }

        totalLosses += getWins(winner.name, loser.name);
      }

      totals.set(loser.name, totalLosses);
    }

    return totals;
  });

  const selectedMatchupHistory = createMemo(() => {
    const matchup = selectedMatchup();

    if (!matchup) {
      return [];
    }

    return props.historicalMatches.filter((match) => {
      return (
        match.winningPlayer.name === matchup.winnerName &&
        match.losingPlayer.name === matchup.loserName
      );
    });
  });

  const selectedPlayerSummaryHistory = createMemo(() => {
    const summary = selectedPlayerSummary();

    if (!summary) {
      return [];
    }

    return props.historicalMatches.filter((match) => {
      if (summary.type === "all") {
        return (
          match.winningPlayer.name === summary.playerName ||
          match.losingPlayer.name === summary.playerName
        );
      }

      if (summary.type === "wins") {
        return match.winningPlayer.name === summary.playerName;
      }

      return match.losingPlayer.name === summary.playerName;
    });
  });

  const openMatchupHistory = (winnerName: string, loserName: string) => {
    setIsViewingAllMatches(false);
    setSelectedPlayerSummary(null);
    setSelectedMatchup({ loserName, winnerName });
  };

  const openPlayerSummaryHistory = (
    playerName: string,
    type: "all" | "losses" | "wins",
  ) => {
    setIsViewingAllMatches(false);
    setSelectedMatchup(null);
    setSelectedPlayerSummary({ playerName, type });
  };

  const openAllMatchesHistory = () => {
    setSelectedMatchup(null);
    setSelectedPlayerSummary(null);
    setIsViewingAllMatches(true);
  };

  const closeMatchupHistory = () => {
    setSelectedMatchup(null);
  };

  const closeAllMatchesHistory = () => {
    setIsViewingAllMatches(false);
  };

  const closePlayerSummaryHistory = () => {
    setSelectedPlayerSummary(null);
  };

  return (
    <>
      <section class="card card-wide">
        <div class="card-header">
          <div>
            <h2>Matches grid</h2>
            <p class="card-copy">
              Winners across the top, losers down the side, with each cell showing
              recorded wins for that matchup.
            </p>
          </div>
        </div>

        <Show
          when={props.players.length > 0}
          fallback={
            <p class="helper-text">
              No matches available yet.
            </p>
          }
        >
          <div class="player-grid-scroll">
            <table class="player-grid-table">
              <thead>
                <tr>
                  <th class="player-grid-corner" scope="col">
                    Loser / Winner
                  </th>
                  <For each={props.players}>
                    {(player) => (
                      <th class="player-grid-header winners" scope="col">
                        <button
                          class="player-grid-axis-button"
                          type="button"
                          onClick={() =>
                            openPlayerSummaryHistory(player.name, "wins")
                          }
                        >
                          {player.name}
                        </button>
                      </th>
                    )}
                  </For>
                  <th class="player-grid-summary-header" scope="col">
                    Losses
                  </th>
                </tr>
              </thead>
              <tbody>
                <For each={props.players}>
                  {(loser) => (
                    <tr>
                      <th class="player-grid-row-header losers" scope="row">
                        <button
                          class="player-grid-axis-button"
                          type="button"
                          onClick={() =>
                            openPlayerSummaryHistory(loser.name, "losses")
                          }
                        >
                          {loser.name}
                        </button>
                      </th>
                      <For each={props.players}>
                        {(winner) => {
                          const wins = () => getWins(winner.name, loser.name);
                          const isSamePlayer = winner.name === loser.name;

                          return (
                            <td
                              class="player-grid-cell"
                              data-empty={wins() === 0}
                              data-self={isSamePlayer}
                            >
                              <Show
                                when={!isSamePlayer}
                                fallback={
                                  <button
                                    class="player-grid-cell-button"
                                    type="button"
                                    onClick={() =>
                                      openPlayerSummaryHistory(winner.name, "all")
                                    }
                                  >
                                    *
                                  </button>
                                }
                              >
                                <button
                                  class="player-grid-cell-button"
                                  type="button"
                                  onClick={() =>
                                    openMatchupHistory(winner.name, loser.name)
                                  }
                                >
                                  {wins()}
                                </button>
                              </Show>
                            </td>
                          );
                        }}
                      </For>
                      <td class="player-grid-summary-cell">
                        <button
                          class="player-grid-summary-button"
                          type="button"
                          onClick={() =>
                            openPlayerSummaryHistory(loser.name, "losses")
                          }
                        >
                          {loserTotalLosses().get(loser.name) ?? 0}
                        </button>
                      </td>
                    </tr>
                  )}
                </For>
                <tr>
                  <th
                    class="player-grid-summary-row-header player-grid-summary-header"
                    scope="row"
                  >
                    Wins
                  </th>
                  <For each={props.players}>
                    {(winner) => (
                      <td class="player-grid-summary-cell">
                        <button
                          class="player-grid-summary-button"
                          type="button"
                          onClick={() =>
                            openPlayerSummaryHistory(winner.name, "wins")
                          }
                        >
                          {winnerTotalWins().get(winner.name) ?? 0}
                        </button>
                      </td>
                    )}
                  </For>
                  <td class="player-grid-summary-corner">
                    <button
                      class="player-grid-summary-button"
                      type="button"
                      onClick={openAllMatchesHistory}
                    >
                      {props.playedMatches.length}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Show>
      </section>

      <Show when={isViewingAllMatches()}>
          <div
            class="popup-backdrop"
            role="presentation"
            onClick={closeAllMatchesHistory}
          >
            <section
              class="popup-card popup-card-wide"
              role="dialog"
              aria-modal="true"
              aria-labelledby="grid-all-matches-history-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div class="card-header popup-header">
                <div>
                  <h2 id="grid-all-matches-history-title">Played matches</h2>
                  <p class="card-copy">
                    Full list of recorded results from recent to oldest.
                  </p>
                </div>
              </div>

              <Show
                when={props.historicalMatches.length > 0}
                fallback={
                  <p class="helper-text">No matches have been recorded yet.</p>
                }
              >
                <ul class="match-history-list">
                  <For each={props.historicalMatches}>
                    {(match) => <MatchHistoryRow match={match} />}
                  </For>
                </ul>
              </Show>

              <div class="popup-footer">
                <button
                  class="secondary-button popup-footer-button"
                  type="button"
                  onClick={closeAllMatchesHistory}
                >
                  Close
                </button>
              </div>
            </section>
          </div>
      </Show>

      <Show when={selectedMatchup() !== null}>
          <div
            class="popup-backdrop"
            role="presentation"
            onClick={closeMatchupHistory}
          >
            <section
              class="popup-card popup-card-wide"
              role="dialog"
              aria-modal="true"
              aria-labelledby="matchup-history-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div class="card-header popup-header">
                <div>
                  <h2 id="matchup-history-title">
                    {selectedMatchup()?.winnerName} beat{" "}
                    {selectedMatchup()?.loserName}
                  </h2>
                  <p class="card-copy">
                    Full list of recorded results for this winner and loser
                    pairing, from recent to oldest.
                  </p>
                </div>
              </div>

              <Show
                when={selectedMatchupHistory().length > 0}
                fallback={
                  <p class="helper-text">
                    No matches have been recorded for this matchup yet.
                  </p>
                }
              >
                <ul class="match-history-list">
                  <For each={selectedMatchupHistory()}>
                    {(match) => <MatchHistoryRow match={match} />}
                  </For>
                </ul>
              </Show>

              <div class="popup-footer">
                <button
                  class="secondary-button popup-footer-button"
                  type="button"
                  onClick={closeMatchupHistory}
                >
                  Close
                </button>
              </div>
            </section>
          </div>
      </Show>

      <Show when={selectedPlayerSummary() !== null}>
          <div
            class="popup-backdrop"
            role="presentation"
            onClick={closePlayerSummaryHistory}
          >
            <section
              class="popup-card popup-card-wide"
              role="dialog"
              aria-modal="true"
              aria-labelledby="player-summary-history-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div class="card-header popup-header">
                <div>
                  <h2 id="player-summary-history-title">
                    {selectedPlayerSummary()?.playerName}{" "}
                    {selectedPlayerSummary()?.type === "all"
                      ? "matches"
                      : selectedPlayerSummary()?.type}
                  </h2>
                  <p class="card-copy">
                    Full list of recorded{" "}
                    {selectedPlayerSummary()?.type === "all"
                      ? "matches"
                      : selectedPlayerSummary()?.type} for{" "}
                    {selectedPlayerSummary()?.playerName}, from recent to oldest.
                  </p>
                </div>
              </div>

              <Show
                when={selectedPlayerSummaryHistory().length > 0}
                fallback={
                  <p class="helper-text">
                    No{" "}
                    {selectedPlayerSummary()?.type === "all"
                      ? "matches"
                      : selectedPlayerSummary()?.type} have been recorded for{" "}
                    {selectedPlayerSummary()?.playerName} yet.
                  </p>
                }
              >
                <ul class="match-history-list">
                  <For each={selectedPlayerSummaryHistory()}>
                    {(match) => (
                      <MatchHistoryRow
                        focusedPlayerName={selectedPlayerSummary()?.playerName}
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
                  onClick={closePlayerSummaryHistory}
                >
                  Close
                </button>
              </div>
            </section>
          </div>
      </Show>
    </>
  );
}
