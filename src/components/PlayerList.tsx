import { For, Show } from "solid-js";

import type { Player } from "~/types/app-state";

type PlayerListProps = {
  players: Player[];
};

export function PlayerList(props: PlayerListProps) {
  return (
    <Show
      when={props.players.length > 0}
      fallback={
        <p class="empty-state">
          No players yet. Add the first competitor to start building the roster.
        </p>
      }
    >
      <ul class="player-items">
        <For each={props.players}>
          {(player, index) => (
            <li class="player-list-item">
              <span class="player-index">
                {String(index() + 1).padStart(2, "0")}
              </span>
              <span class="player-name">{player.name}</span>
            </li>
          )}
        </For>
      </ul>
    </Show>
  );
}
