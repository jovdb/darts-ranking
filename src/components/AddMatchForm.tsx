import { For, Show, createMemo, createSignal } from "solid-js";
import {
  calculateSoloTeamMatchPreview,
  getKFactor,
  calculateExpectedSoloScore,
} from "~/services/elo-scoring";
import { formatScore, type RankedPlayer, type PlayedMatch } from "~/services/ranking";

import "./AddMatchForm.css";
import { BinIcon } from "./BinIcon";

type AddMatchFormProps = {
  error?: string;
  onCancel: () => void;
  onAddMatch: (selectedPlayerNames: string[], winnerName: string) => boolean;
  players: RankedPlayer[];
  playedMatches: PlayedMatch[];
};

type RatingPreviewRow = {
  label: string;
  ratingChange: number;
  tone: "negative" | "positive";
};

const formatPlayerLabel = (player: RankedPlayer) => {
  return `#${player.rank} ${player.name} (${formatScore(player.score)} rating)`;
};

const calculateExpectedWinPercentage = (player: RankedPlayer, allPlayers: RankedPlayer[]) => {
  const opponents = allPlayers.filter(p => p.name !== player.name);
  if (opponents.length === 0) return 0;

  // Calculate expected score against each opponent and average them
  const expectedScores = opponents.map(opponent =>
    calculateExpectedSoloScore(player.score, opponent.score)
  );

  const averageExpectedScore = expectedScores.reduce((sum, score) => sum + score, 0) / expectedScores.length;
  return Math.round(averageExpectedScore * 100);
};

const formatRatingChange = (value: number) => {
  const prefix = value >= 0 ? "+" : "";

  return `${prefix}${formatScore(value)} rating`;
};

const getRatingChangeTooltip = (
  playerName: string,
  winnerName: string,
  selectedPlayers: RankedPlayer[],
) => {
  const player = selectedPlayers.find((p) => p.name === playerName);
  const winner = selectedPlayers.find((p) => p.name === winnerName);

  if (!player || !winner) return "";

  const kFactor = getKFactor(player.matchCount);

  if (playerName === winnerName) {
    // Winner's tooltip - calculate average expected score across all opponents
    const opponents = selectedPlayers.filter((p) => p.name !== winnerName);
    const expectedScores = opponents.map((opponent) => {
      return calculateExpectedSoloScore(winner.score, opponent.score);
    });

    const averageExpectedScore = expectedScores.reduce((sum, score) => sum + score, 0) / expectedScores.length;
    const expectedPercentage = Math.round(averageExpectedScore * 100);
    const totalPoints = Math.round(kFactor * (1 - averageExpectedScore));

    return `(1 - ${expectedPercentage}%) of K${kFactor} = ${totalPoints} points`;
  } else {
    // Loser's tooltip - calculate expected score against winner
    const expectedScore = calculateExpectedSoloScore(winner.score, player.score);
    const expectedPercentage = Math.round(expectedScore * 100);
    const points = Math.round(kFactor * (expectedScore - 1));

    return `(1 - ${expectedPercentage}%) of K${kFactor} = ${points} points`;
  }
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

  const matchPreview = createMemo(() => {
    const selectedWinner = findPlayer(winnerName());
    const losingPlayers = selectedPlayers().filter(
      (player) => player.name !== winnerName(),
    );

    if (!selectedWinner || losingPlayers.length === 0) {
      return null;
    }

    return calculateSoloTeamMatchPreview(selectedWinner, losingPlayers);
  });

  const ratingPreviewRows = createMemo<RatingPreviewRow[]>(() => {
    const preview = matchPreview();

    if (!preview) {
      return [];
    }

    const rows: RatingPreviewRow[] = [
      {
        label: winnerName(),
        ratingChange: preview.soloRatingChange,
        tone: "positive",
      },
    ];

    let losingPlayerIndex = 0;

    selectedPlayers().forEach((player) => {
      if (player.name === winnerName()) {
        return;
      }

      rows.push({
        label: player.name,
        ratingChange: preview.losingPlayerChanges[losingPlayerIndex] ?? 0,
        tone: "negative",
      });
      losingPlayerIndex += 1;
    });

    return rows;
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
                <span>{formatPlayerLabel(player)}</span>
                <span class="selected-player-expected-win">
                  {calculateExpectedWinPercentage(player, selectedPlayers())}% win chance
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
                  <option value={player.name}>{formatPlayerLabel(player)}</option>
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

      <Show when={winnerName() && matchPreview()}>
        <fieldset class="winner-options">
          <legend class="field-label">Rating change preview</legend>
          <ul class="winner-preview-list">
            <For each={ratingPreviewRows()}>
              {(row) => (
                <li
                  class="winner-preview-item"
                  title={getRatingChangeTooltip(
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
                    {formatRatingChange(row.ratingChange)}
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
