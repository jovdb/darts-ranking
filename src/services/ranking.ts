import type { PlayedMatch, Player } from "~/types/app-state";

export type DifficultyLevel = 1 | 2 | 3;

export type RankedPlayer = {
  difficultyLevel: DifficultyLevel;
  losses: number;
  name: string;
  rank: number;
  score: number;
  wins: number;
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

const average = (values: number[]) => {
  if (values.length === 0) {
    return 0;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
};

const buildRankingsFromProcessedMatches = (
  players: Player[],
  processedMatches: ProcessedMatch[],
): RankedPlayer[] => {
  const scoresByPlayer = new Map(players.map((player) => [player.name, 0]));
  const winsByPlayer = new Map(players.map((player) => [player.name, 0]));
  const lossesByPlayer = new Map(players.map((player) => [player.name, 0]));
  const pointsByWinner = new Map<string, Map<string, number[]>>();

  for (const processedMatch of processedMatches) {
    const { earnedPoints, match } = processedMatch;
    const winnerBuckets =
      pointsByWinner.get(match.winningPlayer) ?? new Map<string, number[]>();
    const opponentPoints = winnerBuckets.get(match.losingPlayer) ?? [];

    opponentPoints.push(earnedPoints);
    winnerBuckets.set(match.losingPlayer, opponentPoints);
    pointsByWinner.set(match.winningPlayer, winnerBuckets);

    winsByPlayer.set(
      match.winningPlayer,
      (winsByPlayer.get(match.winningPlayer) ?? 0) + 1,
    );
    lossesByPlayer.set(
      match.losingPlayer,
      (lossesByPlayer.get(match.losingPlayer) ?? 0) + 1,
    );
  }

  for (const player of players) {
    const pointsByOpponent = pointsByWinner.get(player.name);

    if (!pointsByOpponent) {
      continue;
    }

    let totalScore = 0;

    for (const scores of pointsByOpponent.values()) {
      totalScore += average(scores);
    }

    scoresByPlayer.set(player.name, totalScore);
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

      return leftPlayer.name.localeCompare(rightPlayer.name);
    });

  const uniqueScoreCount = new Set(
    rankedPlayers.map((rankedPlayer) => rankedPlayer.score),
  ).size;
  const topHalfCount =
    uniqueScoreCount >= 3 ? Math.ceil(rankedPlayers.length * 0.5) : 0;
  const topQuarterCount =
    uniqueScoreCount >= 5 ? Math.ceil(rankedPlayers.length * 0.25) : 0;

  return rankedPlayers.map((rankedPlayer, index) => ({
    ...rankedPlayer,
    difficultyLevel: index < topQuarterCount ? 3 : index < topHalfCount ? 2 : 1,
    rank: index + 1,
  }));
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
