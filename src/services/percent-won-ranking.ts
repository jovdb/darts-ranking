import type { PlayedMatch, Player } from "~/types/app-state";
import type {
  IRankingAlgorithmService,
  IRankingPlayerLabel,
  IRankingScorePreviewRow,
} from "~/services/ranking-interfaces";
import type {
  HistoricalMatch,
  HistoricalMatchPlayer,
  RankedPlayer,
  RankingProgressMatch,
  RankingTimelineSnapshot,
} from "~/services/ranking";

const rankingTieBreakers = new Map<string, number>();

const getRankingTieBreaker = (playerName: string) => {
  const existingValue = rankingTieBreakers.get(playerName);

  if (existingValue !== undefined) {
    return existingValue;
  }

  const nextValue = Math.random();
  rankingTieBreakers.set(playerName, nextValue);
  return nextValue;
};

type PlayerTotals = {
  losses: number;
  matchCount: number;
  name: string;
  wins: number;
};

type LosingPlayerProgress = {
  player: HistoricalMatchPlayer;
  playerName: string;
  ratingChange: number;
};

type PreparedMatch = {
  losingPlayers: string[];
  match: PlayedMatch;
  playedAt: Date;
  sourceIndex: number;
};

const createPlayerTotalsByName = (players: Player[]) => {
  return new Map(
    players.map((player) => [
      player.name,
      {
        losses: 0,
        matchCount: 0,
        name: player.name,
        wins: 0,
      },
    ]),
  );
};

const calculateWinRate = (wins: number, matchCount: number) => {
  if (matchCount === 0) {
    return 0;
  }

  return (wins / matchCount) * 100;
};

const prepareMatches = (
  players: Player[],
  playedMatches: PlayedMatch[],
  asOf?: Date,
): PreparedMatch[] => {
  const playerNames = new Set(players.map((player) => player.name));
  const asOfTime = asOf?.getTime();

  return playedMatches
    .map((match, sourceIndex) => ({
      losingPlayers: [...new Set(match.losingPlayers)].filter(
        (losingPlayer) => {
          return (
            playerNames.has(losingPlayer) &&
            losingPlayer !== match.winningPlayer
          );
        },
      ),
      match,
      playedAt: new Date(match.datePlayedGmt),
      sourceIndex,
    }))
    .filter(({ losingPlayers, match, playedAt }) => {
      return (
        playerNames.has(match.winningPlayer) &&
        losingPlayers.length > 0 &&
        !Number.isNaN(playedAt.getTime()) &&
        (asOfTime === undefined || playedAt.getTime() <= asOfTime)
      );
    })
    .sort((leftMatch, rightMatch) => {
      const timeDifference =
        leftMatch.playedAt.getTime() - rightMatch.playedAt.getTime();

      if (timeDifference !== 0) {
        return timeDifference;
      }

      return leftMatch.sourceIndex - rightMatch.sourceIndex;
    });
};

const buildRankingsFromTotals = (
  totalsByPlayerName: Map<string, PlayerTotals>,
): RankedPlayer[] => {
  const sortedPlayers = [...totalsByPlayerName.values()]
    .map((player) => ({
      isInPlacement: false,
      kFactor: 0,
      losses: player.losses,
      matchCount: player.matchCount,
      name: player.name,
      rank: 0,
      score: calculateWinRate(player.wins, player.matchCount),
      wins: player.wins,
    }))
    .sort((leftPlayer, rightPlayer) => {
      if (rightPlayer.score !== leftPlayer.score) {
        return rightPlayer.score - leftPlayer.score;
      }

      return (
        getRankingTieBreaker(leftPlayer.name) -
        getRankingTieBreaker(rightPlayer.name)
      );
    });

  let previousScore: number | null = null;
  let currentRank = 0;

  return sortedPlayers.map((player) => {
    if (previousScore === null || player.score !== previousScore) {
      currentRank += 1;
      previousScore = player.score;
    }

    return {
      ...player,
      rank: currentRank,
    };
  });
};

const getHistoricalMatchPlayer = (
  rankings: RankedPlayer[],
  playerName: string,
): HistoricalMatchPlayer => {
  const rankedPlayer = rankings.find((entry) => entry.name === playerName);

  if (!rankedPlayer) {
    return {
      isInPlacement: false,
      kFactor: 0,
      matchCount: 0,
      name: playerName,
      rank: 0,
      score: 0,
    };
  }

  return {
    isInPlacement: rankedPlayer.isInPlacement,
    kFactor: rankedPlayer.kFactor,
    matchCount: rankedPlayer.matchCount,
    name: rankedPlayer.name,
    rank: rankedPlayer.rank,
    score: rankedPlayer.score,
  };
};

