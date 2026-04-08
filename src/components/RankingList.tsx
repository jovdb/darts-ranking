import { For, Show, createSignal } from "solid-js";

import { formatScore, type RankedPlayer } from "~/services/ranking";
import { BinIcon } from "./BinIcon";

import "./RankingList.css";

type RankingListProps = {
  onSelectPlayerHistory: (playerName: string, type: "all" | "losses" | "wins") => void;
  rankings: RankedPlayer[];
  onDeletePlayer?: (playerName: string) => void;
};

const getKFactorTitle = (player: RankedPlayer) => {
  if (player.isInPlacement) {
    return `Placement phase: ${player.matchCount}/10 matches played, K=${player.kFactor}`;
  }

  return `Veteran player: K=${player.kFactor}`;
};

export function RankingList(props: RankingListProps) {
  const [contextMenu, setContextMenu] = createSignal<{
    x: number;
    y: number;
    playerName: string;
  } | null>(null);

  return (
    <Show
      when={props.rankings.length > 0}
      fallback={
        <p class="ranking-empty-state">
          No players yet.
        </p>
      }
    >
      <div
        class="ranking-list-container"
        onClick={() => setContextMenu(null)}
      >
        <ul class="ranking-list">
          <For each={props.rankings}>
            {(player) => (
              <li
                class="ranking-item"
                onClick={() => props.onSelectPlayerHistory(player.name, "all")}
                onContextMenu={(event) => {
                  event.preventDefault();
                  if (props.onDeletePlayer) {
                    setContextMenu({
                      x: event.clientX,
                      y: event.clientY,
                      playerName: player.name,
                    });
                  }
                }}
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

        <Show when={contextMenu() !== null}>
          <div
            class="ranking-context-menu"
            style={{
              left: `${contextMenu()?.x ?? 0}px`,
              top: `${contextMenu()?.y ?? 0}px`,
            }}
          >
            <button
              type="button"
              class="ranking-context-menu-item"
              onClick={() => {
                if (props.onDeletePlayer && contextMenu()) {
                  props.onDeletePlayer(contextMenu()!.playerName);
                }
                setContextMenu(null);
              }}
            >
              <BinIcon />&nbsp;Delete player
            </button>
          </div>
        </Show>
      </div>
    </Show>
  );
}
