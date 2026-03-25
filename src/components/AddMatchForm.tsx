import { For, Show, createMemo, createSignal } from "solid-js";

import type { PlayedMatch } from "~/types/app-state";

import { getRematchRestriction } from "~/services/match-rules";
import { calculateEarnedPoints, type RankedPlayer } from "~/services/ranking";

import "./AddMatchForm.css";

type AddMatchFormProps = {
  error?: string;
  onCancel: () => void;
  onAddMatch: (
    firstPlayerName: string,
    secondPlayerName: string,
    winnerName: string,
  ) => boolean;
  playedMatches: PlayedMatch[];
  players: RankedPlayer[];
};

type MatchPreview = {
  firstPlayerPoints: number;
  secondPlayerPoints: number;
};

const formatPlayerLabel = (player: RankedPlayer) => {
  return `#${player.rank} ${player.name} (L${player.difficultyLevel})`;
};

const formatPointLabel = (points: number) => {
  return `(+${points}${points === 1 ? "pt" : "pts"})`;
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function AddMatchForm(props: AddMatchFormProps) {
  const [firstPlayerName, setFirstPlayerName] = createSignal("");
  const [secondPlayerName, setSecondPlayerName] = createSignal("");
  const [winnerName, setWinnerName] = createSignal("");

  const findPlayer = (name: string) => {
    return props.players.find((player) => player.name === name);
  };

  const formatSecondPlayerLabel = (player: RankedPlayer) => {
    const firstPlayer = firstPlayerName();

    if (!firstPlayer) {
      return formatPlayerLabel(player);
    }

    const rematchRestriction = getRematchRestriction(
      props.playedMatches,
      firstPlayer,
      player.name,
    );

    if (!rematchRestriction.isBlocked || !rematchRestriction.availableAt) {
      return formatPlayerLabel(player);
    }

    const daysUntilAvailable = Math.ceil(
      (rematchRestriction.availableAt.getTime() - Date.now()) / DAY_IN_MS,
    );
    const safeDaysUntilAvailable = Math.max(1, daysUntilAvailable);

    return `${formatPlayerLabel(player)} (possible in ${safeDaysUntilAvailable} day${safeDaysUntilAvailable === 1 ? "" : "s"})`;
  };

  const syncWinner = (
    nextFirstPlayerName: string,
    nextSecondPlayerName: string,
  ) => {
    if (
      winnerName() !== nextFirstPlayerName &&
      winnerName() !== nextSecondPlayerName
    ) {
      setWinnerName("");
    }
  };

  const selectedFirstPlayer = createMemo(() => findPlayer(firstPlayerName()));
  const selectedSecondPlayer = createMemo(() => findPlayer(secondPlayerName()));
  const matchPreview = createMemo<MatchPreview | null>(() => {
    const firstPlayer = selectedFirstPlayer();
    const secondPlayer = selectedSecondPlayer();

    if (
      !firstPlayer ||
      !secondPlayer ||
      firstPlayer.name === secondPlayer.name
    ) {
      return null;
    }

    return {
      firstPlayerPoints: calculateEarnedPoints(
        firstPlayer.difficultyLevel,
        secondPlayer.difficultyLevel,
      ),
      secondPlayerPoints: calculateEarnedPoints(
        secondPlayer.difficultyLevel,
        firstPlayer.difficultyLevel,
      ),
    };
  });
  const rematchRestriction = createMemo(() => {
    const firstPlayer = selectedFirstPlayer();
    const secondPlayer = selectedSecondPlayer();

    if (
      !firstPlayer ||
      !secondPlayer ||
      firstPlayer.name === secondPlayer.name
    ) {
      return null;
    }

    return getRematchRestriction(
      props.playedMatches,
      firstPlayer.name,
      secondPlayer.name,
    );
  });

  const handleFirstPlayerChange = (nextPlayerName: string) => {
    const nextSecondPlayerName =
      nextPlayerName === secondPlayerName() ? "" : secondPlayerName();

    setFirstPlayerName(nextPlayerName);
    setSecondPlayerName(nextSecondPlayerName);
    syncWinner(nextPlayerName, nextSecondPlayerName);
  };

  const handleSecondPlayerChange = (nextPlayerName: string) => {
    setSecondPlayerName(nextPlayerName);
    syncWinner(firstPlayerName(), nextPlayerName);
  };

  const handleSubmit = (event: SubmitEvent) => {
    event.preventDefault();

    const didAddMatch = props.onAddMatch(
      firstPlayerName(),
      secondPlayerName(),
      winnerName(),
    );

    if (didAddMatch) {
      setFirstPlayerName("");
      setSecondPlayerName("");
      setWinnerName("");
    }
  };

  return (
    <form class="match-form" onSubmit={handleSubmit}>
      <div class="match-grid">
        <div>
          <label class="field-label" for="first-player">
            First player
          </label>
          <select
            id="first-player"
            class="select-input"
            value={firstPlayerName()}
            onInput={(event) =>
              handleFirstPlayerChange(event.currentTarget.value)
            }
          >
            <option value="">Select a player</option>
            <For each={props.players}>
              {(player) => (
                <option value={player.name}>{formatPlayerLabel(player)}</option>
              )}
            </For>
          </select>
        </div>

        <div>
          <label class="field-label" for="second-player">
            Second player
          </label>
          <select
            id="second-player"
            class="select-input"
            value={secondPlayerName()}
            onInput={(event) =>
              handleSecondPlayerChange(event.currentTarget.value)
            }
          >
            <option value="">Select a player</option>
            <For
              each={props.players.filter(
                (player) => player.name !== firstPlayerName(),
              )}
            >
              {(player) => (
                <option value={player.name}>
                  {formatSecondPlayerLabel(player)}
                </option>
              )}
            </For>
          </select>
        </div>
      </div>

      <Show when={matchPreview()}>
        {(currentPreview) => (
          <fieldset class="winner-options">
            <legend class="field-label">Winner</legend>

            <label
              class="winner-choice"
              classList={{
                "is-selected": winnerName() === selectedFirstPlayer()?.name,
              }}
            >
              <input
                type="radio"
                name="winner"
                value={selectedFirstPlayer()?.name ?? ""}
                checked={winnerName() === selectedFirstPlayer()?.name}
                onInput={(event) => setWinnerName(event.currentTarget.value)}
              />
              <span class="winner-choice-details">
                <span class="winner-choice-name">
                  {selectedFirstPlayer()?.name}
                  <span class="winner-choice-points">
                    {formatPointLabel(currentPreview().firstPlayerPoints)}
                  </span>
                </span>
              </span>
            </label>

            <label
              class="winner-choice"
              classList={{
                "is-selected": winnerName() === selectedSecondPlayer()?.name,
              }}
            >
              <input
                type="radio"
                name="winner"
                value={selectedSecondPlayer()?.name ?? ""}
                checked={winnerName() === selectedSecondPlayer()?.name}
                onInput={(event) => setWinnerName(event.currentTarget.value)}
              />
              <span class="winner-choice-details">
                <span class="winner-choice-name">
                  {selectedSecondPlayer()?.name}
                  <span class="winner-choice-points">
                    {formatPointLabel(currentPreview().secondPlayerPoints)}
                  </span>
                </span>
              </span>
            </label>
          </fieldset>
        )}
      </Show>

      <Show when={rematchRestriction()?.isBlocked}>
        <p class="restriction-message" role="status" aria-live="polite">
          {rematchRestriction()?.message}
        </p>
      </Show>

      <div class="form-actions">
        <button
          class="primary-button"
          type="submit"
          disabled={Boolean(rematchRestriction()?.isBlocked)}
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
