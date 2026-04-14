import { EloRankingAlgorithmService } from "~/services/elo-scoring";
import { PercentWonRankingAlgorithmService } from "~/services/percent-won-ranking";
import { TrueSkillRankingAlgorithmService } from "~/services/trueskill-ranking";
import type { IRankingAlgorithmService } from "~/services/ranking-interfaces";
import type { RankingAlgorithm } from "~/types/app-state";

const rankingAlgorithmServices: Record<RankingAlgorithm, IRankingAlgorithmService> = {
  elo: new EloRankingAlgorithmService(),
  "percent-won": new PercentWonRankingAlgorithmService(),
  trueskill: new TrueSkillRankingAlgorithmService(),
};

export const getRankingAlgorithmService = (
  algorithm: RankingAlgorithm,
): IRankingAlgorithmService => {
  return rankingAlgorithmServices[algorithm];
};
