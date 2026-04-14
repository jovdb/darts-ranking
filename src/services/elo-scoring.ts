import type {
  IRankingAlgorithmService,
  RankingPlayerLabel,
} from "~/services/ranking-algorithm";
import type { PlayedMatch, Player } from "~/types/app-state";
import type {
  HistoricalMatch,
  HistoricalMatchPlayer,
  RankedPlayer,
  RankingProgressMatch,
  RankingTimelineSnapshot,
} from "~/services/ranking";

export const DEFAULT_ELO_RATING = 1000;
export const PLACEMENT_MATCH_LIMIT = 8;
export const PLACEMENT_K_FACTOR = 50;
export const VETERAN_K_FACTOR = 32;
export const ELO_DIVISOR = 400;
export const MINIMUM_WIN_GAIN = 1;

export type EloParticipant = {
  matchCount: number;
  score: number;
};

export type EloMatchPreview = {
  expectedSoloScore: number;
  losingPlayerChanges: number[];
  soloKFactor: number;
  soloRatingChange: number;
  teamExpectedScore: number;
  teamRating: number;
};

export const getKFactor = (matchCount: number) => {
  return matchCount < PLACEMENT_MATCH_LIMIT
    ? PLACEMENT_K_FACTOR
    : VETERAN_K_FACTOR;
};

export const calculateExpectedSoloScore = (
  soloRating: number,
  teamRating: number,
) => {
  return 1 / (1 + 10 ** ((teamRating - soloRating) / ELO_DIVISOR));
};

const normalizeWinnerGain = (ratingChange: number) => {
  if (ratingChange > 0 && ratingChange < MINIMUM_WIN_GAIN) {
    return MINIMUM_WIN_GAIN;
  }

  return ratingChange;
};

export const calculateSoloTeamMatchPreview = (
  soloPlayer: EloParticipant,
  teamPlayers: EloParticipant[],
): EloMatchPreview => {
  const soloKFactor = getKFactor(soloPlayer.matchCount);
  let totalSoloRatingChange = 0;
  const losingPlayerChanges: number[] = [];
  let totalExpectedSoloScore = 0;
  const loserWeights: number[] = [];

  for (const loser of teamPlayers) {
    const expectedSoloScore = calculateExpectedSoloScore(
      soloPlayer.score,
      loser.score,
    );
    totalExpectedSoloScore += expectedSoloScore;

    // Winner's gain from this specific loser
    const gainFromThisLoser = soloKFactor * (1 - expectedSoloScore);
    totalSoloRatingChange += normalizeWinnerGain(gainFromThisLoser);

    // Calculate weight for loser using same formula as winner
    const loserKFactor = getKFactor(loser.matchCount);
    const loserWeight = loserKFactor * (1 - expectedSoloScore);
    loserWeights.push(loserWeight);
  }

  // Calculate total weight
  const totalWeight = loserWeights.reduce((sum, weight) => sum + weight, 0);

  // Distribute winner's points proportionally among losers (as negative)
  if (totalWeight > 0) {
    for (let i = 0; i < teamPlayers.length; i++) {
      const proportion = loserWeights[i] / totalWeight;
      const loserChange = - (proportion * totalSoloRatingChange);
      losingPlayerChanges.push(loserChange);
    }
  } else {
    // Fallback if no weights (shouldn't happen)
    const equalShare = -totalSoloRatingChange / teamPlayers.length;
    losingPlayerChanges.push(...Array(teamPlayers.length).fill(equalShare));
  }

  // For matches with > 2 players, divide earnings/losses by (#players - 1)
  // Total players = 1 (winner) + teamPlayers.length (losers)
  const totalPlayers = 1 + teamPlayers.length;
  if (totalPlayers > 2) {
    const divisor = totalPlayers - 1; // = number of losers
    totalSoloRatingChange /= divisor;
    for (let i = 0; i < losingPlayerChanges.length; i++) {
      losingPlayerChanges[i] /= divisor;
    }
  }

  const averageExpectedSoloScore =
    teamPlayers.length > 0 ? totalExpectedSoloScore / teamPlayers.length : 0;
  const averageTeamExpectedScore = 1 - averageExpectedSoloScore;
  const averageTeamRating =
    teamPlayers.length > 0
      ? teamPlayers.reduce((sum, player) => sum + player.score, 0) /
        teamPlayers.length
      : DEFAULT_ELO_RATING;

  return {
    expectedSoloScore: averageExpectedSoloScore,
    losingPlayerChanges,
    soloKFactor,
    soloRatingChange: totalSoloRatingChange,
    teamExpectedScore: averageTeamExpectedScore,
    teamRating: averageTeamRating,
  };
};

const rankingTieBreakers = new Map<string, number>();

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

