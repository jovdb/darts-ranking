import { For, Show, createMemo, createSignal } from "solid-js";
import type { IRankingScorePreviewRow } from "~/services/ranking-interfaces";
import {
  getRankingAlgorithmMetadata,
  type RankedPlayer,
  type PlayedMatch,
} from "~/services/ranking";
import type { RankingAlgorithm } from "~/types/app-state";

import "./AddMatchForm.css";
import { BinIcon } from "./BinIcon";

type AddMatchFormProps = {
  error?: string;
  onCancel: () => void;
  onAddMatch: (selectedPlayerNames: string[], winnerName: string) => boolean;
  players: RankedPlayer[];
  playedMatches: PlayedMatch[];
  rankingAlgorithm: RankingAlgorithm;
};

const formatPlayerLabel = (
  player: RankedPlayer,
  rankingAlgorithm: RankingAlgorithm,
) => {
  return getRankingAlgorithmMetadata(rankingAlgorithm).formatPlayerLabel(player);
};

const formatRatingChange = (value: number, rankingAlgorithm: RankingAlgorithm) => {
  return getRankingAlgorithmMetadata(rankingAlgorithm).formatScoreChange(value);
};

export function AddMatchForm(props: AddMatchFormProps) {
  const [selectedPlayerNames, setSelectedPlayerNames] = createSignal<string[]>(
    [],
  );
  const [playerToAdd, setPlayerToAdd] = createSignal("");
  const [winnerName, setWinnerName] = createSignal("");

  const findPlayer = (name: string) => {
    return props.players.find((player) => player.name === name);
  };

  const selectedPlayers = createMemo(() => {
    return selectedPlayerNames()
      .map((playerName) => findPlayer(playerName))
      .filter((player): player is RankedPlayer => Boolean(player));
  });

  const availablePlayers = createMemo(() => {
    const selectedNames = new Set(selectedPlayerNames());

    return props.players.filter((player) => !selectedNames.has(player.name));
  });

  const ratingPreviewRows = createMemo<IRankingScorePreviewRow[]>(() => {
    if (!winnerName()) {
      return [];
    }

    return getRankingAlgorithmMetadata(props.rankingAlgorithm).buildScoreChangePreviewRows(
      selectedPlayers(),
      winnerName(),
    );
  });

  const canConfirmMatch = createMemo(() => {
    return selectedPlayerNames().length >= 2 && winnerName().trim().length > 0;
  });

  const getLastMatchPlayers = createMemo(() => {
    if (props.playedMatches.length === 0) return null;

    const lastMatch = props.playedMatches[props.playedMatches.length - 1];
    return [lastMatch.winningPlayer, ...lastMatch.losingPlayers];
  });

  const handleRematch = () => {
    const lastMatchPlayers = getLastMatchPlayers();
    if (!lastMatchPlayers) return;

    // Clear current selection and add last match players
    setSelectedPlayerNames([]);
    setWinnerName("");

    // Add all players from last match
    lastMatchPlayers.forEach(playerName => {
      if (props.players.some(p => p.name === playerName)) {
        setSelectedPlayerNames(current => [...current, playerName]);
      }
    });
  };

  const addSelectedPlayer = (rawPlayerName: string) => {
    const nextPlayerName = rawPlayerName.trim();

    if (!nextPlayerName) {
      return;
    }

    if (selectedPlayerNames().includes(nextPlayerName)) {
      setPlayerToAdd("");
      return;
    }

    setSelectedPlayerNames((currentNames) => [...currentNames, nextPlayerName]);
    setPlayerToAdd("");
  };

  const removeSelectedPlayer = (playerName: string) => {
    setSelectedPlayerNames((currentNames) =>
      currentNames.filter((name) => name !== playerName),
    );

    if (winnerName() === playerName) {
      setWinnerName("");
    }
  };

  const handleSubmit = (event: SubmitEvent) => {
    event.preventDefault();

    const didAddMatch = props.onAddMatch(selectedPlayerNames(), winnerName());

    if (didAddMatch) {
      setSelectedPlayerNames([]);
      setPlayerToAdd("");
      setWinnerName("");
    }
  };

  return (
    <form class="match-form" onSubmit={handleSubmit}>
      <div class="selected-players-list">
        <label class="field-label">Players</label>

        <For each={selectedPlayers()}>
          {(player) => (
            <div class="selected-player-row">
              <button
                class="selected-player-button"
                classList={{ "is-winner": winnerName() === player.name }}
                type="button"
                onClick={() => setWinnerName(player.name)}
              >
                <span>{formatPlayerLabel(player, props.rankingAlgorithm)}</span>
                <span class="selected-player-expected-win">
                  {getRankingAlgorithmMetadata(props.rankingAlgorithm).getExpectedWinPercentage(player, selectedPlayers())}% win chance
                </span>
                <Show when={winnerName() === player.name}>
                  <span class="selected-player-winner-tag">Winner</span>
                </Show>
              </button>
              <button
                class="selected-player-delete"
                type="button"
                onClick={() => removeSelectedPlayer(player.name)}
                aria-label={`Remove ${player.name}`}
              >
                <BinIcon />
              </button>
            </div>
          )}
        </For>

        <div class="selected-player-row selected-player-row-add">
          <div class="player-select-container">
            <select
              id="next-player"
              class="select-input"
              value={playerToAdd()}
              onInput={(event) => {
                const nextPlayerName = event.currentTarget.value;
                setPlayerToAdd(nextPlayerName);
                addSelectedPlayer(nextPlayerName);
              }}
            >
              <option value="">Select a player</option>
              <For each={availablePlayers()}>
                {(player) => (
                  <option value={player.name}>
                    {formatPlayerLabel(player, props.rankingAlgorithm)}
                  </option>
                )}
              </For>
            </select>
            <Show when={getLastMatchPlayers()}>
              <button
                class="rematch-button"
                type="button"
                onClick={handleRematch}
                title={`Rematch: ${getLastMatchPlayers()?.join(", ")}`}
              >
                Rematch
              </button>
            </Show>
          </div>
        </div>
      </div>

      <Show when={winnerName() && ratingPreviewRows().length > 0}>
        <fieldset class="winner-options">
          <legend class="field-label">
            {getRankingAlgorithmMetadata(props.rankingAlgorithm).getScoreChangePreviewTitle()}
          </legend>
          <ul class="winner-preview-list">
            <For each={ratingPreviewRows()}>
              {(row) => (
                <li
                  class="winner-preview-item"
                  title={getRankingAlgorithmMetadata(props.rankingAlgorithm).getScoreChangePreviewTooltip(
                    row.label,
                    winnerName(),
                    selectedPlayers(),
                  )}
                >
                  <span>{row.label}</span>
                  <span
                    class="winner-choice-points"
                    classList={{
                      "is-negative": row.tone === "negative",
                      "is-positive": row.tone === "positive",
                    }}
                  >
                    {row.scoreChange === null
                      ? ""
                      : formatRatingChange(row.scoreChange, props.rankingAlgorithm)}
                  </span>
                </li>
              )}
            </For>
          </ul>
        </fieldset>
      </Show>

      <Show when={selectedPlayerNames().length >= 2 && !winnerName()}>
        <p class="winner-selection-hint" role="status" aria-live="polite">
          Select one of the selected players as winner to enable Confirm match.
        </p>
      </Show>

      <div class="form-actions">
        <button
          class="primary-button"
          type="submit"
          disabled={!canConfirmMatch()}
        >
          Confirm match
        </button>
        <button
          class="secondary-button form-cancel-button"
          type="button"
          onClick={() => props.onCancel()}
        >
          Close
        </button>
      </div>

      <p
        class="form-message"
        classList={{
          "is-error": Boolean(props.error),
          "is-hidden": !props.error,
        }}
        role="alert"
        aria-live="polite"
      >
        {props.error ?? "\u00A0"}
      </p>
    </form>
  );
}
