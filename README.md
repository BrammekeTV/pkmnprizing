# pkmnprizing

Prijzentool voor Pokémon-toernooien. Vul het aantal spelers, het inleggeld en je marge in, en de tool rekent uit hoeveel boosters en prijspakketten elke plek krijgt en wat je eraan overhoudt.

De website draait op GitHub Pages vanaf de root van `main`. Lokaal gebruiken kan ook: open `index.html` in een browser.

## Hoe de berekening werkt

1. **Divisies.** Masters, Seniors en Juniors krijgen elk een eigen prijzenpot. Juniors of Seniors met 4 of minder spelers spelen mee in de divisie erboven (Juniors bij Seniors, Seniors bij Masters). Alle stappen hieronder gelden per divisie.
2. **Budget.** Omzet is spelers × inleggeld. Met de doel-marge volgt hoeveel je aan boosters mag uitgeven, en dus hoeveel boosters er uitgaan.
3. **Deelnameprijzen.** Iedere speler buiten de top-cut krijgt het ingestelde aantal boosters.
4. **Top-cut.** De overige boosters gaan naar de top-cut, verdeeld met vaste gewichten (1e krijgt het meest). Zonder eigen invoer is de top-cut 4 tot en met 32 spelers, 6 tot en met 64 en daarboven 8.
5. **Prijspakketten.** Per plek, afgeleid van de boosters van die plek:
   - *1 per persoon*: iedere plek 1 pakket
   - *Helft van de boosters*: 10 boosters geeft 5 pakketten (oneven naar boven afgerond)
   - *Gelijk aan de boosters*: 10 boosters geeft 10 pakketten
6. **Controle.** De totale marge wordt vergeleken met je minimum en maximum.

## Bestanden

| Bestand | Inhoud |
|---|---|
| `index.html` | Pagina en invoervelden |
| `calculator.js` | Rekenlogica, los van de pagina (ook bruikbaar in Node) |
| `app.js` | Invoer lezen, valideren en resultaten tonen |
| `styles.css` | Opmaak, licht en donker thema |
| `prijzentool_gui.py` | Oorspronkelijke Tkinter-versie (verouderd: geen divisies, vaste boosterprijs, geen keuze voor prijspakketten) |

Na een wijziging aan `app.js`, `calculator.js` of `styles.css`: verhoog het versienummer (`?v=…`) in `index.html`, zodat browsers niet een oude kopie gebruiken.
