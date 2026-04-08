import { formatScore, type HistoricalMatch } from "~/services/ranking";

import "./MatchHistoryRow.css";
import { For } from "solid-js";

type MatchHistoryRowProps = {
  focusedPlayerName?: string;
  match: HistoricalMatch;
};

const formatMatchDate = (value: string) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const formatHistoricalPlayerLabel = (player: {
  score: number;
  name: string;
  rank: number;
}) => {
  return `#${player.rank} ${player.name} (${formatScore(player.score)} rating)`;
};

export function MatchHistoryRow(props: MatchHistoryRowProps) {
  const focusedPlayerWon = () => {
    return props.match.winningPlayer.name === props.focusedPlayerName;
  };
  const pointsName = () => {
    if (!props.focusedPlayerName) {
      return props.match.winningPlayer.name;
    }

    return props.focusedPlayerName;
  };
  const pointsDetail = () => {
    if (!props.focusedPlayerName) {
      return `+${formatScore(props.match.earnedPoints)} rating`;
    }

    if (focusedPlayerWon()) {
      return `+${formatScore(props.match.earnedPoints)} rating`;
    }

    // Find the focused player's rating change if they're a loser
    const focusedPlayerIndex = props.match.losingPlayers.findIndex(
      (player) => player.name === props.focusedPlayerName,
    );
    if (focusedPlayerIndex >= 0) {
      return `${formatScore(props.match.losingPlayerRatingChanges[focusedPlayerIndex])} rating`;
    }

    return `+${formatScore(props.match.earnedPoints)} rating`;
  };
  const shouldShowTotal = () => {
    if (!props.focusedPlayerName) {
      return true;
    }

    return focusedPlayerWon();
  };

  return (
    <li class="match-history-item">
      <div class="match-history-top">
        <div class="match-history-main">
          <span class="match-history-winner">
            {formatHistoricalPlayerLabel(props.match.winningPlayer)}
          </span>
          <span class="match-history-separator">beat</span>
          <span>
            <For each={props.match.losingPlayers}>
              {(loser, index) => (
                <span>
                  {formatHistoricalPlayerLabel(loser)}
                  {index() < props.match.losingPlayers.length - 1 ? ", " : ""}
                </span>
              )}
            </For>
          </span>
        </div>
        <span class="match-history-date">
          {formatMatchDate(props.match.datePlayedGmt)}
        </span>
      </div>
      <div class="match-history-points">
        <div class="match-history-points-earned">
          <span class="match-history-points-name">{pointsName()}</span>
          <span>{pointsDetail()}</span>
        </div>
        {shouldShowTotal() ? (
          <span class="match-history-points-total">
            total: {formatScore(props.match.winnerTotalScore)} rating
          </span>
        ) : null}
      </div>
    </li>
  );
}
