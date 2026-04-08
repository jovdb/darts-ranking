import { For, Show } from "solid-js";

import { formatScore, type RankedPlayer } from "~/services/ranking";

import "./RankingList.css";

type RankingListProps = {
  onSelectPlayerHistory: (playerName: string, type: "all" | "losses" | "wins") => void;
  rankings: RankedPlayer[];
};

const getKFactorTitle = (player: RankedPlayer) => {
  if (player.isInPlacement) {
    return `Placement phase: ${player.matchCount}/10 matches played, K=${player.kFactor}`;
  }

  return `Veteran player: K=${player.kFactor}`;
};

export function RankingList(props: RankingListProps) {
  return (
    <Show
      when={props.rankings.length > 0}
      fallback={
        <p class="ranking-empty-state">
          No players yet.
        </p>
      }
    >
      <ul class="ranking-list">
        <For each={props.rankings}>
          {(player) => (
            <li
              class="ranking-item"
              onClick={() => props.onSelectPlayerHistory(player.name, "all")}
            >
              <div class="ranking-button">
                <span class="ranking-rank">{player.rank}</span>
                <div class="ranking-details">
                  <button
                    class="ranking-name-button"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      props.onSelectPlayerHistory(player.name, "all");
                    }}
                  >
                    {player.name}
                  </button>
                  <div class="ranking-record">
                    <button
                      class="ranking-inline-link"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        props.onSelectPlayerHistory(player.name, "wins");
                      }}
                    >
                      {player.wins} win{player.wins === 1 ? "" : "s"}
                    </button>
                    <span>/</span>
                    <button
                      class="ranking-inline-link"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        props.onSelectPlayerHistory(player.name, "losses");
                      }}
                    >
                      {player.losses} loss{player.losses === 1 ? "" : "es"}
                    </button>
                  </div>
                </div>
                <div class="ranking-metrics">
                  <span class="ranking-score">
                    {formatScore(player.score)} rating
                  </span>
                  <span
                    class="difficulty-badge"
                    title={getKFactorTitle(player)}
                  >
                    K{player.kFactor}
                  </span>
                </div>
              </div>
            </li>
          )}
        </For>
      </ul>
    </Show>
  );
}
