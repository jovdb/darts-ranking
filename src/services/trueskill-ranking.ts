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

// ─── TrueSkill v2 constants ────────────────────────────────────────────────────
// Each player is modelled as a Gaussian: μ (mean skill), σ (uncertainty).
// Conservative display score = μ − 3σ → starts at 25 − 25 = 0 for new players.
// β  = performance noise per match (half of one skill level).
// τ  = dynamics factor: small σ injection per match so ratings can still evolve.

export const TRUESKILL_MU_INITIAL = 25;
export const TRUESKILL_SIGMA_INITIAL = TRUESKILL_MU_INITIAL / 3; // ≈ 8.333
const BETA = TRUESKILL_SIGMA_INITIAL / 2; // ≈ 4.167
const TAU = TRUESKILL_SIGMA_INITIAL / 100; // ≈ 0.083

const conservativeScore = (mu: number, sigma: number): number =>
  mu - 3 * sigma;

// ─── Gaussian helpers (no external deps) ─────────────────────────────────────

// erf approximation — Abramowitz & Stegun 7.1.26, |ε| ≤ 1.5×10⁻⁷
const erf = (x: number): number => {
  const sign = x >= 0 ? 1 : -1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const poly =
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t -
      0.284496736) *
      t +
      0.254829592) *
    t;
  return sign * (1 - poly * Math.exp(-ax * ax));
};

const gaussianPdf = (x: number): number =>
  Math.exp((-x * x) / 2) / Math.sqrt(2 * Math.PI);

const gaussianCdf = (x: number): number => (1 + erf(x / Math.SQRT2)) / 2;

// Truncated Gaussian helpers: v(t) = φ(t)/Φ(t), w(t) = v(t)·(v(t) + t)
const vWin = (t: number): number => {
  const cdf = gaussianCdf(t);
  return cdf < 1e-10 ? -t : gaussianPdf(t) / cdf;
};

const wWin = (t: number): number => {
  const v = vWin(t);
  return v * (v + t);
};

// ─── Internal types ───────────────────────────────────────────────────────────

