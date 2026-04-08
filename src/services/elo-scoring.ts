export const DEFAULT_ELO_RATING = 1000;
export const PLACEMENT_MATCH_LIMIT = 10;
export const PLACEMENT_K_FACTOR = 60;
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

  for (const loser of teamPlayers) {
    const expectedSoloScore = calculateExpectedSoloScore(soloPlayer.score, loser.score);
    totalExpectedSoloScore += expectedSoloScore;
    
    // Winner's gain from this specific loser
    const gainFromThisLoser = soloKFactor * (1 - expectedSoloScore);
    totalSoloRatingChange += normalizeWinnerGain(gainFromThisLoser);
    
    // Loser's change
    const loserKFactor = getKFactor(loser.matchCount);
    const loserChange = loserKFactor * (expectedSoloScore - 1); // Negative for loss
    losingPlayerChanges.push(loserChange);
  }

  const averageExpectedSoloScore = teamPlayers.length > 0 ? totalExpectedSoloScore / teamPlayers.length : 0;
  const averageTeamExpectedScore = 1 - averageExpectedSoloScore;
  const averageTeamRating = teamPlayers.length > 0 
    ? teamPlayers.reduce((sum, player) => sum + player.score, 0) / teamPlayers.length 
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