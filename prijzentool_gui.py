import tkinter as tk
from tkinter import ttk, messagebox
from dataclasses import dataclass
from typing import List

MIN_PLAYERS = 4

# Financieel
BOOSTER_COST_EUR = 5.0
PRIZE_PACK_COST_EUR = 0.0  # gratis

# Deelnameprijs (buiten top cut)
PARTICIPATION_BOOSTERS = 1
PARTICIPATION_PRIZE_PACKS = 1

# Doelmarge (aanpasbaar via GUI)
DEFAULT_TARGET_MARGIN = 0.30
DEFAULT_MIN_MARGIN = 0.30
DEFAULT_MAX_MARGIN = 0.40

# Weights per top-cut grootte
BOOSTER_WEIGHTS = {
    4: [14, 8, 7, 7],
    6: [14, 8, 7, 7, 5, 5],
    8: [14, 8, 7, 7, 5, 5, 4, 4],
}
PRIZE_WEIGHTS = {
    4: [15, 11, 8, 6],
    6: [15, 11, 8, 6, 5, 5],
    8: [15, 11, 8, 6, 5, 5, 4, 4],
}


def get_top_cut(n: int) -> int:
    if n <= 32:
        return 4
    elif n <= 64:
        return 6
    else:
        return 8


@dataclass(frozen=True)
class Prize:
    boosters: int
    prize_packs: int


def apportion(total: int, weights: List[int]) -> List[int]:
    """Hamilton / largest remainder zodat de som exact 'total' is."""
    if total <= 0:
        return [0] * len(weights)

    wsum = sum(weights)
    quotas = [total * (w / wsum) for w in weights]
    floors = [int(q) for q in quotas]
    remainder = total - sum(floors)

    remainders = [(quotas[i] - floors[i], i) for i in range(len(weights))]
    remainders.sort(key=lambda x: (-x[0], x[1]))

    result = floors[:]
    for k in range(remainder):
        _, idx = remainders[k % len(weights)]
        result[idx] += 1
    return result


def prize_packs_total(n: int) -> int:
    return max(0, round(1.5 * n))


