import { For, Show, createMemo, createSignal } from "solid-js";

import type { PlayedMatch } from "~/types/app-state";

import {
  formatRematchCooldownLabel,
  getRematchRestriction,
} from "~/services/match-rules";
import { calculateEarnedPoints, type RankedPlayer } from "~/services/ranking";

import "./AddMatchForm.css";
import { BinIcon } from "./BinIcon";

type AddMatchFormProps = {
  error?: string;
  onCancel: () => void;
  onAddMatch: (selectedPlayerNames: string[], winnerName: string) => boolean;
  playedMatches: PlayedMatch[];
  players: RankedPlayer[];
};

type OpponentPreview = {
  availableAtLabel: string | null;
  cooldownLabel: string;
  isBlocked: boolean;
  message: string;
  opponentName: string;
  points: number | null;
};

const formatPlayerLabel = (player: RankedPlayer) => {
  return `#${player.rank} ${player.name} (L${player.difficultyLevel})`;
};

const formatPointLabel = (points: number) => {
  return `(+${points}${points === 1 ? "pt" : "pts"})`;
};

const formatDateLabel = (value: Date) => {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
};

export function AddMatchForm(props: AddMatchFormProps) {
  const [selectedPlayerNames, setSelectedPlayerNames] = createSignal<string[]>([]);
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

  const opponentPreview = createMemo<OpponentPreview[]>(() => {
    const selectedWinner = findPlayer(winnerName());

    if (!selectedWinner) {
      return [];
    }

    return selectedPlayers()
      .filter((player) => player.name !== selectedWinner.name)
      .map((player) => {
        const rematchRestriction = getRematchRestriction(
          props.playedMatches,
          selectedWinner.name,
          player.name,
        );

        if (rematchRestriction.isBlocked) {
          return {
            availableAtLabel: rematchRestriction.availableAt
              ? formatDateLabel(rematchRestriction.availableAt)
              : null,
            cooldownLabel: formatRematchCooldownLabel(),
            isBlocked: true,
            message: rematchRestriction.message,
            opponentName: player.name,
            points: null,
          };
        }

        return {
          availableAtLabel: null,
          cooldownLabel: formatRematchCooldownLabel(),
          isBlocked: false,
          message: "",
          opponentName: player.name,
          points: calculateEarnedPoints(
            selectedWinner.difficultyLevel,
            player.difficultyLevel,
          ),
        };
      });
  });

  const rematchRestrictions = createMemo(() => {
    return opponentPreview().filter((preview) => preview.isBlocked);
  });

  const winnerPointsPreview = createMemo(() => {
    const eligibleOpponents = opponentPreview().filter(
      (preview) => !preview.isBlocked && preview.points !== null,
    );

    if (eligibleOpponents.length === 0) {
      return null;
    }

    return eligibleOpponents.reduce((bestPreview, currentPreview) => {
      const bestPoints = bestPreview.points ?? 0;
      const currentPoints = currentPreview.points ?? 0;

      return currentPoints > bestPoints ? currentPreview : bestPreview;
    });
  });

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
        </div>
      </div>

      <Show when={winnerName() && winnerPointsPreview()}>
        <fieldset class="winner-options">
          <legend class="field-label">Winner points preview</legend>
          <Show when={winnerPointsPreview()}>
            {(preview) => (
              <p class="winner-single-preview">
                {winnerName()} earns
                <span class="winner-choice-points">
                  {formatPointLabel(preview().points ?? 0)}
                </span>
                from highest eligible opponent: {preview().opponentName}
              </p>
            )}
          </Show>
        </fieldset>
      </Show>

      <Show when={winnerName() && opponentPreview().length > 0}>
        <div class="restriction-list" role="status" aria-live="polite">
          <For each={opponentPreview()}>
            {(preview) => (
              <p class="restriction-message" classList={{ "is-blocked": preview.isBlocked }}>
                <strong>{preview.opponentName}:</strong>{" "}
                <Show
                  when={!preview.isBlocked}
                  fallback={
                    <span>
                      Not rematch possible yet (played in last {preview.cooldownLabel})
                      <Show when={preview.availableAtLabel}>
                        <span>. Available at {preview.availableAtLabel}</span>
                      </Show>
                    </span>
                  }
                >
                  <span>
                    Eligible now, winner earns {formatPointLabel(preview.points ?? 0)}.
                  </span>
                </Show>
              </p>
            )}
          </For>
        </div>
      </Show>

      <div class="form-actions">
        <button
          class="primary-button"
          type="submit"
          disabled={
            selectedPlayerNames().length < 2 ||
            !winnerName() ||
            rematchRestrictions().length > 0
          }
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
