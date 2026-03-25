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

type ProcessedMatch = {
  earnedPoints: number;
  match: PlayedMatch;
  playedAtTime: number;
};

const WINDOW_IN_MONTHS = 3;

const subtractMonths = (value: Date, months: number) => {
  const nextValue = new Date(value);
  nextValue.setUTCMonth(nextValue.getUTCMonth() - months);
  return nextValue;
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

const buildRankingsFromProcessedMatches = (
  players: Player[],
  processedMatches: ProcessedMatch[],
): RankedPlayer[] => {
  const scoresByPlayer = new Map(players.map((player) => [player.name, 0]));
  const winsByPlayer = new Map(players.map((player) => [player.name, 0]));
  const lossesByPlayer = new Map(players.map((player) => [player.name, 0]));

  for (const processedMatch of processedMatches) {
    const { earnedPoints, match } = processedMatch;
    scoresByPlayer.set(
      match.winningPlayer,
      (scoresByPlayer.get(match.winningPlayer) ?? 0) + earnedPoints,
    );

    winsByPlayer.set(
      match.winningPlayer,
      (winsByPlayer.get(match.winningPlayer) ?? 0) + 1,
    );
    lossesByPlayer.set(
      match.losingPlayer,
      (lossesByPlayer.get(match.losingPlayer) ?? 0) + 1,
    );
  }

  const rankedPlayers = players
    .map((player) => ({
      difficultyLevel: 1 as DifficultyLevel,
      losses: lossesByPlayer.get(player.name) ?? 0,
      name: player.name,
      rank: 0,
      score: scoresByPlayer.get(player.name) ?? 0,
      wins: winsByPlayer.get(player.name) ?? 0,
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

  const playedGamesInWindow = processedMatches.length;
  const topHalfCount =
    playedGamesInWindow >= 5 ? Math.ceil(rankedPlayers.length * 0.5) : 0;
  const topQuarterCount =
    playedGamesInWindow >= 10 ? Math.ceil(rankedPlayers.length * 0.25) : 0;

  let previousScore: number | null = null;
  let currentRank = 0;

  return rankedPlayers.map((rankedPlayer, index) => {
    if (previousScore === null || rankedPlayer.score !== previousScore) {
      currentRank += 1;
      previousScore = rankedPlayer.score;
    }

    return {
      ...rankedPlayer,
      difficultyLevel:
        index < topQuarterCount ? 3 : index < topHalfCount ? 2 : 1,
      rank: currentRank,
    };
  });
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
  const playerNames = new Set(players.map((player) => player.name));
  const sortedMatches = playedMatches
    .map((match) => ({
      match,
      playedAt: new Date(match.datePlayedGmt),
    }))
    .filter(
      ({ match, playedAt }) =>
        playerNames.has(match.winningPlayer) &&
        playerNames.has(match.losingPlayer) &&
        !Number.isNaN(playedAt.getTime()) &&
        playedAt.getTime() <= asOf.getTime(),
    )
    .sort((leftMatch, rightMatch) => {
      return leftMatch.playedAt.getTime() - rightMatch.playedAt.getTime();
    });

  const processedMatches: ProcessedMatch[] = [];

  for (const { match, playedAt } of sortedMatches) {
    const windowStartTime = subtractMonths(
      playedAt,
      WINDOW_IN_MONTHS,
    ).getTime();
    const rankingAtMatchTime = buildRankingsFromProcessedMatches(
      players,
      processedMatches.filter(
        (processedMatch) =>
          processedMatch.playedAtTime >= windowStartTime &&
          processedMatch.playedAtTime < playedAt.getTime(),
      ),
    );
    const losingPlayerDifficulty =
      rankingAtMatchTime.find(
        (rankedPlayer) => rankedPlayer.name === match.losingPlayer,
      )?.difficultyLevel ?? 1;

    processedMatches.push({
      earnedPoints: losingPlayerDifficulty,
      match,
      playedAtTime: playedAt.getTime(),
    });
  }

  const currentWindowStart = subtractMonths(asOf, WINDOW_IN_MONTHS).getTime();

  return buildRankingsFromProcessedMatches(
    players,
    processedMatches.filter(
      (processedMatch) =>
        processedMatch.playedAtTime >= currentWindowStart &&
        processedMatch.playedAtTime <= asOf.getTime(),
    ),
  );
}

export function calculateHistoricalMatches(
  players: Player[],
  playedMatches: PlayedMatch[],
): HistoricalMatch[] {
  const playerNames = new Set(players.map((player) => player.name));
  const sortedMatches = playedMatches
    .map((match) => ({
      match,
      playedAt: new Date(match.datePlayedGmt),
    }))
    .filter(
      ({ match, playedAt }) =>
        playerNames.has(match.winningPlayer) &&
        playerNames.has(match.losingPlayer) &&
        !Number.isNaN(playedAt.getTime()),
    )
    .sort((leftMatch, rightMatch) => {
      return leftMatch.playedAt.getTime() - rightMatch.playedAt.getTime();
    });

  const processedMatches: ProcessedMatch[] = [];
  const historicalMatches: HistoricalMatch[] = [];

  for (const { match, playedAt } of sortedMatches) {
    const windowStartTime = subtractMonths(
      playedAt,
      WINDOW_IN_MONTHS,
    ).getTime();
    const rankingAtMatchTime = buildRankingsFromProcessedMatches(
      players,
      processedMatches.filter(
        (processedMatch) =>
          processedMatch.playedAtTime >= windowStartTime &&
          processedMatch.playedAtTime < playedAt.getTime(),
      ),
    );
    const winningPlayerSnapshot = rankingAtMatchTime.find(
      (rankedPlayer) => rankedPlayer.name === match.winningPlayer,
    ) ?? {
      difficultyLevel: 1 as DifficultyLevel,
      name: match.winningPlayer,
      rank:
        players.findIndex((player) => player.name === match.winningPlayer) + 1,
    };
    const losingPlayerSnapshot = rankingAtMatchTime.find(
      (rankedPlayer) => rankedPlayer.name === match.losingPlayer,
    ) ?? {
      difficultyLevel: 1 as DifficultyLevel,
      name: match.losingPlayer,
      rank:
        players.findIndex((player) => player.name === match.losingPlayer) + 1,
    };

    const earnedPoints = losingPlayerSnapshot.difficultyLevel;

    processedMatches.push({
      earnedPoints,
      match,
      playedAtTime: playedAt.getTime(),
    });

    const rankingAfterMatch = buildRankingsFromProcessedMatches(
      players,
      processedMatches.filter(
        (processedMatch) =>
          processedMatch.playedAtTime >= windowStartTime &&
          processedMatch.playedAtTime <= playedAt.getTime(),
      ),
    );
    const winningPlayerAfterMatch = rankingAfterMatch.find(
      (rankedPlayer) => rankedPlayer.name === match.winningPlayer,
    ) ?? {
      ...winningPlayerSnapshot,
      score: earnedPoints,
    };

    historicalMatches.push({
      datePlayedGmt: match.datePlayedGmt,
      earnedPoints,
      losingPlayer: {
        difficultyLevel: losingPlayerSnapshot.difficultyLevel,
        name: losingPlayerSnapshot.name,
        rank: losingPlayerSnapshot.rank,
      },
      winnerTotalScore: winningPlayerAfterMatch.score,
      winningPlayer: {
        difficultyLevel: winningPlayerSnapshot.difficultyLevel,
        name: winningPlayerSnapshot.name,
        rank: winningPlayerSnapshot.rank,
      },
    });
  }

  return historicalMatches.reverse();
}
