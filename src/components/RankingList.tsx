import { For, Show, createSignal } from "solid-js";

import {
  getRankingAlgorithmService,
  type RankedPlayer,
} from "~/services/ranking";
import type { RankingAlgorithm } from "~/types/app-state";
import { BinIcon } from "./BinIcon";

import "./RankingList.css";

type RankingListProps = {
  algorithm: RankingAlgorithm;
  onSelectPlayerHistory: (
    playerName: string,
    type: "all" | "losses" | "wins",
  ) => void;
  rankings: RankedPlayer[];
  onDeletePlayer?: (playerName: string) => void;
};

export function RankingList(props: RankingListProps) {
  const [contextMenu, setContextMenu] = createSignal<{
    x: number;
    y: number;
    playerName: string;
  } | null>(null);
  const rankingService = () => getRankingAlgorithmService(props.algorithm);

  return (
    <Show
      when={props.rankings.length > 0}
      fallback={<p class="ranking-empty-state">No players yet.</p>}
    >
      <div class="ranking-list-container" onClick={() => setContextMenu(null)}>
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
                      {rankingService().formatScoreWithUnit(player.score)}
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
              <BinIcon />
              &nbsp;Delete player
            </button>
          </div>
        </Show>
      </div>
    </Show>
  );
}
