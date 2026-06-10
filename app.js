(() => {
  const calculator = window.prizeCalculator;

  if (!calculator) {
    return;
  }

  const ordinalLabels = ["1e", "2e", "3e", "4e", "5e", "6e", "7e", "8e"];
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

  const form = document.querySelector("#calculator-form");
  const resetButton = document.querySelector("#reset-button");
  const themeToggle = document.querySelector("#theme-toggle");
  const banner = document.querySelector("#message-banner");
  const summaryCards = document.querySelector("#summary-cards");
  const warnings = document.querySelector("#warnings");
  const prizeBreakdown = document.querySelector("#prize-breakdown");
  const topCutBody = document.querySelector("#top-cut-body");
  const THEME_STORAGE_KEY = "pkmnprizing-theme";

  function parseDecimal(value) {
    return Number.parseFloat(String(value).trim().replace(",", "."));
  }

  function parseMargin(input, label) {
    const value = parseDecimal(input.value);
    if (!Number.isFinite(value) || value <= 0 || value >= 100) {
      throw new Error(`Vul een geldig percentage (1–99) in voor '${label}'.`);
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

  function showBanner(message, tone = "error") {
    banner.textContent = message;
    banner.className = `message-banner ${tone}`;
  }

  function hideBanner() {
    banner.textContent = "";
    banner.className = "message-banner hidden";
  }

  function renderMetricList(container, items) {
    container.innerHTML = items
      .map(
        ([label, value]) => `
          <article class="metric-row">
            <p>${label}</p>
            <strong>${value}</strong>
          </article>
        `
      )
      .join("");
  }

  function setSummaryCards(data, playerCount, entryFee, targetMargin) {
    const cards = [
      ["Aantal spelers", String(playerCount)],
      ["Top-cut", `Top ${data.top_cut}`],
      ["Inleggeld", `${formatEuro(entryFee)}/speler`],
      ["Doel-marge", `${formatWholePercent(targetMargin)} (band ${formatWholePercent(data.min_margin)}–${formatWholePercent(data.max_margin)})`],
      ["Omzet", formatEuro(data.revenue)],
      ["Kosten", formatEuro(data.cost)],
      ["Winst", formatEuro(data.profit)],
      ["Werkelijke marge", formatPercent(data.margin)],
    ];
    renderMetricList(summaryCards, cards);
  }

  function setPrizeBreakdown(data) {
    const items = [
      ["Spelers buiten top-cut", data.non_top_players],
      ["Deelnameprijzen totaal", `${data.participation_total.boosters} boosters + ${data.participation_total.prize_packs} prize packs`],
      ["Voor top-cut beschikbaar", `${data.top_total.boosters} boosters + ${data.top_total.prize_packs} prize packs`],
      ["Totaal uitgedeeld", `${data.total_out.boosters} boosters + ${data.total_out.prize_packs} prize packs`],
      ["Prize packs volgens formule", data.base_prize_total],
    ];

    renderMetricList(prizeBreakdown, items);
  }

  function setTopCutTable(data) {
    topCutBody.innerHTML = data.top_prizes
      .map(
        (prize, index) => `
          <tr>
            <td>${ordinalLabels[index]}</td>
            <td>${prize.boosters}</td>
            <td>${prize.prize_packs}</td>
          </tr>
        `
      )
      .join("");
  }

  function setWarnings(data, minMargin, maxMargin, playerCount) {
    const warningMessages = [];

    if (data.margin < minMargin) {
      warningMessages.push({
        tone: "error",
        text: `LET OP: marge is onder ${formatWholePercent(minMargin)} — verlaag prijzen of verhoog inleg.`,
      });
    } else if (data.margin > maxMargin) {
      warningMessages.push({
        tone: "info",
        text: `Info: marge is boven ${formatWholePercent(maxMargin)} — je kunt eventueel meer prijzen geven.`,
      });
    }

    if (data.top_total.boosters === 0 && playerCount > data.top_cut) {
      warningMessages.push({
        tone: "warning",
        text: `LET OP: top ${data.top_cut} krijgt 0 boosters (budget gaat op aan deelnameboosters).`,
      });
    }

    warnings.innerHTML = warningMessages
      .map(
        ({ tone, text }) => `
          <div class="warning-card ${tone}">
            <strong>${text}</strong>
          </div>
        `
      )
      .join("");
  }

  function getInputs() {
    const playersInput = document.querySelector("#players");
    const feeInput = document.querySelector("#entry-fee");
    const targetMarginInput = document.querySelector("#target-margin");
    const minMarginInput = document.querySelector("#min-margin");
    const maxMarginInput = document.querySelector("#max-margin");

    const playerCount = Number.parseInt(playersInput.value.trim(), 10);
    if (!Number.isInteger(playerCount)) {
      throw new Error("Vul een geldig geheel getal in voor 'Aantal spelers'.");
    }

    const entryFee = parseDecimal(feeInput.value);
    if (!Number.isFinite(entryFee) || entryFee <= 0) {
      throw new Error("Vul een geldig positief bedrag in voor 'Inleggeld'.");
    }

    const targetMargin = parseMargin(targetMarginInput, "Doel-marge");
    const minMargin = parseMargin(minMarginInput, "Min-marge");
    const maxMargin = parseMargin(maxMarginInput, "Max-marge");

    if (!(minMargin <= targetMargin && targetMargin <= maxMargin)) {
      throw new Error(
        `Doel-marge moet tussen min-marge en max-marge liggen.\nIngevuld: min=${formatWholePercent(minMargin)}, doel=${formatWholePercent(targetMargin)}, max=${formatWholePercent(maxMargin)}`
      );
    }

    return {
      playerCount,
      entryFee,
      targetMargin,
      minMargin,
      maxMargin,
    };
  }

  function calculateAndRender() {
    hideBanner();

    const { playerCount, entryFee, targetMargin, minMargin, maxMargin } = getInputs();

    if (playerCount < calculator.MIN_PLAYERS) {
      showBanner(`Minimum aantal spelers is ${calculator.MIN_PLAYERS}.`, "warning");
      summaryCards.innerHTML = "";
      warnings.innerHTML = "";
      prizeBreakdown.innerHTML = "";
      topCutBody.innerHTML = "";
      return;
    }

    const data = calculator.computeWithMargin(playerCount, entryFee, targetMargin, minMargin, maxMargin);

    setSummaryCards(data, playerCount, entryFee, targetMargin);
    setPrizeBreakdown(data);
    setTopCutTable(data);
    setWarnings(data, minMargin, maxMargin, playerCount);
  }

  function resetForm() {
    document.querySelector("#players").value = String(calculator.MIN_PLAYERS);
    document.querySelector("#entry-fee").value = "15.00";
    document.querySelector("#target-margin").value = String(calculator.DEFAULT_TARGET_MARGIN * 100);
    document.querySelector("#min-margin").value = String(calculator.DEFAULT_MIN_MARGIN * 100);
    document.querySelector("#max-margin").value = String(calculator.DEFAULT_MAX_MARGIN * 100);
    calculateAndRender();
  }

  function updateThemeToggle(theme) {
    if (theme === "dark") {
      themeToggle.textContent = "☀️ Licht";
      themeToggle.setAttribute("aria-label", "Schakel lichte modus");
      return;
    }

    themeToggle.textContent = "🌙 Donker";
    themeToggle.setAttribute("aria-label", "Schakel donkere modus");
  }

  function applyTheme(theme) {
    document.body.setAttribute("data-theme", theme);
    updateThemeToggle(theme);
  }

  function loadTheme() {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === "dark" || storedTheme === "light") {
      applyTheme(storedTheme);
      return;
    }

    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(prefersDark ? "dark" : "light");
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      calculateAndRender();
    } catch (error) {
      showBanner(error.message, "error");
    }
  });

  resetButton.addEventListener("click", () => {
    try {
      resetForm();
      hideBanner();
    } catch (error) {
      showBanner(error.message, "error");
    }
  });

  themeToggle.addEventListener("click", () => {
    const activeTheme = document.body.getAttribute("data-theme") === "dark" ? "dark" : "light";
    const nextTheme = activeTheme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  });

  try {
    loadTheme();
    calculateAndRender();
  } catch (error) {
    showBanner(error.message, "error");
  }
})();