const collectProgress = (
  players: Player[],
  playedMatches: PlayedMatch[],
  asOf = new Date(),
) => {
  const totalsByPlayerName = createPlayerTotalsByName(players);
  const preparedMatches = prepareMatches(players, playedMatches, asOf);
  const matches: RankingProgressMatch[] = [];

  for (const preparedMatch of preparedMatches) {
    const rankingsBeforeMatch = buildRankingsFromTotals(totalsByPlayerName);
    const winningPlayerBeforeMatch = getHistoricalMatchPlayer(
      rankingsBeforeMatch,
      preparedMatch.match.winningPlayer,
    );
    const losingPlayersBeforeMatch: LosingPlayerProgress[] =
      preparedMatch.losingPlayers.map((playerName) => ({
        player: getHistoricalMatchPlayer(rankingsBeforeMatch, playerName),
        playerName,
        ratingChange: 0,
      }));
    const winningPlayerTotals = totalsByPlayerName.get(
      preparedMatch.match.winningPlayer,
    );

    if (!winningPlayerTotals) {
      continue;
    }

    winningPlayerTotals.wins += 1;
    winningPlayerTotals.matchCount += 1;

    losingPlayersBeforeMatch.forEach((losingPlayerProgress) => {
      const losingPlayerTotals = totalsByPlayerName.get(
        losingPlayerProgress.playerName,
      );

      if (!losingPlayerTotals) {
        return;
      }

      losingPlayerTotals.losses += 1;
      losingPlayerTotals.matchCount += 1;
    });

    const rankingsAfterMatch = buildRankingsFromTotals(totalsByPlayerName);
    const winningPlayerAfterMatch = rankingsAfterMatch.find(
      (player) => player.name === preparedMatch.match.winningPlayer,
    );
    const earnedPoints =
      (winningPlayerAfterMatch?.score ?? winningPlayerBeforeMatch.score) -
      winningPlayerBeforeMatch.score;

    losingPlayersBeforeMatch.forEach((losingPlayerProgress) => {
      const losingPlayerAfterMatch = rankingsAfterMatch.find(
        (player) => player.name === losingPlayerProgress.playerName,
      );

      losingPlayerProgress.ratingChange =
        (losingPlayerAfterMatch?.score ?? losingPlayerProgress.player.score) -
        losingPlayerProgress.player.score;
    });

    matches.push({
      earnedPoints,
      losingPlayersBeforeMatch,
      match: preparedMatch.match,
      matchIndex: preparedMatch.sourceIndex,
      rankingsAfterMatch,
      rankingsBeforeMatch,
      winnerTotalScoreAfterMatch:
        winningPlayerAfterMatch?.score ?? winningPlayerBeforeMatch.score,
      winningPlayerBeforeMatch,
    });
  }

  return {
    finalRankings: buildRankingsFromTotals(totalsByPlayerName),
    matches,
  };
};

const toHistoricalMatch = (progressMatch: RankingProgressMatch): HistoricalMatch => {
  return {
    datePlayedGmt: progressMatch.match.datePlayedGmt,
    earnedPoints: progressMatch.earnedPoints,
    losingPlayers: progressMatch.losingPlayersBeforeMatch.map(
      (losingPlayerProgress) => losingPlayerProgress.player,
    ),
    losingPlayerRatingChanges: progressMatch.losingPlayersBeforeMatch.map(
      (losingPlayerProgress) => losingPlayerProgress.ratingChange,
    ),
    winnerTotalScore: progressMatch.winnerTotalScoreAfterMatch,
    winningPlayer: progressMatch.winningPlayerBeforeMatch,
  };
};

const toRankingTimelineSnapshot = (
  progressMatch: RankingProgressMatch,
): RankingTimelineSnapshot => {
  const playerRatingChanges = [
    {
      playerName: progressMatch.winningPlayerBeforeMatch.name,
      ratingChange: progressMatch.earnedPoints,
    },
    ...progressMatch.losingPlayersBeforeMatch.map((losingPlayerProgress) => ({
      playerName: losingPlayerProgress.playerName,
      ratingChange: losingPlayerProgress.ratingChange,
    })),
  ];

  return {
    datePlayedGmt: progressMatch.match.datePlayedGmt,
    earnedPoints: progressMatch.earnedPoints,
    losingPlayers: progressMatch.losingPlayersBeforeMatch.map(
      (losingPlayerProgress) => losingPlayerProgress.playerName,
    ),
    matchIndex: progressMatch.matchIndex,
    playerRatingChanges,
    rankings: progressMatch.rankingsAfterMatch,
    rankingsBeforeMatch: progressMatch.rankingsBeforeMatch,
    winningPlayer: progressMatch.match.winningPlayer,
  };
};

export function calculateRankings(
  players: Player[],
  playedMatches: PlayedMatch[],
  asOf = new Date(),
): RankedPlayer[] {
  return collectProgress(players, playedMatches, asOf).finalRankings;
}

export function calculatePercentWonHistoricalMatches(
  players: Player[],
  playedMatches: PlayedMatch[],
): HistoricalMatch[] {
  return collectProgress(players, playedMatches).matches
    .map(toHistoricalMatch)
    .reverse();
}

export function calculatePercentWonRankingTimeline(
  players: Player[],
  playedMatches: PlayedMatch[],
): RankingTimelineSnapshot[] {
  return collectProgress(players, playedMatches).matches.map(
    toRankingTimelineSnapshot,
  );
}

