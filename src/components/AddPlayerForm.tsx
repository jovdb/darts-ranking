import { createSignal } from "solid-js";

type AddPlayerFormProps = {
  error?: string;
  onAddPlayer: (name: string) => boolean;
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
      <button class="primary-button" type="submit">
        Add player
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
