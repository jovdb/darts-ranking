import { createEffect, createSignal, onMount } from "solid-js";

import { AddPlayerForm } from "~/components/AddPlayerForm";
import { PlayerList } from "~/components/PlayerList";
import { createLocalAppStorage } from "~/services/storage";
import { createEmptyAppState, type AppState } from "~/types/app-state";

import "./app.css";

const appStorage = createLocalAppStorage();

export default function App() {
  const [appState, setAppState] = createSignal<AppState>(createEmptyAppState());
  const [playerError, setPlayerError] = createSignal("");
  const [hasLoaded, setHasLoaded] = createSignal(false);

  const players = () => appState().players;

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

  return (
    <main class="app-shell">
      <section class="app-panel">
        <header class="app-intro">
          <p class="eyebrow">Darts Ranking</p>
          <h1>Players</h1>
          <p class="copy">
            Start with a local player roster. Match history and ranking can be
            layered onto the same state shape later.
          </p>
        </header>

        <div class="app-grid">
          <section class="card">
            <h2>Add a player</h2>
            <p class="card-copy">Names are stored locally in this browser.</p>
            <AddPlayerForm
              onAddPlayer={handleAddPlayer}
              error={playerError()}
            />
          </section>

          <section class="card">
            <div class="card-header">
              <h2>Current roster</h2>
              <span class="player-count">
                {players().length} player{players().length === 1 ? "" : "s"}
              </span>
            </div>
            <PlayerList players={players()} />
          </section>
        </div>
      </section>
    </main>
  );
}
