(() => {
  const MIN_PLAYERS = 4;
  const BOOSTER_COST_EUR = 5.0;
  const PRIZE_PACK_COST_EUR = 0.0;
  const PARTICIPATION_BOOSTERS = 1;
  const PARTICIPATION_PRIZE_PACKS = 1;
  const DEFAULT_TARGET_MARGIN = 0.3;
  const DEFAULT_MIN_MARGIN = 0.3;
  const DEFAULT_MAX_MARGIN = 0.4;

  const BOOSTER_WEIGHTS = {
    4: [14, 8, 7, 7],
    6: [14, 8, 7, 7, 5, 5],
    8: [14, 8, 7, 7, 5, 5, 4, 4],
  };

  const PRIZE_WEIGHTS = {
    4: [15, 11, 8, 6],
    6: [15, 11, 8, 6, 5, 5],
    8: [15, 11, 8, 6, 5, 5, 4, 4],
  };

  function getTopCut(playerCount) {
    if (playerCount <= 32) {
      return 4;
    }
    if (playerCount <= 64) {
      return 6;
    }
    return 8;
  }

  function apportion(total, weights) {
    if (total <= 0) {
      return new Array(weights.length).fill(0);
    }

    const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
    const quotas = weights.map((weight) => total * (weight / weightSum));
    const floors = quotas.map((quota) => Math.floor(quota));
    const distributed = floors.reduce((sum, value) => sum + value, 0);
    const remainder = total - distributed;

    const remainders = quotas
      .map((quota, index) => ({ remainder: quota - floors[index], index }))
      .sort((left, right) => {
        if (right.remainder !== left.remainder) {
          return right.remainder - left.remainder;
        }
        return left.index - right.index;
      });

    const result = [...floors];
    for (let step = 0; step < remainder; step += 1) {
      result[remainders[step % remainders.length].index] += 1;
    }
    return result;
  }

  function prizePacksTotal(playerCount) {
    return Math.max(0, Math.round(1.5 * playerCount));
  }

  function computeWithMargin(playerCount, entryFee, targetMargin, minMargin, maxMargin) {
    const topCut = getTopCut(playerCount);
    const revenue = playerCount * entryFee;

    const maxCostTarget = revenue * (1.0 - targetMargin);
    const maxBoostersTarget = Math.floor(maxCostTarget / BOOSTER_COST_EUR);

    const nonTopPlayers = Math.max(0, playerCount - topCut);

    const participationBoostersTotal = nonTopPlayers * PARTICIPATION_BOOSTERS;
    const participationPrizeTotal = nonTopPlayers * PARTICIPATION_PRIZE_PACKS;

    const topBoostersTotal = Math.max(0, maxBoostersTarget - participationBoostersTotal);

    const basePrizeTotal = prizePacksTotal(playerCount);
    const topPrizeTotal = Math.max(0, basePrizeTotal - participationPrizeTotal);

    const topBoostersSplit = apportion(topBoostersTotal, BOOSTER_WEIGHTS[topCut]);
    const topPrizeSplit = apportion(topPrizeTotal, PRIZE_WEIGHTS[topCut]);

    const topPrizes = topBoostersSplit.map((boosters, index) => ({
      boosters,
      prize_packs: topPrizeSplit[index],
    }));

    const totalBoostersOut = participationBoostersTotal + topBoostersTotal;
    const totalPrizeOut = participationPrizeTotal + topPrizeTotal;

    const cost = totalBoostersOut * BOOSTER_COST_EUR;
    const profit = revenue - cost;
    const margin = revenue > 0 ? profit / revenue : 0.0;

    return {
      revenue,
      cost,
      profit,
      margin,
      min_margin: minMargin,
      max_margin: maxMargin,
      top_cut: topCut,
      non_top_players: nonTopPlayers,
      participation_total: {
        boosters: participationBoostersTotal,
        prize_packs: participationPrizeTotal,
      },
      top_total: {
        boosters: topBoostersTotal,
        prize_packs: topPrizeTotal,
      },
      top_prizes: topPrizes,
      total_out: {
        boosters: totalBoostersOut,
        prize_packs: totalPrizeOut,
      },
      base_prize_total: basePrizeTotal,
    };
  }

  const api = {
    MIN_PLAYERS,
    BOOSTER_COST_EUR,
    PRIZE_PACK_COST_EUR,
    PARTICIPATION_BOOSTERS,
    PARTICIPATION_PRIZE_PACKS,
    DEFAULT_TARGET_MARGIN,
    DEFAULT_MIN_MARGIN,
    DEFAULT_MAX_MARGIN,
    BOOSTER_WEIGHTS,
    PRIZE_WEIGHTS,
    getTopCut,
    apportion,
    prizePacksTotal,
    computeWithMargin,
  };

  if (typeof window !== "undefined") {
    window.prizeCalculator = api;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();