def compute_with_margin(n: int, entry_fee: float, target_margin: float, min_margin: float, max_margin: float):
    top_cut = get_top_cut(n)
    revenue = n * entry_fee

    max_cost_target = revenue * (1.0 - target_margin)
    max_boosters_target = int(max_cost_target // BOOSTER_COST_EUR)

    non_top = max(0, n - top_cut)

    participation_boosters_total = non_top * PARTICIPATION_BOOSTERS
    participation_prize_total = non_top * PARTICIPATION_PRIZE_PACKS

    top_boosters_total = max(0, max_boosters_target - participation_boosters_total)

    base_prize_total = prize_packs_total(n)
    top_prize_total = max(0, base_prize_total - participation_prize_total)

    bw = BOOSTER_WEIGHTS[top_cut]
    pw = PRIZE_WEIGHTS[top_cut]

    top_boosters_split = apportion(top_boosters_total, bw)
    top_prize_split = apportion(top_prize_total, pw)

    top_prizes = [
        Prize(boosters=top_boosters_split[i], prize_packs=top_prize_split[i])
        for i in range(top_cut)
    ]

    total_boosters_out = participation_boosters_total + top_boosters_total
    total_prize_out = participation_prize_total + top_prize_total

    cost = total_boosters_out * BOOSTER_COST_EUR
    profit = revenue - cost
    margin = (profit / revenue) if revenue > 0 else 0.0

    return {
        "revenue": revenue,
        "cost": cost,
        "profit": profit,
        "margin": margin,
        "min_margin": min_margin,
        "max_margin": max_margin,
        "top_cut": top_cut,
        "non_top_players": non_top,
        "participation_total": {
            "boosters": participation_boosters_total,
            "prize_packs": participation_prize_total,
        },
        "top_total": {
            "boosters": top_boosters_total,
            "prize_packs": top_prize_total,
        },
        "top_prizes": top_prizes,
        "total_out": {
            "boosters": total_boosters_out,
            "prize_packs": total_prize_out,
        },
        "base_prize_total": base_prize_total,
    }


class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Prijzenschema + Winst")
        self.geometry("880x720")
        self.resizable(False, False)

        root = ttk.Frame(self, padding=14)
        root.pack(fill="both", expand=True)

        # --- Invoer ---
        input_frame = ttk.LabelFrame(root, text="Invoer", padding=12)
        input_frame.pack(fill="x")

        # Rij 0: spelers + inleggeld + knoppen
        ttk.Label(input_frame, text="Aantal spelers:").grid(row=0, column=0, sticky="w")
        self.players_var = tk.StringVar(value="20")
        ttk.Entry(input_frame, textvariable=self.players_var, width=10).grid(
            row=0, column=1, sticky="w", padx=(8, 16)
        )

        ttk.Label(input_frame, text="Inleggeld (€):").grid(row=0, column=2, sticky="w")
        self.fee_var = tk.StringVar(value="15.00")
        ttk.Entry(input_frame, textvariable=self.fee_var, width=10).grid(
            row=0, column=3, sticky="w", padx=(8, 16)
        )

        ttk.Button(input_frame, text="Bereken", command=self.on_calculate).grid(
            row=0, column=4, padx=(12, 0)
        )
        ttk.Button(input_frame, text="Reset", command=self.on_reset).grid(
            row=0, column=5, padx=(8, 0)
        )

        # Rij 1: marge instellingen
        ttk.Label(input_frame, text="Doel-marge (%):").grid(row=1, column=0, sticky="w", pady=(10, 0))
        self.target_margin_var = tk.StringVar(value=str(int(DEFAULT_TARGET_MARGIN * 100)))
        ttk.Entry(input_frame, textvariable=self.target_margin_var, width=10).grid(
            row=1, column=1, sticky="w", padx=(8, 16), pady=(10, 0)
        )

        ttk.Label(input_frame, text="Min-marge (%):").grid(row=1, column=2, sticky="w", pady=(10, 0))
        self.min_margin_var = tk.StringVar(value=str(int(DEFAULT_MIN_MARGIN * 100)))
        ttk.Entry(input_frame, textvariable=self.min_margin_var, width=10).grid(
            row=1, column=3, sticky="w", padx=(8, 16), pady=(10, 0)
        )

        ttk.Label(input_frame, text="Max-marge (%):").grid(row=1, column=4, sticky="w", pady=(10, 0))
        self.max_margin_var = tk.StringVar(value=str(int(DEFAULT_MAX_MARGIN * 100)))
        ttk.Entry(input_frame, textvariable=self.max_margin_var, width=10).grid(
            row=1, column=5, sticky="w", padx=(8, 0), pady=(10, 0)
        )

        # Rij 2: hint
        hint = (
            f"Min spelers: {MIN_PLAYERS}.  |  Booster inkoop: €{BOOSTER_COST_EUR:.2f}.  |  Prize packs gratis.\n"
            f"Deelnameprijs (buiten top-cut): {PARTICIPATION_BOOSTERS} booster + {PARTICIPATION_PRIZE_PACKS} prize pack.\n"
            "Top-cut: ≤32 spelers → Top 4  |  33–64 spelers → Top 6  |  ≥65 spelers → Top 8"
        )
        ttk.Label(input_frame, text=hint, wraplength=840).grid(
            row=2, column=0, columnspan=6, sticky="w", pady=(10, 0)
        )

        # --- Resultaat ---
        out_frame = ttk.LabelFrame(root, text="Resultaat", padding=12)
        out_frame.pack(fill="both", expand=True, pady=(12, 0))

        self.result_text = tk.Text(out_frame, height=30, wrap="word")
        self.result_text.pack(fill="both", expand=True)
        self.result_text.configure(state="disabled")

        self.on_calculate()

    def on_reset(self):
        self.players_var.set(str(MIN_PLAYERS))
        self.fee_var.set("15.00")
        self.target_margin_var.set(str(int(DEFAULT_TARGET_MARGIN * 100)))
        self.min_margin_var.set(str(int(DEFAULT_MIN_MARGIN * 100)))
        self.max_margin_var.set(str(int(DEFAULT_MAX_MARGIN * 100)))
        self.on_calculate()

    def _parse_margin(self, var: tk.StringVar, label: str):
        """Parse een margeveld (0–100) naar een float (0.0–1.0)."""
        try:
            val = float(var.get().strip().replace(",", "."))
            if not (0 < val < 100):
                raise ValueError
            return val / 100.0
        except Exception:
            messagebox.showerror("Fout", f"Vul een geldig percentage (1–99) in voor '{label}'.")
            return None

    def on_calculate(self):
        # Valideer spelers
        try:
            n = int(self.players_var.get().strip())
        except Exception:
            messagebox.showerror("Fout", "Vul een geldig geheel getal in voor 'Aantal spelers'.")
            return

        # Valideer inleggeld
        try:
            entry_fee = float(self.fee_var.get().strip().replace(",", "."))
            if entry_fee <= 0:
                raise ValueError
        except Exception:
            messagebox.showerror("Fout", "Vul een geldig positief bedrag in voor 'Inleggeld'.")
            return

        # Valideer marges
        target_margin = self._parse_margin(self.target_margin_var, "Doel-marge")
        if target_margin is None:
            return
        min_margin = self._parse_margin(self.min_margin_var, "Min-marge")
        if min_margin is None:
            return
        max_margin = self._parse_margin(self.max_margin_var, "Max-marge")
        if max_margin is None:
            return

        if not (min_margin <= target_margin <= max_margin):
            messagebox.showerror(
                "Fout",
                "Doel-marge moet tussen min-marge en max-marge liggen.\n"
                f"Ingevuld: min={min_margin*100:.0f}%, doel={target_margin*100:.0f}%, max={max_margin*100:.0f}%"
            )
            return

        if n < MIN_PLAYERS:
            messagebox.showwarning("Te weinig spelers", f"Minimum aantal spelers is {MIN_PLAYERS}.")
            self._set_text(f"Aantal spelers: {n}\nGeen berekening: minimum is {MIN_PLAYERS}.")
            return

        data = compute_with_margin(n, entry_fee, target_margin, min_margin, max_margin)
        top_cut = data["top_cut"]

        lines = []
        lines.append(f"Aantal spelers : {n}")
        lines.append(f"Inleggeld      : €{entry_fee:.2f}/speler")
        lines.append(f"Top-cut        : Top {top_cut}")
        lines.append(f"Marge target   : {target_margin*100:.0f}%  (band {min_margin*100:.0f}–{max_margin*100:.0f}%)")
        lines.append("")
        lines.append("── Prijzen ──────────────────────────────────")
        lines.append(f"  Spelers buiten top {top_cut} : {data['non_top_players']}")
        lines.append(
            f"  Deelnameprijzen totaal : {data['participation_total']['boosters']} boosters"
            f" + {data['participation_total']['prize_packs']} prize packs"
        )
        lines.append(
            f"  Over voor top {top_cut}         : {data['top_total']['boosters']} boosters"
            f" + {data['top_total']['prize_packs']} prize packs"
        )
        lines.append("")
        lines.append(f"── Top {top_cut} verdeling ───────────────────────────")
        ordinals = ["1e", "2e", "3e", "4e", "5e", "6e", "7e", "8e"]
        for i, p in enumerate(data["top_prizes"]):
            lines.append(f"  {ordinals[i]}: {p.boosters} boosters + {p.prize_packs} prize packs")
        lines.append("")
        lines.append(
            f"Totaal uitgedeeld : {data['total_out']['boosters']} boosters"
            f" + {data['total_out']['prize_packs']} prize packs"
        )
        lines.append(f"(Prize packs totaal volgens formule: {data['base_prize_total']})")
        lines.append("")
        lines.append("── Financieel ───────────────────────────────")
        lines.append(f"  Omzet  : €{data['revenue']:.2f}")
        lines.append(
            f"  Kosten : €{data['cost']:.2f}"
            f"  ({data['total_out']['boosters']} boosters × €{BOOSTER_COST_EUR:.2f})"
        )
        lines.append(f"  Winst  : €{data['profit']:.2f}")
        lines.append(f"  Marge  : {data['margin']*100:.1f}%")

        if data["margin"] < min_margin:
            lines.append("")
            lines.append(f"⚠  LET OP: marge is onder {min_margin*100:.0f}% — verlaag prijzen of verhoog inleg.")
        elif data["margin"] > max_margin:
            lines.append("")
            lines.append(f"ℹ  Info: marge is boven {max_margin*100:.0f}% — je kunt eventueel meer prijzen geven.")

        if data["top_total"]["boosters"] == 0 and n > top_cut:
            lines.append("")
            lines.append(f"⚠  LET OP: top {top_cut} krijgt 0 boosters (budget gaat op aan deelnameboosters).")

        self._set_text("\n".join(lines))

    def _set_text(self, text: str):
        self.result_text.configure(state="normal")
        self.result_text.delete("1.0", "end")
        self.result_text.insert("1.0", text)
        self.result_text.configure(state="disabled")


if __name__ == "__main__":
    App().mainloop()