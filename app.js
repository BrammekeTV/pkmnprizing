(() => {
  const calculator = window.prizeCalculator;

  if (!calculator) {
    return;
  }

  const euroFormatter = new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const percentFormatter = new Intl.NumberFormat("nl-NL", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  const wholePercentFormatter = new Intl.NumberFormat("nl-NL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  const PRIZE_PACK_HINTS = {
    per_player: "Iedere speler krijgt 1 prijspakket",
    half_boosters: "10 boosters geeft 5 prijspakketten (oneven naar boven afgerond)",
    equal_boosters: "Evenveel prijspakketten als boosters",
  };

  const THEME_STORAGE_KEY = "pkmnprizing-theme";

  const $ = (selector) => document.querySelector(selector);

  const form = $("#calculator-form");
  const resetButton = $("#reset-button");
  const themeToggle = $("#theme-toggle");
  const banner = $("#message-banner");
  const resultsStatus = $("#results-status");
  const resultsBody = $("#results-body");
  const outcome = $(".outcome");
  const warnings = $("#warnings");
  const divisionTables = $("#division-tables");

  let hasRendered = false;

  class InputError extends Error {
    constructor(message, input) {
      super(message);
      this.input = input;
    }
  }

  function parseDecimal(value) {
    return Number.parseFloat(String(value).trim().replace(",", "."));
  }

  function parseMargin(input, label) {
    const value = parseDecimal(input.value);
    if (!Number.isFinite(value) || value <= 0 || value >= 100) {
      throw new InputError(`Vul bij ${label} een percentage tussen 1 en 99 in.`, input);
    }
    return value / 100.0;
  }

  function formatEuro(value) {
    return euroFormatter.format(value);
  }

  function formatPercent(value) {
    return `${percentFormatter.format(value * 100)}%`;
  }

  function formatWholePercent(value) {
    return `${wholePercentFormatter.format(value * 100)}%`;
  }

  function plural(count, one, many) {
    return `${count} ${count === 1 ? one : many}`;
  }

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
  }

  function showBanner(message, tone = "error") {
    banner.textContent = message;
    banner.className = `message-banner ${tone}`;
  }

  function hideBanner() {
    banner.textContent = "";
    banner.className = "message-banner hidden";
  }

  function clearInvalid() {
    for (const input of form.querySelectorAll("[aria-invalid]")) {
      input.removeAttribute("aria-invalid");
    }
  }

  function getMarginStatus(data, minMargin, maxMargin) {
    const range = minMargin === maxMargin
      ? formatWholePercent(minMargin)
      : `${wholePercentFormatter.format(minMargin * 100)}–${formatWholePercent(maxMargin)}`;

    if (data.profit < 0) {
      return { key: "loss", text: "Je maakt verlies. Geef minder prijzen of verhoog het inleggeld." };
    }
    if (data.margin < minMargin) {
      return {
        key: "low",
        text: `Onder je minimum van ${formatWholePercent(minMargin)}. Geef minder prijzen of verhoog het inleggeld.`,
      };
    }
    if (data.margin > maxMargin) {
      return {
        key: "high",
        text: `Boven je maximum van ${formatWholePercent(maxMargin)}. Er is ruimte voor meer prijzen.`,
      };
    }
    return { key: "ok", text: `Binnen je marge van ${range}.` };
  }

  function renderMeter(margin, minMargin, maxMargin) {
    const scaleMax = Math.min(1, Math.ceil(Math.max(0.5, maxMargin + 0.1, margin + 0.05) * 10) / 10);
    const position = (value) => `${(Math.max(0, Math.min(scaleMax, value)) / scaleMax) * 100}%`;

    const band = $("#meter-band");
    band.style.left = position(minMargin);
    band.style.width = `calc(${position(maxMargin)} - ${position(minMargin)})`;
    $("#meter-marker").style.left = position(margin);

    const ticks = [[0, "edge-start"], [minMargin, ""], [maxMargin, ""], [scaleMax, "edge-end"]];
    const seen = new Set();
    $("#meter-scale").innerHTML = ticks
      .filter(([value]) => {
        const key = Math.round(value * 100);
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      })
      .map(([value, className]) => `<span class="${className}" style="left:${position(value)}">${formatWholePercent(value)}</span>`)
      .join("");
  }

  function renderOutcome(data, inputs) {
    const status = getMarginStatus(data, inputs.minMargin, inputs.maxMargin);
    outcome.dataset.status = status.key;
    $("#profit-value").textContent = formatEuro(data.profit);
    $("#margin-value").textContent = formatPercent(data.margin);
    $("#margin-status").textContent = status.text;
    renderMeter(data.margin, inputs.minMargin, inputs.maxMargin);

    const notes = data.divisions.flatMap((division) =>
      division.merged.map((from) => `${from.label} (${plural(from.players, "speler", "spelers")}) spelen mee bij ${division.label}.`)
    );
    $("#division-notes").textContent = notes.join(" ");

    const money = [
      ["Omzet", formatEuro(data.revenue), `${data.players} × ${formatEuro(inputs.entryFee)}`],
      ["Kosten", formatEuro(data.cost), `${data.total_out.boosters} × ${formatEuro(data.booster_cost)}`],
      ["Nodig", plural(data.total_out.boosters, "booster", "boosters"), `en ${plural(data.total_out.prize_packs, "prijspakket", "prijspakketten")}`],
    ];

    $("#money-list").innerHTML = money
      .map(([label, value, detail]) => `
        <div>
          <dt>${label}</dt>
          <dd>${escapeHtml(value)}<span class="detail">${escapeHtml(detail)}</span></dd>
        </div>
      `)
      .join("");
  }

  function tableRows(result, playerCount) {
    const topCut = result.top_cut;
    const rows = [`<tr class="group-row"><th colspan="3" scope="colgroup">Top ${topCut}</th></tr>`];

    result.top_prizes.forEach((prize, index) => {
      rows.push(`
        <tr class="top${index === 0 ? " first" : ""}">
          <td>${index + 1}e</td>
          <td class="num">${prize.boosters}</td>
          <td class="num">${prize.prize_packs}</td>
        </tr>
      `);
    });

    if (result.non_top_players > 0) {
      const first = topCut + 1;
      const label = first === playerCount ? `${first}e` : `${first}e t/m ${playerCount}e`;
      const participant = result.all_prizes[topCut];
      rows.push(`<tr class="group-row"><th colspan="3" scope="colgroup">Deelname</th></tr>`);
      rows.push(`
        <tr>
          <td>${label}<span class="sub">${plural(result.non_top_players, "speler", "spelers")}, ieder</span></td>
          <td class="num">${participant.boosters}</td>
          <td class="num">${participant.prize_packs}</td>
        </tr>
      `);
    }

    return rows.join("");
  }

  function renderTables(data) {
    const ordered = [...data.divisions].reverse();
    divisionTables.innerHTML = ordered
      .map((division) => {
        const result = division.result;
        const mergedText = division.merged.length
          ? `, waarvan ${division.merged.map((from) => `${from.players} ${from.label}`).join(" en ")}`
          : "";
        const meta = `${plural(division.players, "speler", "spelers")}${mergedText}. ${result.total_out.boosters} boosters en ${result.total_out.prize_packs} prijspakketten.`;
        const id = `table-${division.key}`;
        return `
          <section class="panel" aria-labelledby="${id}">
            <div class="panel-head">
              <h2 id="${id}" class="panel-title">${division.label}</h2>
              <p class="panel-meta">${escapeHtml(meta)}</p>
            </div>
            <table class="prize-table">
              <thead>
                <tr>
                  <th scope="col">Plaats</th>
                  <th scope="col" class="num">Boosters</th>
                  <th scope="col" class="num">Prijspakketten</th>
                </tr>
              </thead>
              <tbody>${tableRows(result, division.players)}</tbody>
            </table>
          </section>
        `;
      })
      .join("");
  }

  function renderWarnings(data) {
    const messages = [];
    const named = data.divisions.length > 1;

    for (const division of [...data.divisions].reverse()) {
      const result = division.result;
      const prefix = named ? `${division.label}: ` : "";

      if (division.players < calculator.MIN_PLAYERS) {
        messages.push(`${prefix}maar ${plural(division.players, "speler", "spelers")}. Een divisie heeft er minimaal ${calculator.MIN_PLAYERS} nodig.`);
      }
      if (result.top_total.boosters === 0 && division.players > result.top_cut) {
        messages.push(`${prefix}de top ${result.top_cut} krijgt geen boosters: het hele budget gaat naar deelnameprijzen. Verlaag de deelnameprijs.`);
      } else if (result.non_top_players > 0 && result.top_prizes[result.top_cut - 1].boosters < result.all_prizes[result.top_cut].boosters) {
        messages.push(`${prefix}plek ${result.top_cut} krijgt minder boosters dan een deelnemer buiten de top-cut.`);
      }
    }

    warnings.innerHTML = messages
      .map((text) => `<div class="warning-card warning">${escapeHtml(text.charAt(0).toUpperCase() + text.slice(1))}</div>`)
      .join("");
  }

  function readPlayerCounts() {
    const counts = {};
    for (const { key, label } of calculator.DIVISIONS) {
      const input = $(`#players-${key}`);
      const raw = input.value.trim();
      const value = raw === "" ? 0 : Number(raw);
      if (!Number.isInteger(value) || value < 0) {
        throw new InputError(`Vul bij ${label} een geheel aantal spelers in (0 of meer).`, input);
      }
      counts[key] = value;
    }
    return counts;
  }

  // Disable top-cut fields of divisions that play up, and show the automatic value as placeholder.
  function updateTopCutFields(counts) {
    const groups = counts ? calculator.groupDivisions(counts) : [];
    for (const { key, label } of calculator.DIVISIONS) {
      const input = $(`#top-cut-${key}`);
      const group = groups.find((item) => item.key === key);
      input.disabled = Boolean(counts) && !group;
      input.placeholder = group ? String(calculator.getTopCut(group.players)) : "–";
      input.title = input.disabled ? `${label} speelt mee in een hogere divisie` : "";
    }
    return groups;
  }

  function readTopCuts(groups) {
    const topCuts = {};
    for (const group of groups) {
      const input = $(`#top-cut-${group.key}`);
      const raw = input.value.trim();
      if (raw === "") {
        continue;
      }
      const value = Number(raw);
      if (!Number.isInteger(value) || value < 1) {
        throw new InputError(`Vul bij ${group.label} een top-cut van minimaal 1 in, of laat het veld leeg.`, input);
      }
      if (value > group.players) {
        throw new InputError(`De top-cut van ${group.label} kan niet groter zijn dan het aantal spelers (${group.players}).`, input);
      }
      topCuts[group.key] = value;
    }
    return topCuts;
  }

  function getInputs() {
    const feeInput = $("#entry-fee");
    const boosterCostInput = $("#booster-cost");
    const participationBoostersInput = $("#participation-boosters");
    const prizePackModeInput = $("#prize-pack-mode");
    const targetMarginInput = $("#target-margin");
    const minMarginInput = $("#min-margin");
    const maxMarginInput = $("#max-margin");

    const counts = readPlayerCounts();
    const groups = updateTopCutFields(counts);
    const playerCount = groups.reduce((total, group) => total + group.players, 0);
    if (playerCount < calculator.MIN_PLAYERS) {
      throw new InputError(
        `Een toernooi heeft minimaal ${calculator.MIN_PLAYERS} spelers nodig.`,
        $("#players-masters")
      );
    }
    const topCuts = readTopCuts(groups);

    const entryFee = parseDecimal(feeInput.value);
    if (!Number.isFinite(entryFee) || entryFee <= 0) {
      throw new InputError("Vul een inleggeld hoger dan € 0 in.", feeInput);
    }

    const boosterCost = parseDecimal(boosterCostInput.value);
    if (!Number.isFinite(boosterCost) || boosterCost <= 0) {
      throw new InputError("Vul een inkoopprijs per booster hoger dan € 0 in.", boosterCostInput);
    }

    const participationBoosters = Number.parseInt(participationBoostersInput.value.trim(), 10);
    if (!Number.isInteger(participationBoosters) || participationBoosters < 0) {
      throw new InputError("Vul bij deelnameprijs een aantal boosters in (0 of meer).", participationBoostersInput);
    }

    const prizePackMode = prizePackModeInput.value;
    if (!Object.hasOwn(calculator.PRIZE_PACK_MODES, prizePackMode)) {
      throw new InputError("Kies hoeveel prijspakketten elke plek krijgt.", prizePackModeInput);
    }

    const minMargin = parseMargin(minMarginInput, "minimum marge");
    const targetMargin = parseMargin(targetMarginInput, "doel-marge");
    const maxMargin = parseMargin(maxMarginInput, "maximum marge");

    if (minMargin > maxMargin) {
      throw new InputError("De minimum marge mag niet hoger zijn dan de maximum marge.", minMarginInput);
    }
    if (targetMargin < minMargin || targetMargin > maxMargin) {
      throw new InputError(
        `De doel-marge moet tussen ${formatWholePercent(minMargin)} en ${formatWholePercent(maxMargin)} liggen.`,
        targetMarginInput
      );
    }

    return {
      counts,
      topCuts,
      entryFee,
      boosterCost,
      participationBoosters,
      prizePackMode,
      targetMargin,
      minMargin,
      maxMargin,
    };
  }

  function showProblem(message, tone) {
    resultsStatus.textContent = "";
    showBanner(message, tone);
    resultsBody.classList.toggle("is-empty", !hasRendered);
    resultsBody.classList.toggle("is-stale", hasRendered);
  }

  function calculateAndRender() {
    hideBanner();
    clearInvalid();
    $("#prize-pack-hint").textContent = PRIZE_PACK_HINTS[$("#prize-pack-mode").value] ?? "";

    let inputs;
    try {
      inputs = getInputs();
    } catch (error) {
      if (error instanceof InputError && error.input) {
        error.input.setAttribute("aria-invalid", "true");
      }
      showProblem(error.message, "error");
      return;
    }

    const data = calculator.computeDivisions(
      inputs.counts,
      inputs.entryFee,
      inputs.targetMargin,
      inputs.minMargin,
      inputs.maxMargin,
      {
        topCuts: inputs.topCuts,
        boosterCost: inputs.boosterCost,
        participationBoosters: inputs.participationBoosters,
        prizePackMode: inputs.prizePackMode,
      }
    );

    renderOutcome(data, inputs);
    renderWarnings(data);
    renderTables(data);
    resultsBody.classList.remove("is-empty", "is-stale");
    hasRendered = true;

    resultsStatus.textContent = `${data.players} spelers in ${plural(data.divisions.length, "divisie", "divisies")}: winst ${formatEuro(data.profit)}, marge ${formatPercent(data.margin)}, ${data.total_out.boosters} boosters en ${data.total_out.prize_packs} prijspakketten.`;
  }

  function applyTheme(theme) {
    document.body.setAttribute("data-theme", theme);
    const dark = theme === "dark";
    themeToggle.textContent = dark ? "Licht" : "Donker";
    themeToggle.setAttribute("aria-label", dark ? "Schakel lichte modus" : "Schakel donkere modus");
  }

  function loadTheme() {
    try {
      const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
      if (storedTheme === "dark" || storedTheme === "light") {
        applyTheme(storedTheme);
        return;
      }
    } catch (error) {
      // Ignore storage failures and fall back to OS preference.
    }

    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(prefersDark ? "dark" : "light");
  }

  form.addEventListener("input", calculateAndRender);
  form.addEventListener("change", calculateAndRender);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    calculateAndRender();
  });

  resetButton.addEventListener("click", () => {
    form.reset();
    calculateAndRender();
  });

  themeToggle.addEventListener("click", () => {
    const nextTheme = document.body.getAttribute("data-theme") === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch (error) {
      // Ignore storage failures; theme still applies for current session.
    }
  });

  loadTheme();
  calculateAndRender();
})();
