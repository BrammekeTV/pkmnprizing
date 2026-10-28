# pkmnprizing

Prijzentool voor Pokémon-toernooien. Vul het aantal spelers, het inleggeld en je marge in, en de tool rekent uit hoeveel boosters en prijspakketten elke plek krijgt en wat je eraan overhoudt.

De website draait op GitHub Pages vanaf de root van `main`. Lokaal gebruiken kan ook: open `index.html` in een browser.

## Hoe de berekening werkt

1. **Budget.** Omzet is spelers × inleggeld. Met de doel-marge volgt hoeveel je aan boosters mag uitgeven, en dus hoeveel boosters er uitgaan.
2. **Deelnameprijzen.** Iedere speler buiten de top-cut krijgt het ingestelde aantal boosters.
3. **Top-cut.** De overige boosters gaan naar de top-cut, verdeeld met vaste gewichten (1e krijgt het meest).
4. **Prijspakketten.** Per plek, afgeleid van de boosters van die plek:
   - *1 per persoon*: iedere plek 1 pakket
   - *Helft van de boosters*: 10 boosters geeft 5 pakketten (oneven naar boven afgerond)
   - *Gelijk aan de boosters*: 10 boosters geeft 10 pakketten
5. **Controle.** De werkelijke marge wordt vergeleken met je minimum en maximum.

## Bestanden

| Bestand | Inhoud |
|---|---|
| `index.html` | Pagina en invoervelden |
| `calculator.js` | Rekenlogica, los van de pagina (ook bruikbaar in Node) |
| `app.js` | Invoer lezen, valideren en resultaten tonen |
| `styles.css` | Opmaak, licht en donker thema |
| `prijzentool_gui.py` | Oorspronkelijke Tkinter-versie (verouderd: vaste boosterprijs, geen keuze voor prijspakketten) |

Na een wijziging aan `app.js`, `calculator.js` of `styles.css`: verhoog het versienummer (`?v=…`) in `index.html`, zodat browsers niet een oude kopie gebruiken.
