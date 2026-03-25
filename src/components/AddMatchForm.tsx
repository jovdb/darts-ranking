import { For, Show, createMemo, createSignal } from "solid-js";

import type { RankedPlayer } from "~/services/ranking";

import "./AddMatchForm.css";

type AddMatchFormProps = {
  error?: string;
  onAddMatch: (
    firstPlayerName: string,
    secondPlayerName: string,
    winnerName: string,
  ) => boolean;
  players: RankedPlayer[];
};

type MatchPreview = {
  firstPlayerPoints: number;
  secondPlayerPoints: number;
};

export function AddMatchForm(props: AddMatchFormProps) {
  const [firstPlayerName, setFirstPlayerName] = createSignal("");
  const [secondPlayerName, setSecondPlayerName] = createSignal("");
  const [winnerName, setWinnerName] = createSignal("");

  const findPlayer = (name: string) => {
    return props.players.find((player) => player.name === name);
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
      firstPlayerPoints: secondPlayer.difficultyLevel,
      secondPlayerPoints: firstPlayer.difficultyLevel,
    };
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
              {(player) => <option value={player.name}>{player.name}</option>}
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
              {(player) => <option value={player.name}>{player.name}</option>}
            </For>
          </select>
        </div>
      </div>

      <Show
        when={matchPreview() && selectedFirstPlayer() && selectedSecondPlayer()}
      >
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
                </span>
                <span class="winner-choice-points">
                  + {currentPreview().firstPlayerPoints} pt if{" "}
                  {selectedSecondPlayer()?.name} is L
                  {selectedSecondPlayer()?.difficultyLevel}
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
                </span>
                <span class="winner-choice-points">
                  + {currentPreview().secondPlayerPoints} pt if{" "}
                  {selectedFirstPlayer()?.name} is L
                  {selectedFirstPlayer()?.difficultyLevel}
                </span>
              </span>
            </label>
          </fieldset>
        )}
      </Show>

      <button class="primary-button" type="submit">
        Confirm match
      </button>

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
