import type { PlayedMatch } from "~/types/app-state";

const FOUR_WEEKS_IN_MS = 28 * 24 * 60 * 60 * 1000;

const isSamePairing = (
  match: PlayedMatch,
  firstPlayerName: string,
  secondPlayerName: string,
) => {
  return (
    (match.winningPlayer === firstPlayerName &&
      match.losingPlayer === secondPlayerName) ||
    (match.winningPlayer === secondPlayerName &&
      match.losingPlayer === firstPlayerName)
  );
};

const formatAvailabilityDate = (value: Date) => {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
};

export const getRematchRestriction = (
  playedMatches: PlayedMatch[],
  firstPlayerName: string,
  secondPlayerName: string,
  asOf = new Date(),
) => {
  let latestPlayedAt: Date | null = null;

  for (const match of playedMatches) {
    if (!isSamePairing(match, firstPlayerName, secondPlayerName)) {
      continue;
    }

    const playedAt = new Date(match.datePlayedGmt);

    if (Number.isNaN(playedAt.getTime())) {
      continue;
    }

    if (!latestPlayedAt || playedAt.getTime() > latestPlayedAt.getTime()) {
      latestPlayedAt = playedAt;
    }
  }

  if (!latestPlayedAt) {
    return {
      availableAt: null,
      isBlocked: false,
      lastPlayedAt: null,
      message: "",
    };
  }

  const availableAt = new Date(latestPlayedAt.getTime() + FOUR_WEEKS_IN_MS);

  if (availableAt.getTime() <= asOf.getTime()) {
    return {
      availableAt,
      isBlocked: false,
      lastPlayedAt: latestPlayedAt,
      message: "",
    };
  }

  return {
    availableAt,
    isBlocked: true,
    lastPlayedAt: latestPlayedAt,
    message: `${firstPlayerName} and ${secondPlayerName} recently played at ${formatAvailabilityDate(latestPlayedAt)}, rematch possible at ${formatAvailabilityDate(availableAt)}.`,
  };
};
