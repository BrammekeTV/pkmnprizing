(() => {
  const MIN_PLAYERS = 4;
  const DEFAULT_BOOSTER_COST_EUR = 5.0;
  const PRIZE_PACK_COST_EUR = 0.0;
  const DEFAULT_PARTICIPATION_BOOSTERS = 1;
  const DEFAULT_TARGET_MARGIN = 0.3;
  const DEFAULT_MIN_MARGIN = 0.3;
  const DEFAULT_MAX_MARGIN = 0.4;

  const PRIZE_PACK_MODES = {
    per_player: "1 per persoon",
    half_boosters: "Helft van boosters",
    equal_boosters: "Gelijk aan boosters",
  };
  const DEFAULT_PRIZE_PACK_MODE = "per_player";

  const BOOSTER_WEIGHTS = {
    4: [14, 8, 7, 7],
    6: [14, 8, 7, 7, 5, 5],
    8: [14, 8, 7, 7, 5, 5, 4, 4],
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

  function buildRankWeights(topCut) {
    if (BOOSTER_WEIGHTS[topCut]) {
      return BOOSTER_WEIGHTS[topCut];
    }
    return Array.from({ length: topCut }, (_, index) => topCut - index);
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

  function prizePacksForBoosters(boosters, mode = DEFAULT_PRIZE_PACK_MODE) {
    switch (mode) {
      case "half_boosters":
        return Math.max(0, Math.ceil(boosters / 2));
      case "equal_boosters":
        return Math.max(0, boosters);
      case "per_player":
      default:
        return 1;
    }
  }

  function computeWithMargin(playerCount, entryFee, targetMargin, minMargin, maxMargin, options = {}) {
    const topCutRaw = options.topCut ?? getTopCut(playerCount);
    const topCut = Number.parseInt(topCutRaw, 10);
    const safeTopCut = Number.isInteger(topCut) ? topCut : getTopCut(playerCount);
    const boundedTopCut = Math.max(1, Math.min(playerCount, safeTopCut));
    const boosterCostRaw = options.boosterCost ?? DEFAULT_BOOSTER_COST_EUR;
    const parsedBoosterCost = Number(boosterCostRaw);
    const boosterCost = Number.isFinite(parsedBoosterCost) && parsedBoosterCost > 0
      ? parsedBoosterCost
      : DEFAULT_BOOSTER_COST_EUR;
    const participationBoostersRaw = options.participationBoosters ?? DEFAULT_PARTICIPATION_BOOSTERS;
    const parsedParticipationBoosters = Number.parseInt(participationBoostersRaw, 10);
    const participationBoosters = Number.isInteger(parsedParticipationBoosters) && parsedParticipationBoosters >= 0
      ? parsedParticipationBoosters
      : DEFAULT_PARTICIPATION_BOOSTERS;
    const prizePackMode = Object.hasOwn(PRIZE_PACK_MODES, options.prizePackMode ?? "")
      ? options.prizePackMode
      : DEFAULT_PRIZE_PACK_MODE;
    const revenue = playerCount * entryFee;

    const maxCostTarget = revenue * (1.0 - targetMargin);
    const maxBoostersTarget = boosterCost > 0 ? Math.floor(maxCostTarget / boosterCost) : 0;

    const nonTopPlayers = Math.max(0, playerCount - boundedTopCut);

    const participationBoostersTotal = nonTopPlayers * participationBoosters;
    const participationPrizePacks = prizePacksForBoosters(participationBoosters, prizePackMode);
    const participationPrizeTotal = nonTopPlayers * participationPrizePacks;

    const topBoostersTotal = Math.max(0, maxBoostersTarget - participationBoostersTotal);

    const topBoostersSplit = apportion(topBoostersTotal, buildRankWeights(boundedTopCut));
    const topPrizeSplit = topBoostersSplit.map((boosters) => prizePacksForBoosters(boosters, prizePackMode));
    const topPrizeTotal = topPrizeSplit.reduce((sum, value) => sum + value, 0);

    const topPrizes = topBoostersSplit.map((boosters, index) => ({
      boosters,
      prize_packs: topPrizeSplit[index],
    }));

    const allPrizes = Array.from({ length: playerCount }, (_, index) => {
      if (index < boundedTopCut) {
        return {
          boosters: topBoostersSplit[index],
          prize_packs: topPrizeSplit[index],
        };
      }
      return {
        boosters: participationBoosters,
        prize_packs: participationPrizePacks,
      };
    });

    const totalBoostersOut = participationBoostersTotal + topBoostersTotal;
    const totalPrizeOut = participationPrizeTotal + topPrizeTotal;

    const cost = totalBoostersOut * boosterCost;
    const profit = revenue - cost;
    const margin = revenue > 0 ? profit / revenue : 0.0;

    return {
      revenue,
      cost,
      profit,
      margin,
      min_margin: minMargin,
      max_margin: maxMargin,
      top_cut: boundedTopCut,
      booster_cost: boosterCost,
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
      all_prizes: allPrizes,
      total_out: {
        boosters: totalBoostersOut,
        prize_packs: totalPrizeOut,
      },
      prize_pack_mode: prizePackMode,
    };
  }

  // Age divisions, youngest first.
  const DIVISIONS = [
    { key: "juniors", label: "Juniors" },
    { key: "seniors", label: "Seniors" },
    { key: "masters", label: "Masters" },
  ];

  // Play! Pokémon Tournament Rules Handbook (rev. 1 Sept 2026), 5.2.1 Age-Combined Play:
  // a division with fewer than 6 competitors is combined with another one.
  const DIVISION_MIN_SIZE = 6;

  function groupDivisions(counts) {
    let groups = DIVISIONS.map((division) => {
      const own = Math.max(0, Number.parseInt(counts[division.key] ?? 0, 10) || 0);
      return { ...division, own, players: own, merged: [] };
    }).filter((group) => group.own > 0);

    const find = (key) => groups.find((group) => group.key === key);
    const isSmall = (group) => Boolean(group) && group.players < DIVISION_MIN_SIZE;
    const merge = (fromKey, toKey) => {
      const from = find(fromKey);
      const to = find(toKey);
      if (!from || !to) {
        return;
      }
      to.players += from.players;
      to.merged.push(...from.merged, { key: from.key, label: from.label, players: from.own });
      groups = groups.filter((group) => group !== from);
    };

    // 1. Too few Juniors: combine with Seniors (or Masters when there are no Seniors).
    if (isSmall(find("juniors"))) {
      merge("juniors", find("seniors") ? "seniors" : "masters");
    }
    // 2. Seniors (including any Juniors) still too few: combine with Masters.
    if (isSmall(find("seniors"))) {
      merge("seniors", "masters");
    }
    // 3. Only Masters too few: combine with Seniors.
    if (isSmall(find("masters"))) {
      merge("masters", "seniors");
    }

    return groups;
  }

  function computeDivisions(counts, entryFee, targetMargin, minMargin, maxMargin, options = {}) {
    const topCuts = options.topCuts ?? {};
    const divisions = groupDivisions(counts).map((group) => {
      const override = Number.parseInt(topCuts[group.key], 10);
      const topCut = Number.isInteger(override) && override >= 1 ? override : getTopCut(group.players);
      return {
        ...group,
        top_cut_auto: !(Number.isInteger(override) && override >= 1),
        result: computeWithMargin(group.players, entryFee, targetMargin, minMargin, maxMargin, { ...options, topCut }),
      };
    });

    const sum = (pick) => divisions.reduce((total, division) => total + pick(division.result), 0);
    const revenue = sum((result) => result.revenue);
    const cost = sum((result) => result.cost);
    const profit = revenue - cost;

    return {
      divisions,
      players: divisions.reduce((total, division) => total + division.players, 0),
      revenue,
      cost,
      profit,
      margin: revenue > 0 ? profit / revenue : 0,
      booster_cost: divisions[0]?.result.booster_cost ?? DEFAULT_BOOSTER_COST_EUR,
      total_out: {
        boosters: sum((result) => result.total_out.boosters),
        prize_packs: sum((result) => result.total_out.prize_packs),
      },
    };
  }

  const api = {
    MIN_PLAYERS,
    DIVISIONS,
    DIVISION_MIN_SIZE,
    groupDivisions,
    computeDivisions,
    DEFAULT_BOOSTER_COST_EUR,
    PRIZE_PACK_COST_EUR,
    DEFAULT_PARTICIPATION_BOOSTERS,
    DEFAULT_TARGET_MARGIN,
    DEFAULT_MIN_MARGIN,
    DEFAULT_MAX_MARGIN,
    BOOSTER_WEIGHTS,
    PRIZE_PACK_MODES,
    DEFAULT_PRIZE_PACK_MODE,
    getTopCut,
    apportion,
    prizePacksForBoosters,
    computeWithMargin,
  };

  if (typeof window !== "undefined") {
    window.prizeCalculator = api;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();
