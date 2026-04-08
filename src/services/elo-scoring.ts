export const DEFAULT_ELO_RATING = 1000;
export const PLACEMENT_MATCH_LIMIT = 10;
export const PLACEMENT_K_FACTOR = 60;
export const VETERAN_K_FACTOR = 32;
export const ELO_DIVISOR = 400;
export const ELO_TEAM_SYNERGY_PER_EXTRA_PLAYER = 100;
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

export const calculateVirtualTeamRating = (teamRatings: number[]) => {
  if (teamRatings.length === 0) {
    return DEFAULT_ELO_RATING;
  }

  const averageTeamRating =
    teamRatings.reduce((sum, rating) => sum + rating, 0) / teamRatings.length;
  const synergyFactor =
    (teamRatings.length - 1) * ELO_TEAM_SYNERGY_PER_EXTRA_PLAYER;

  return averageTeamRating + synergyFactor;
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
  const teamRating = calculateVirtualTeamRating(
    teamPlayers.map((player) => player.score),
  );
  const expectedSoloScore = calculateExpectedSoloScore(
    soloPlayer.score,
    teamRating,
  );
  const teamExpectedScore = 1 - expectedSoloScore;
  const soloKFactor = getKFactor(soloPlayer.matchCount);
  const soloRatingChange = normalizeWinnerGain(
    soloKFactor * (1 - expectedSoloScore),
  );
  const teamSize = Math.max(teamPlayers.length, 1);
  const losingPlayerChanges = teamPlayers.map((player) => {
    const losingPlayerKFactor = getKFactor(player.matchCount);

    return (losingPlayerKFactor / teamSize) * (0 - teamExpectedScore);
  });

  return {
    expectedSoloScore,
    losingPlayerChanges,
    soloKFactor,
    soloRatingChange,
    teamExpectedScore,
    teamRating,
  };
};