export class PercentWonRankingAlgorithmService
  implements IRankingAlgorithmService
{
  readonly algorithm = "percent-won" as const;
  readonly initialScore = 0;
  readonly label = "Percent won";

  formatScore(score: number): string {
    return `${Math.round(score)}%`;
  }

  formatScoreChange(score: number): string {
    const prefix = score >= 0 ? "+" : "";

    return `${prefix}${Math.round(score)}%`;
  }

  formatScoreWithUnit(score: number): string {
    return `${this.formatScore(score)} won`;
  }

  formatPlayerLabel(player: IRankingPlayerLabel): string {
    return `#${player.rank} ${player.name} (${this.formatScoreWithUnit(player.score)})`;
  }

  formatAxisValue(value: number): string {
    return this.formatScore(value);
  }

  formatGraphMatchSummary(
    winnerName: string,
    losingPlayers: string[],
    earnedScore: number,
  ): string {
    return `${winnerName} beats ${losingPlayers.join(", ")}: ${this.formatScoreChange(earnedScore)}`;
  }

  formatGraphPlayerChange(
    playerName: string,
    scoreBeforeMatch: number,
    scoreChange: number,
  ): string {
    return `${playerName}: ${this.formatScoreWithUnit(scoreBeforeMatch)}, ${this.formatScoreChange(scoreChange)}`;
  }

  getAxisTitle(axis: "x" | "y"): string {
    if (axis === "y") {
      return "Percent won";
    }

    return "Matches played";
  }

  getGraphDescription(): string {
    return "Percent won progression by match step. The x-axis only advances when a match was played.";
  }

  formatHistoryChange(scoreChange: number): string {
    return this.formatScoreChange(scoreChange);
  }

  formatHistoryPlayerLabel(player: IRankingPlayerLabel): string {
    return this.formatPlayerLabel(player);
  }

  formatHistoryTotal(totalScore: number): string {
    return this.formatScoreWithUnit(totalScore);
  }

  getScoreChangePreviewTitle(): string {
    return "Score change preview";
  }

  calculateRankings(
    players: Player[],
    playedMatches: PlayedMatch[],
    asOf = new Date(),
  ): RankedPlayer[] {
    return calculateRankings(players, playedMatches, asOf);
  }

  calculateHistoricalMatches(
    players: Player[],
    playedMatches: PlayedMatch[],
  ): HistoricalMatch[] {
    return calculatePercentWonHistoricalMatches(players, playedMatches);
  }

  calculateRankingTimeline(
    players: Player[],
    playedMatches: PlayedMatch[],
  ): RankingTimelineSnapshot[] {
    return calculatePercentWonRankingTimeline(players, playedMatches);
  }

  buildScoreChangePreviewRows(
    players: Player[],
    playedMatches: PlayedMatch[],
    selectedPlayers: IRankingPlayerLabel[],
    winnerName: string,
  ): IRankingScorePreviewRow[] {
    if (selectedPlayers.length < 2) {
      return [];
    }

    const losingPlayers = selectedPlayers
      .filter((selectedPlayer) => selectedPlayer.name !== winnerName)
      .map((selectedPlayer) => selectedPlayer.name);

    if (losingPlayers.length === 0) {
      return [];
    }

    const playersForCalculation: Player[] = players.map((player) => ({
      name: player.name,
    }));
    const baseRankings = this.calculateRankings(playersForCalculation, playedMatches);
    const projectedRankings = this.calculateRankings(playersForCalculation, [
      ...playedMatches,
      {
        datePlayedGmt: new Date().toISOString(),
        losingPlayers,
        winningPlayer: winnerName,
      },
    ]);

    return selectedPlayers.map((selectedPlayer) => {
      const currentScore =
        baseRankings.find((player) => player.name === selectedPlayer.name)?.score ??
        selectedPlayer.score;
      const projectedScore =
        projectedRankings.find((player) => player.name === selectedPlayer.name)
          ?.score ?? currentScore;
      const scoreChange = projectedScore - currentScore;

      return {
        label: selectedPlayer.name,
        projectedScore,
        scoreChange: scoreChange === 0 ? null : scoreChange,
        tone:
          scoreChange > 0 ? "positive" : scoreChange < 0 ? "negative" : "neutral",
      };
    });
  }

  getExpectedWinPercentage(
    player: IRankingPlayerLabel,
    selectedPlayers: IRankingPlayerLabel[],
  ): number {
    if (selectedPlayers.length < 2) {
      return 0;
    }

    return Math.round(player.score);
  }

  getScoreChangePreviewTooltip(
    playerName: string,
    winnerName: string,
    selectedPlayers: IRankingPlayerLabel[],
  ): string {
    if (playerName !== winnerName) {
      return "";
    }

    const winner = selectedPlayers.find(
      (selectedPlayer) => selectedPlayer.name === winnerName,
    );

    if (!winner) {
      return "";
    }

    const currentScore = winner.score;
    const nextScore = ((winner.wins + 1) / (winner.matchCount + 1)) * 100;
    const delta = nextScore - currentScore;

    return `${winner.name}: ${this.formatScore(currentScore)} -> ${this.formatScore(nextScore)} (${this.formatScoreChange(delta)})`;
  }
}
