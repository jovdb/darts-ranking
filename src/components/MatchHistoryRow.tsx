import { formatScore, type HistoricalMatch } from "~/services/ranking";

import "./MatchHistoryRow.css";

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
  difficultyLevel: number;
  name: string;
  rank: number;
}) => {
  return `#${player.rank} ${player.name} (L${player.difficultyLevel})`;
};

export function MatchHistoryRow(props: MatchHistoryRowProps) {
  const isFocusedPlayerView = () => Boolean(props.focusedPlayerName);
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
      return `+${props.match.earnedPoints} pt${props.match.earnedPoints === 1 ? "" : "s"}`;
    }

    if (focusedPlayerWon()) {
      return `+${props.match.earnedPoints} pt${props.match.earnedPoints === 1 ? "" : "s"}`;
    }

    return "lost";
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
          <span>{formatHistoricalPlayerLabel(props.match.losingPlayer)}</span>
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
            total: {formatScore(props.match.winnerTotalScore)} pts
          </span>
        ) : null}
      </div>
    </li>
  );
}