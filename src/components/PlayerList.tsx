import { For, Show } from "solid-js";

import { formatScore, type RankedPlayer } from "~/services/ranking";

type PlayerListProps = {
  rankings: RankedPlayer[];
};

export function PlayerList(props: PlayerListProps) {
  return (
    <Show
      when={props.rankings.length > 0}
      fallback={
        <p class="empty-state">
          No players yet. Add the first competitor to start building the roster.
        </p>
      }
    >
      <ul class="player-items">
        <For each={props.rankings}>
          {(player) => (
            <li class="player-list-item">
              <span class="player-index">
                {String(player.rank).padStart(2, "0")}
              </span>
              <div class="player-details">
                <span class="player-name">{player.name}</span>
                <span class="player-record">
                  {player.wins} win{player.wins === 1 ? "" : "s"} /{" "}
                  {player.losses} loss
                  {player.losses === 1 ? "" : "es"}
                </span>
              </div>
              <div class="player-metrics">
                <span class="player-score">
                  {formatScore(player.score)} pts
                </span>
                <span class="difficulty-badge">L{player.difficultyLevel}</span>
              </div>
            </li>
          )}
        </For>
      </ul>
    </Show>
  );
}