const collectEloProgress = (
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
    const losingPlayersBeforeMatch = preparedMatch.losingPlayers.map(
      (playerName) => ({
        player: getHistoricalMatchPlayer(rankingsBeforeMatch, playerName),
        playerName,
        ratingChange: 0,
      }),
    );

    const matchPreview = calculateSoloTeamMatchPreview(
      winningPlayerBeforeMatch,
      losingPlayersBeforeMatch.map(
        (losingPlayerProgress) => losingPlayerProgress.player,
      ),
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

    matches.push({
      earnedPoints: matchPreview.soloRatingChange,
      losingPlayersBeforeMatch,
      match: preparedMatch.match,
      matchIndex: preparedMatch.sourceIndex,
      rankingsAfterMatch,
      rankingsBeforeMatch,
      winnerTotalScoreAfterMatch: winningPlayerTotals.score,
      winningPlayerBeforeMatch,
    });
  }

  return {
    finalRankings: buildRankingsFromTotals(totalsByPlayerName),
    matches,
  };
};

export function calculateEloRankings(
  players: Player[],
  playedMatches: PlayedMatch[],
  asOf = new Date(),
): RankedPlayer[] {
  return collectEloProgress(players, playedMatches, asOf).finalRankings;
}

export function calculateEloHistoricalMatches(
  players: Player[],
  playedMatches: PlayedMatch[],
): HistoricalMatch[] {
  return collectEloProgress(players, playedMatches).matches
    .map(toHistoricalMatch)
    .reverse();
}

export function calculateEloRankingTimeline(
  players: Player[],
  playedMatches: PlayedMatch[],
): RankingTimelineSnapshot[] {
  return collectEloProgress(players, playedMatches).matches.map(
    toRankingTimelineSnapshot,
  );
}

export const calculateEloExpectedWinPercentage = (
  player: { name: string; score: number },
  allPlayers: { name: string; score: number }[],
) => {
  const opponents = allPlayers.filter(
    (candidatePlayer) => candidatePlayer.name !== player.name,
  );

  if (opponents.length === 0) {
    return 0;
  }

  const expectedScores = opponents.map((opponent) => {
    return calculateExpectedSoloScore(player.score, opponent.score);
  });
  const averageExpectedScore =
    expectedScores.reduce((sum, score) => sum + score, 0) /
    expectedScores.length;

  return Math.round(averageExpectedScore * 100);
};

export const getEloRatingChangeTooltip = (
  playerName: string,
  winnerName: string,
  selectedPlayers: { matchCount: number; name: string; score: number }[],
) => {
  const player = selectedPlayers.find(
    (candidatePlayer) => candidatePlayer.name === playerName,
  );
  const winner = selectedPlayers.find(
    (candidatePlayer) => candidatePlayer.name === winnerName,
  );

  if (!player || !winner) {
    return "";
  }

  const kFactor = getKFactor(player.matchCount);

  if (playerName === winnerName) {
    const opponents = selectedPlayers.filter(
      (candidatePlayer) => candidatePlayer.name !== winnerName,
    );
    const expectedScores = opponents.map((opponent) => {
      return calculateExpectedSoloScore(winner.score, opponent.score);
    });

    const averageExpectedScore =
      expectedScores.reduce((sum, score) => sum + score, 0) /
      expectedScores.length;
    const expectedPercentage = Math.round(averageExpectedScore * 100);
    const totalPoints = Math.round(kFactor * (1 - averageExpectedScore));

    return `(1 - ${expectedPercentage}%) of K${kFactor} = ${totalPoints} points`;
  }

  const expectedScore = calculateExpectedSoloScore(winner.score, player.score);
  const expectedPercentage = Math.round(expectedScore * 100);
  const points = Math.round(kFactor * (expectedScore - 1));

  return `(1 - ${expectedPercentage}%) of K${kFactor} = ${points} points`;
};

export class EloRankingAlgorithmService implements IRankingAlgorithmService {
  readonly algorithm = "elo" as const;
  readonly initialScore = DEFAULT_ELO_RATING;
  readonly label = "ELO ranking";

  formatScore(score: number): string {
    return String(Math.round(score));
  }

  formatScoreChange(score: number): string {
    const prefix = score >= 0 ? "+" : "";

    return `${prefix}${this.formatScore(score)} rating`;
  }

  formatScoreWithUnit(score: number): string {
    return `${this.formatScore(score)} rating`;
  }

  formatPlayerLabel(player: RankingPlayerLabel): string {
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
      return "Rating";
    }

    return "Matches played";
  }

  getGraphDescription(): string {
    return "Elo rating progression by match step. The x-axis only advances when a match was played.";
  }

  formatHistoryChange(scoreChange: number): string {
    return this.formatScoreChange(scoreChange);
  }

  formatHistoryPlayerLabel(player: RankingPlayerLabel): string {
    return this.formatPlayerLabel(player);
  }

  formatHistoryTotal(totalScore: number): string {
    return this.formatScoreWithUnit(totalScore);
  }

  getScoreChangePreviewTitle(): string {
    return "Rating change preview";
  }
}
