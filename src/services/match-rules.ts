import type { PlayedMatch } from "~/types/app-state";

const parseRematchCooldownDays = () => {
  const rawValue = process.env.REMATCH_COOLDOWN_DAYS;

  if (!rawValue) {
    return 30;
  }

  const parsedValue = Number.parseInt(rawValue, 10);

  if (!Number.isFinite(parsedValue) || parsedValue < 1) {
    return 30;
  }

  return parsedValue;
};

export const REMATCH_COOLDOWN_DAYS = parseRematchCooldownDays();
const REMATCH_COOLDOWN_MS = REMATCH_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

const isSamePairing = (
  match: PlayedMatch,
  firstPlayerName: string,
  secondPlayerName: string,
) => {
  const losingPlayers =
    match.losingPlayers.length > 0
      ? match.losingPlayers
      : [];

  return (
    (match.winningPlayer === firstPlayerName &&
      losingPlayers.includes(secondPlayerName)) ||
    (match.winningPlayer === secondPlayerName &&
      losingPlayers.includes(firstPlayerName))
  );
};

const formatAvailabilityDate = (value: Date) => {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
};

export const formatRematchCooldownLabel = () => {
  return `${REMATCH_COOLDOWN_DAYS} day${REMATCH_COOLDOWN_DAYS === 1 ? "" : "s"}`;
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

  const availableAt = new Date(latestPlayedAt.getTime() + REMATCH_COOLDOWN_MS);

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
    message: `${firstPlayerName} and ${secondPlayerName} played within the last ${formatRematchCooldownLabel()} (${formatAvailabilityDate(latestPlayedAt)}). Rematch possible at ${formatAvailabilityDate(availableAt)}.`,
  };
};
