# tooltip.js — il ciclo e il disegno

**Cosa è:** l'oggetto `Tooltip`, 14 membri, uscito da `utility.js` in I20-1012. Panoramica:
[README.md](README.md).

## Quello che si chiama da fuori

- `abilitaTooltipGlobali()` → accende i suggerimenti su tutto il pannello, una volta sola. Un
  gestore delegato su `document` ascolta l'hover su qualunque elemento che abbia un `title` o un
  `data-tooltip`: valgono anche gli elementi creati dopo, che nei pannelli nascono in continuazione.
  Con elementi annidati vince il più interno. Un clic nasconde il riquadro.
- `impostaTooltip(elemento, testo)` → **il modo giusto di dare un suggerimento a un elemento creato
  da codice.** Scrive l'attributo `data-tooltip` e toglie `title`; un testo vuoto toglie il
  suggerimento.

## Quello che resta dentro

- `_testoDelTooltip(elemento)` → il testo da mostrare. Al primo passaggio del mouse **trasloca il
  vecchio `title`** su `data-tooltip`: InDesign un suggerimento suo per `title` lo mostrerebbe, e
  sarebbe il doppione di questo.
- `_mostraTooltip(elemento, testo)` → mette il riquadro dove dice [posizione.js](posizione.md),
  dopo `RITARDO_TOOLTIP` (350 ms).
- `nascondiTooltip()` → nasconde il riquadro e annulla quello in attesa.
- `_creaRiquadroTooltip()` → il riquadro unico, `#tooltipGlobale`, creato la prima volta.
- `_dimensioniPannello()` → le misure del pannello, da `#wrapper`: in UXP `window.innerWidth` non
  è la finestra del pannello.
- Lo stato: `_tooltipGlobaliAttivi`, `_riquadroTooltip`, `_timerTooltip`, `_ancoraTooltip`; le
  costanti `RITARDO_TOOLTIP`, `ATTRIBUTO_TOOLTIP` (`"data-tooltip"`), `LARGHEZZA_TOOLTIP` (260).

**Test:** `divisioneUtility.test.js` chiama `impostaTooltip`, `_testoDelTooltip` e
`nascondiTooltip` con elementi finti; `reportIntegritaFlusso.test.js` controlla il sorgente.
