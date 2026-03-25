import { createSignal } from "solid-js";

import "./AddPlayerForm.css";

type AddPlayerFormProps = {
  error?: string;
  onAddPlayer: (name: string) => boolean;
  onCancel: () => void;
};

export function AddPlayerForm(props: AddPlayerFormProps) {
  const [name, setName] = createSignal("");

  const handleSubmit = (event: SubmitEvent) => {
    event.preventDefault();

    const didAddPlayer = props.onAddPlayer(name());

    if (didAddPlayer) {
      setName("");
    }
  };

  return (
    <form class="player-form" onSubmit={handleSubmit}>
      <label class="field-label" for="player-name">
        Player name
      </label>
      <input
        id="player-name"
        class="text-input"
        type="text"
        value={name()}
        onInput={(event) => setName(event.currentTarget.value)}
        placeholder="e.g. Alex"
        autocomplete="off"
      />
      <div class="form-actions">
        <button class="primary-button" type="submit">
          Add player
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
