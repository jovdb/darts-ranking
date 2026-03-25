import type { PlayedMatch, Player } from "~/types/app-state";

const rankingTieBreakers = new Map<string, number>();

export type DifficultyLevel = 1 | 2 | 3;

export type RankedPlayer = {
  difficultyLevel: DifficultyLevel;
  losses: number;
  name: string;
  rank: number;
  score: number;
  wins: number;
};

export type HistoricalMatchPlayer = {
  difficultyLevel: DifficultyLevel;
  name: string;
  rank: number;
};

export type HistoricalMatch = {
  datePlayedGmt: string;
  earnedPoints: number;
  losingPlayer: HistoricalMatchPlayer;
  winnerTotalScore: number;
  winningPlayer: HistoricalMatchPlayer;
};

export type RankingTimelineSnapshot = {
  datePlayedGmt: string;
  earnedPoints: number;
  losingPlayer: string;
  matchIndex: number;
  rankings: RankedPlayer[];
  winningPlayer: string;
};

export type RankingProgressMatch = {
  earnedPoints: number;
  match: PlayedMatch;
  matchIndex: number;
  rankingsAfterMatch: RankedPlayer[];
  rankingsBeforeMatch: RankedPlayer[];
  losingPlayerBeforeMatch: HistoricalMatchPlayer;
  playedAtTime: number;
  winnerTotalScoreAfterMatch: number;
  winningPlayerBeforeMatch: HistoricalMatchPlayer;
};

type PlayerTotals = {
  losses: number;
  name: string;
  score: number;
  wins: number;
};

type PreparedMatch = {
  match: PlayedMatch;
  playedAt: Date;
  sourceIndex: number;
};

const WINDOW_IN_MONTHS = 3;

const subtractMonths = (value: Date, months: number) => {
  const nextValue = new Date(value);
  nextValue.setUTCMonth(nextValue.getUTCMonth() - months);
  return nextValue;
};

const createPlayerTotalsByName = (players: Player[]) => {
  return new Map(
    players.map((player) => [
      player.name,
      {
        losses: 0,
        name: player.name,
        score: 0,
        wins: 0,
      },
    ]),
  );
};

const getRankingTieBreaker = (playerName: string) => {
  const existingValue = rankingTieBreakers.get(playerName);

  if (existingValue !== undefined) {
    return existingValue;
  }

  const nextValue = Math.random();
  rankingTieBreakers.set(playerName, nextValue);
  return nextValue;
};

const getDifficultyThresholdRanks = (rankingsCount: number) => {
  return {
    topHalfRank: rankingsCount >= 4 ? Math.floor(rankingsCount * 0.5) : 0,
    topQuarterRank: rankingsCount >= 5 ? Math.floor(rankingsCount * 0.25) : 0,
  };
};

const getDifficultyLevelForRank = (
  rank: number,
  rankingsCount: number,
): DifficultyLevel => {
  const { topHalfRank, topQuarterRank } =
    getDifficultyThresholdRanks(rankingsCount);

  if (topQuarterRank > 0 && rank <= topQuarterRank) {
    return 3;
  }

  if (topHalfRank > 0 && rank <= topHalfRank) {
    return 2;
  }

  return 1;
};