type TrueSkillPlayerTotals = {
  losses: number;
  matchCount: number;
  mu: number;
  name: string;
  sigma: number;
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

// ─── Utilities ────────────────────────────────────────────────────────────────

const rankingTieBreakers = new Map<string, number>();

const getRankingTieBreaker = (playerName: string): number => {
  const existing = rankingTieBreakers.get(playerName);
  if (existing !== undefined) return existing;
  const next = Math.random();
  rankingTieBreakers.set(playerName, next);
  return next;
};

const createPlayerTotalsByName = (
  players: Player[],
): Map<string, TrueSkillPlayerTotals> =>
  new Map(
    players.map((player) => [
      player.name,
      {
        losses: 0,
        matchCount: 0,
        mu: TRUESKILL_MU_INITIAL,
        name: player.name,
        sigma: TRUESKILL_SIGMA_INITIAL,
        wins: 0,
      },
    ]),
  );

const prepareMatches = (
  players: Player[],
  playedMatches: PlayedMatch[],
  asOf?: Date,
): PreparedMatch[] => {
  const playerNames = new Set(players.map((p) => p.name));
  const asOfTime = asOf?.getTime();

  return playedMatches
    .map((match, sourceIndex) => ({
      losingPlayers: [...new Set(match.losingPlayers)].filter(
        (name) => playerNames.has(name) && name !== match.winningPlayer,
      ),
      match,
      playedAt: new Date(match.datePlayedGmt),
      sourceIndex,
    }))
    .filter(
      ({ losingPlayers, match, playedAt }) =>
        playerNames.has(match.winningPlayer) &&
        losingPlayers.length > 0 &&
        !Number.isNaN(playedAt.getTime()) &&
        (asOfTime === undefined || playedAt.getTime() <= asOfTime),
    )
    .sort((a, b) => {
      const dt = a.playedAt.getTime() - b.playedAt.getTime();
      return dt !== 0 ? dt : a.sourceIndex - b.sourceIndex;
    });
};

const buildRankingsFromTotals = (
  totalsByPlayerName: Map<string, TrueSkillPlayerTotals>,
): RankedPlayer[] => {
  const sorted = [...totalsByPlayerName.values()]
    .map((player) => ({
      isInPlacement: player.sigma > TRUESKILL_SIGMA_INITIAL * 0.6,
      uncertainty: player.sigma,
      losses: player.losses,
      matchCount: player.matchCount,
      name: player.name,
      rank: 0,
      score: conservativeScore(player.mu, player.sigma),
      wins: player.wins,
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return getRankingTieBreaker(a.name) - getRankingTieBreaker(b.name);
    });

  let previousScore: number | null = null;
  let currentRank = 0;

  return sorted.map((player) => {
    if (previousScore === null || player.score !== previousScore) {
      currentRank += 1;
      previousScore = player.score;
    }
    return { ...player, rank: currentRank };
  });
};

const getHistoricalMatchPlayer = (
  rankings: RankedPlayer[],
  playerName: string,
): HistoricalMatchPlayer => {
  const ranked = rankings.find((e) => e.name === playerName);
  if (!ranked)
    return {
      isInPlacement: true,
      uncertainty: TRUESKILL_SIGMA_INITIAL,
      matchCount: 0,
      name: playerName,
      rank: 0,
      score: conservativeScore(TRUESKILL_MU_INITIAL, TRUESKILL_SIGMA_INITIAL),
    };
  return {
    isInPlacement: ranked.isInPlacement,
    uncertainty: ranked.uncertainty,
    matchCount: ranked.matchCount,
    name: ranked.name,
    rank: ranked.rank,
    score: ranked.score,
  };
};

// ─── Core TrueSkill update: 1 winner vs N losers treated as a single team ─────
//
// Team aggregates:   μ_team = Σμⱼ,  σ²_team = Σσ²ⱼ
// Combined variance: c² = σ²_winner + σ²_team + 2β²
// Performance ratio: t = (μ_winner − μ_team) / c
//
// Winner:   Δμ = +σ²_winner/c · v(t),  σ² ← σ²·(1 − σ²/c²·w(t)) + τ²
// Loser j:  Δμ = −σ²ⱼ/c · v(t),        σ²ⱼ ← σ²ⱼ·(1 − σ²ⱼ/c²·w(t)) + τ²

const applyTrueSkillUpdate = (
  winnerTotals: TrueSkillPlayerTotals,
  loserTotalsList: TrueSkillPlayerTotals[],
): { loserDeltas: number[]; winnerDelta: number } => {
  const sig1Sq = winnerTotals.sigma * winnerTotals.sigma;
  const mu2 = loserTotalsList.reduce((sum, l) => sum + l.mu, 0);
  const sig2Sq = loserTotalsList.reduce((sum, l) => sum + l.sigma * l.sigma, 0);
  const cSq = sig1Sq + sig2Sq + 2 * BETA * BETA;
  const c = Math.sqrt(cSq);

  const t = (winnerTotals.mu - mu2) / c;
  const v = vWin(t);
  const w = wWin(t);

  // Winner update
  const winnerScoreBefore = conservativeScore(winnerTotals.mu, winnerTotals.sigma);
  winnerTotals.mu += (sig1Sq / c) * v;
  winnerTotals.sigma = Math.sqrt(
    Math.max(sig1Sq * (1 - (sig1Sq / cSq) * w) + TAU * TAU, 1e-6),
  );
  winnerTotals.wins += 1;
  winnerTotals.matchCount += 1;
  const winnerDelta =
    conservativeScore(winnerTotals.mu, winnerTotals.sigma) - winnerScoreBefore;

  // Each loser update
  const loserDeltas: number[] = [];
  for (const loser of loserTotalsList) {
    const sigSq = loser.sigma * loser.sigma;
    const loserScoreBefore = conservativeScore(loser.mu, loser.sigma);
    loser.mu -= (sigSq / c) * v;
    loser.sigma = Math.sqrt(
      Math.max(sigSq * (1 - (sigSq / cSq) * w) + TAU * TAU, 1e-6),
    );
    loser.losses += 1;
    loser.matchCount += 1;
    loserDeltas.push(
      conservativeScore(loser.mu, loser.sigma) - loserScoreBefore,
    );
  }

  return { loserDeltas, winnerDelta };
};

// ─── Progress → output converters ────────────────────────────────────────────

const toHistoricalMatch = (pm: RankingProgressMatch): HistoricalMatch => ({
  datePlayedGmt: pm.match.datePlayedGmt,
  earnedPoints: pm.earnedPoints,
  losingPlayers: pm.losingPlayersBeforeMatch.map((lpp) => lpp.player),
  losingPlayerRatingChanges: pm.losingPlayersBeforeMatch.map(
    (lpp) => lpp.ratingChange,
  ),
  winnerTotalScore: pm.winnerTotalScoreAfterMatch,
  winningPlayer: pm.winningPlayerBeforeMatch,
});

const toRankingTimelineSnapshot = (
  pm: RankingProgressMatch,
): RankingTimelineSnapshot => ({
  datePlayedGmt: pm.match.datePlayedGmt,
  earnedPoints: pm.earnedPoints,
  losingPlayers: pm.losingPlayersBeforeMatch.map((lpp) => lpp.playerName),
  matchIndex: pm.matchIndex,
  playerRatingChanges: [
    {
      playerName: pm.winningPlayerBeforeMatch.name,
      ratingChange: pm.earnedPoints,
    },
    ...pm.losingPlayersBeforeMatch.map((lpp) => ({
      playerName: lpp.playerName,
      ratingChange: lpp.ratingChange,
    })),
  ],
  rankings: pm.rankingsAfterMatch,
  rankingsBeforeMatch: pm.rankingsBeforeMatch,
  winningPlayer: pm.match.winningPlayer,
});

// ─── Collector ────────────────────────────────────────────────────────────────

const collectTrueSkillProgress = (
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

    const winnerTotals = totalsByPlayerName.get(preparedMatch.match.winningPlayer);
    if (!winnerTotals) continue;

    const loserTotalsList = preparedMatch.losingPlayers
      .map((name) => totalsByPlayerName.get(name))
      .filter((t): t is TrueSkillPlayerTotals => t !== undefined);

    if (loserTotalsList.length === 0) continue;

    const { winnerDelta, loserDeltas } = applyTrueSkillUpdate(
      winnerTotals,
      loserTotalsList,
    );

    losingPlayersBeforeMatch.forEach((lpp, index) => {
      lpp.ratingChange = loserDeltas[index] ?? 0;
    });

    const rankingsAfterMatch = buildRankingsFromTotals(totalsByPlayerName);
    const winnerAfter = rankingsAfterMatch.find(
      (p) => p.name === preparedMatch.match.winningPlayer,
    );

    matches.push({
      earnedPoints: winnerDelta,
      losingPlayersBeforeMatch,
      match: preparedMatch.match,
      matchIndex: preparedMatch.sourceIndex,
      rankingsAfterMatch,
      rankingsBeforeMatch,
      winnerTotalScoreAfterMatch:
        winnerAfter?.score ?? winningPlayerBeforeMatch.score,
      winningPlayerBeforeMatch,
    });
  }

  return {
    finalRankings: buildRankingsFromTotals(totalsByPlayerName),
    matches,
  };
};

// ─── Exported calculation functions ──────────────────────────────────────────

export function calculateRankings(
  players: Player[],
  playedMatches: PlayedMatch[],
  asOf = new Date(),
): RankedPlayer[] {
  return collectTrueSkillProgress(players, playedMatches, asOf).finalRankings;
}

function calculateTrueSkillHistoricalMatches(
  players: Player[],
  playedMatches: PlayedMatch[],
): HistoricalMatch[] {
  return collectTrueSkillProgress(players, playedMatches).matches
    .map(toHistoricalMatch)
    .reverse();
}

function calculateTrueSkillRankingTimeline(
  players: Player[],
  playedMatches: PlayedMatch[],
): RankingTimelineSnapshot[] {
  return collectTrueSkillProgress(players, playedMatches).matches.map(
    toRankingTimelineSnapshot,
  );
}

// ─── Win probability helper ───────────────────────────────────────────────────
// P(win vs single opponent) ≈ Φ(Δscore / (√2·β)), using conservative score
// as a proxy for μ.

const BETA_DISPLAY = BETA * 3; // scale β to the μ−3σ display space

const expectedWinVsOpponents = (
  playerScore: number,
  opponents: IRankingPlayerLabel[],
): number => {
  if (opponents.length === 0) return 0;
  const probs = opponents.map((opp) =>
    gaussianCdf((playerScore - opp.score) / (Math.SQRT2 * BETA_DISPLAY)),
  );
  return probs.reduce((s, p) => s + p, 0) / probs.length;
};

// ─── Algorithm service ────────────────────────────────────────────────────────

export class TrueSkillRankingAlgorithmService
  implements IRankingAlgorithmService
{
  readonly algorithm = "trueskill" as const;
  // Conservative score at start: 25 − 3 × (25/3) = 0
  readonly initialScore = conservativeScore(
    TRUESKILL_MU_INITIAL,
    TRUESKILL_SIGMA_INITIAL,
  );
  readonly label = "TrueSkill v2";

  formatScore(score: number): string {
    return score.toFixed(1);
  }

  formatScoreChange(score: number): string {
    const prefix = score >= 0 ? "+" : "";
    return `${prefix}${score.toFixed(1)} TS`;
  }

  formatScoreWithUnit(score: number): string {
    return `${this.formatScore(score)} TS`;
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
    return axis === "y" ? "TrueSkill (μ − 3σ)" : "Matches played";
  }

  getGraphDescription(): string {
    return "TrueSkill v2 conservative rating (μ − 3σ). Starts at 0 and grows as skill is proven with increasing confidence.";
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
    return "TrueSkill change preview";
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
    return calculateTrueSkillHistoricalMatches(players, playedMatches);
  }

  calculateRankingTimeline(
    players: Player[],
    playedMatches: PlayedMatch[],
  ): RankingTimelineSnapshot[] {
    return calculateTrueSkillRankingTimeline(players, playedMatches);
  }

  buildScoreChangePreviewRows(
    players: Player[],
    playedMatches: PlayedMatch[],
    selectedPlayers: IRankingPlayerLabel[],
    winnerName: string,
  ): IRankingScorePreviewRow[] {
    if (selectedPlayers.length < 2) return [];

    const losingPlayers = selectedPlayers
      .filter((p) => p.name !== winnerName)
      .map((p) => p.name);

    if (losingPlayers.length === 0) return [];

    const playersForCalc: Player[] = players.map((p) => ({ name: p.name }));
    const baseRankings = this.calculateRankings(playersForCalc, playedMatches);
    const projectedRankings = this.calculateRankings(playersForCalc, [
      ...playedMatches,
      {
        datePlayedGmt: new Date().toISOString(),
        losingPlayers,
        winningPlayer: winnerName,
      },
    ]);

    return selectedPlayers.map((sel) => {
      const currentScore =
        baseRankings.find((p) => p.name === sel.name)?.score ?? sel.score;
      const projectedScore =
        projectedRankings.find((p) => p.name === sel.name)?.score ??
        currentScore;
      const scoreChange = projectedScore - currentScore;
      return {
        label: sel.name,
        projectedScore,
        scoreChange,
        tone:
          scoreChange > 0
            ? "positive"
            : scoreChange < 0
              ? "negative"
              : "neutral",
      };
    });
  }

  getExpectedWinPercentage(
    player: IRankingPlayerLabel,
    selectedPlayers: IRankingPlayerLabel[],
  ): number {
    const opponents = selectedPlayers.filter((p) => p.name !== player.name);
    return Math.round(expectedWinVsOpponents(player.score, opponents) * 100);
  }

  getScoreChangePreviewTooltip(
    playerName: string,
    winnerName: string,
    selectedPlayers: IRankingPlayerLabel[],
  ): string {
    const player = selectedPlayers.find((p) => p.name === playerName);
    if (!player) return "";

    const opponents = selectedPlayers.filter((p) => p.name !== playerName);
    const winPct = Math.round(
      expectedWinVsOpponents(player.score, opponents) * 100,
    );
    const role = playerName === winnerName ? "winner" : "loser";
    return `${this.formatScoreWithUnit(player.score)}, ${winPct}% expected win (${role})`;
  }
}
