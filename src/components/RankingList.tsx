import { For, Show } from "solid-js";

import { formatScore, type RankedPlayer } from "~/services/ranking";

import "./RankingList.css";

type RankingListProps = {
  rankings: RankedPlayer[];
};

export function RankingList(props: RankingListProps) {
  return (
    <Show
      when={props.rankings.length > 0}
      fallback={
        <p class="ranking-empty-state">
          No players yet. Add the first competitor to start.
        </p>
      }
    >
      <ul class="ranking-list">
        <For each={props.rankings}>
          {(player) => (
            <li class="ranking-item">
              <span class="ranking-rank">#{player.rank}</span>
              <div class="ranking-details">
                <span class="ranking-name">{player.name}</span>
                <span class="ranking-record">
                  {player.wins} win{player.wins === 1 ? "" : "s"} /{" "}
                  {player.losses} loss
                  {player.losses === 1 ? "" : "es"}
                </span>
              </div>
              <div class="ranking-metrics">
                <span class="ranking-score">
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