export const calculateEarnedPoints = (
  winnerDifficultyLevel: DifficultyLevel,
  loserDifficultyLevel: DifficultyLevel,
) => {
  return Math.max(1, 1 + (loserDifficultyLevel - winnerDifficultyLevel));
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
      match,
      playedAt: new Date(match.datePlayedGmt),
      sourceIndex,
    }))
    .filter(({ match, playedAt }) => {
      return (
        playerNames.has(match.winningPlayer) &&
        playerNames.has(match.losingPlayer) &&
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
      difficultyLevel: 1 as DifficultyLevel,
      losses: player.losses,
      name: player.name,
      rank: 0,
      score: player.score,
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
  const rankedPlayers = sortedPlayers.map((player) => {
    if (previousScore === null || player.score !== previousScore) {
      currentRank += 1;
      previousScore = player.score;
    }

    return {
      ...player,
      rank: currentRank,
    };
  });

  const rankingsCount = currentRank;

  return rankedPlayers.map((player) => ({
    ...player,
    difficultyLevel: getDifficultyLevelForRank(player.rank, rankingsCount),
  }));
};

const getHistoricalMatchPlayer = (
  rankings: RankedPlayer[],
  playerName: string,
): HistoricalMatchPlayer => {
  const rankedPlayer = rankings.find((entry) => entry.name === playerName);

  if (!rankedPlayer) {
    return {
      difficultyLevel: 1,
      name: playerName,
      rank: 0,
    };
  }

  return {
    difficultyLevel: rankedPlayer.difficultyLevel,
    name: rankedPlayer.name,
    rank: rankedPlayer.rank,
  };
};

const applyProgressMatch = (
  totalsByPlayerName: Map<string, PlayerTotals>,
  progressMatch: Pick<
    RankingProgressMatch,
    "earnedPoints" | "match"
  >,
  direction: 1 | -1,
) => {
  const winningPlayer = totalsByPlayerName.get(progressMatch.match.winningPlayer);
  const losingPlayer = totalsByPlayerName.get(progressMatch.match.losingPlayer);

  if (!winningPlayer || !losingPlayer) {
    return;
  }

  winningPlayer.score += progressMatch.earnedPoints * direction;
  winningPlayer.wins += direction;
  losingPlayer.losses += direction;
};

const pruneExpiredMatches = (
  activeMatches: RankingProgressMatch[],
  totalsByPlayerName: Map<string, PlayerTotals>,
  windowStartTime: number,
) => {
  while (activeMatches[0] && activeMatches[0].playedAtTime < windowStartTime) {
    const expiredMatch = activeMatches.shift();

    if (!expiredMatch) {
      continue;
    }

    applyProgressMatch(totalsByPlayerName, expiredMatch, -1);
  }
};

const collectProgress = (
  players: Player[],
  playedMatches: PlayedMatch[],
  asOf = new Date(),
) => {
  const iterator = generateRankingProgress(players, playedMatches, asOf);
  const matches: RankingProgressMatch[] = [];

  for (;;) {
    const nextValue = iterator.next();

    if (nextValue.done) {
      return {
        finalRankings: nextValue.value,
        matches,
      };
    }

    matches.push(nextValue.value);
  }
};

const toHistoricalMatch = (progressMatch: RankingProgressMatch): HistoricalMatch => {
  return {
    datePlayedGmt: progressMatch.match.datePlayedGmt,
    earnedPoints: progressMatch.earnedPoints,
    losingPlayer: progressMatch.losingPlayerBeforeMatch,
    winnerTotalScore: progressMatch.winnerTotalScoreAfterMatch,
    winningPlayer: progressMatch.winningPlayerBeforeMatch,
  };
};

const toRankingTimelineSnapshot = (
  progressMatch: RankingProgressMatch,
): RankingTimelineSnapshot => {
  return {
    datePlayedGmt: progressMatch.match.datePlayedGmt,
    earnedPoints: progressMatch.earnedPoints,
    losingPlayer: progressMatch.match.losingPlayer,
    matchIndex: progressMatch.matchIndex,
    rankings: progressMatch.rankingsAfterMatch,
    winningPlayer: progressMatch.match.winningPlayer,
  };
};

export function* generateRankingProgress(
  players: Player[],
  playedMatches: PlayedMatch[],
  asOf = new Date(),
): Generator<RankingProgressMatch, RankedPlayer[]> {
  const totalsByPlayerName = createPlayerTotalsByName(players);
  const activeMatches: RankingProgressMatch[] = [];
  const preparedMatches = prepareMatches(players, playedMatches, asOf);

  for (const [matchIndex, preparedMatch] of preparedMatches.entries()) {
    const playedAtTime = preparedMatch.playedAt.getTime();
    const windowStartTime = subtractMonths(
      preparedMatch.playedAt,
      WINDOW_IN_MONTHS,
    ).getTime();

    pruneExpiredMatches(activeMatches, totalsByPlayerName, windowStartTime);

    const rankingsBeforeMatch = buildRankingsFromTotals(totalsByPlayerName);
    const winningPlayerBeforeMatch = getHistoricalMatchPlayer(
      rankingsBeforeMatch,
      preparedMatch.match.winningPlayer,
    );
    const losingPlayerBeforeMatch = getHistoricalMatchPlayer(
      rankingsBeforeMatch,
      preparedMatch.match.losingPlayer,
    );
    const earnedPoints = calculateEarnedPoints(
      winningPlayerBeforeMatch.difficultyLevel,
      losingPlayerBeforeMatch.difficultyLevel,
    );

    const progressMatch: RankingProgressMatch = {
      earnedPoints,
      match: preparedMatch.match,
      matchIndex,
      rankingsAfterMatch: [],
      rankingsBeforeMatch,
      losingPlayerBeforeMatch,
      playedAtTime,
      winnerTotalScoreAfterMatch: 0,
      winningPlayerBeforeMatch,
    };

    applyProgressMatch(totalsByPlayerName, progressMatch, 1);
    progressMatch.rankingsAfterMatch = buildRankingsFromTotals(totalsByPlayerName);
    progressMatch.winnerTotalScoreAfterMatch =
      progressMatch.rankingsAfterMatch.find(
        (player) => player.name === preparedMatch.match.winningPlayer,
      )?.score ?? earnedPoints;

    activeMatches.push(progressMatch);
    yield progressMatch;
  }

  const finalWindowStart = subtractMonths(asOf, WINDOW_IN_MONTHS).getTime();
  pruneExpiredMatches(activeMatches, totalsByPlayerName, finalWindowStart);

  return buildRankingsFromTotals(totalsByPlayerName);
}

export function* iterateHistoricalMatchesForPlayer(
  players: Player[],
  playedMatches: PlayedMatch[],
  playerName: string,
  asOf = new Date(),
): Generator<HistoricalMatch, RankedPlayer[]> {
  const iterator = generateRankingProgress(players, playedMatches, asOf);

  for (;;) {
    const nextValue = iterator.next();

    if (nextValue.done) {
      return nextValue.value;
    }

    if (
      nextValue.value.match.winningPlayer === playerName ||
      nextValue.value.match.losingPlayer === playerName
    ) {
      yield toHistoricalMatch(nextValue.value);
    }
  }
};

export const formatScore = (score: number) => {
  if (Number.isInteger(score)) {
    return String(score);
  }

  return score.toFixed(2).replace(/\.?0+$/, "");
};

export function calculateRankings(
  players: Player[],
  playedMatches: PlayedMatch[],
  asOf = new Date(),
): RankedPlayer[] {
  return collectProgress(players, playedMatches, asOf).finalRankings;
}

export function calculateHistoricalMatches(
  players: Player[],
  playedMatches: PlayedMatch[],
): HistoricalMatch[] {
  return collectProgress(players, playedMatches).matches
    .map(toHistoricalMatch)
    .reverse();
}

export function calculateRankingTimeline(
  players: Player[],
  playedMatches: PlayedMatch[],
): RankingTimelineSnapshot[] {
  return collectProgress(players, playedMatches).matches.map(
    toRankingTimelineSnapshot,
  );
}
