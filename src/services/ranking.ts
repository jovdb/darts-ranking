import type { PlayedMatch, Player } from "~/types/app-state";

import {
  calculateSoloTeamMatchPreview,
  DEFAULT_ELO_RATING,
  getKFactor,
} from "~/services/elo-scoring";

const rankingTieBreakers = new Map<string, number>();

export { DEFAULT_ELO_RATING } from "~/services/elo-scoring";

export type RankedPlayer = {
  isInPlacement: boolean;
  kFactor: number;
  losses: number;
  matchCount: number;
  name: string;
  rank: number;
  score: number;
  wins: number;
};

export type HistoricalMatchPlayer = {
  isInPlacement: boolean;
  kFactor: number;
  matchCount: number;
  name: string;
  rank: number;
  score: number;
};

export type HistoricalMatch = {
  datePlayedGmt: string;
  earnedPoints: number;
  losingPlayer: HistoricalMatchPlayer;
  losingPlayerRatingChange: number;
  winnerTotalScore: number;
  winningPlayer: HistoricalMatchPlayer;
};

export type RankingTimelineSnapshot = {
  datePlayedGmt: string;
  earnedPoints: number;
  losingPlayers: string[];
  matchIndex: number;
  playerRatingChanges: { playerName: string; ratingChange: number }[];
  rankings: RankedPlayer[];
  winningPlayer: string;
};

type LosingPlayerProgress = {
  player: HistoricalMatchPlayer;
  playerName: string;
  ratingChange: number;
};

export type RankingProgressMatch = {
  earnedPoints: number;
  losingPlayersBeforeMatch: LosingPlayerProgress[];
  match: PlayedMatch;
  matchIndex: number;
  rankingsAfterMatch: RankedPlayer[];
  rankingsBeforeMatch: RankedPlayer[];
  winnerTotalScoreAfterMatch: number;
  winningPlayerBeforeMatch: HistoricalMatchPlayer;
};

type PlayerTotals = {
  losses: number;
  matchCount: number;
  name: string;
  score: number;
  wins: number;
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
        score: DEFAULT_ELO_RATING,
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

const prepareMatches = (
  players: Player[],
  playedMatches: PlayedMatch[],
  asOf?: Date,
): PreparedMatch[] => {
  const playerNames = new Set(players.map((player) => player.name));
  const asOfTime = asOf?.getTime();

  return playedMatches
    .map((match, sourceIndex) => ({
      losingPlayers: [...new Set(match.losingPlayers)].filter((losingPlayer) => {
        return (
          playerNames.has(losingPlayer) && losingPlayer !== match.winningPlayer
        );
      }),
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
      isInPlacement: player.matchCount < 10,
      kFactor: getKFactor(player.matchCount),
      losses: player.losses,
      matchCount: player.matchCount,
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
      isInPlacement: true,
      kFactor: getKFactor(0),
      matchCount: 0,
      name: playerName,
      rank: 0,
      score: DEFAULT_ELO_RATING,
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

const toHistoricalMatches = (
  progressMatch: RankingProgressMatch,
): HistoricalMatch[] => {
  return progressMatch.losingPlayersBeforeMatch.map((losingPlayerProgress) => ({
    datePlayedGmt: progressMatch.match.datePlayedGmt,
    earnedPoints: progressMatch.earnedPoints,
    losingPlayer: losingPlayerProgress.player,
    losingPlayerRatingChange: losingPlayerProgress.ratingChange,
    winnerTotalScore: progressMatch.winnerTotalScoreAfterMatch,
    winningPlayer: progressMatch.winningPlayerBeforeMatch,
  }));
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
    winningPlayer: progressMatch.match.winningPlayer,
  };
};

export function* generateRankingProgress(
  players: Player[],
  playedMatches: PlayedMatch[],
  asOf = new Date(),
): Generator<RankingProgressMatch, RankedPlayer[]> {
  const totalsByPlayerName = createPlayerTotalsByName(players);
  const preparedMatches = prepareMatches(players, playedMatches, asOf);

  for (const preparedMatch of preparedMatches) {
    const rankingsBeforeMatch = buildRankingsFromTotals(totalsByPlayerName);
    const winningPlayerBeforeMatch = getHistoricalMatchPlayer(
      rankingsBeforeMatch,
      preparedMatch.match.winningPlayer,
    );
    const losingPlayersBeforeMatch = preparedMatch.losingPlayers.map(
      (playerName) => ({
        player: getHistoricalMatchPlayer(rankingsBeforeMatch, playerName),
        playerName,
        ratingChange: 0,
      }),
    );

    const matchPreview = calculateSoloTeamMatchPreview(
      winningPlayerBeforeMatch,
      losingPlayersBeforeMatch.map((losingPlayerProgress) => losingPlayerProgress.player),
    );
    const winningPlayerTotals = totalsByPlayerName.get(
      preparedMatch.match.winningPlayer,
    );

    if (!winningPlayerTotals) {
      continue;
    }

    winningPlayerTotals.score += matchPreview.soloRatingChange;
    winningPlayerTotals.wins += 1;
    winningPlayerTotals.matchCount += 1;

    losingPlayersBeforeMatch.forEach((losingPlayerProgress, index) => {
      const losingPlayerTotals = totalsByPlayerName.get(
        losingPlayerProgress.playerName,
      );

      if (!losingPlayerTotals) {
        return;
      }

      const ratingChange = matchPreview.losingPlayerChanges[index] ?? 0;
      losingPlayerTotals.score += ratingChange;
      losingPlayerTotals.losses += 1;
      losingPlayerTotals.matchCount += 1;
      losingPlayerProgress.ratingChange = ratingChange;
    });

    const rankingsAfterMatch = buildRankingsFromTotals(totalsByPlayerName);
    const progressMatch: RankingProgressMatch = {
      earnedPoints: matchPreview.soloRatingChange,
      losingPlayersBeforeMatch,
      match: preparedMatch.match,
      matchIndex: preparedMatch.sourceIndex,
      rankingsAfterMatch,
      rankingsBeforeMatch,
      winnerTotalScoreAfterMatch: winningPlayerTotals.score,
      winningPlayerBeforeMatch,
    };

    yield progressMatch;
  }

  return buildRankingsFromTotals(totalsByPlayerName);
}

export const formatScore = (score: number) => {
  return String(Math.round(score));
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
    .flatMap(toHistoricalMatches)
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
