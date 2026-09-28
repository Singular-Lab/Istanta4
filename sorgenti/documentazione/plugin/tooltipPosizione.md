# tooltipPosizione.js

**Cosa è:** dove ancorare il riquadro di un tooltip. Nasce con I20-981.

In UXP l'attributo `title` non basta a mostrare un suggerimento su un elemento creato da codice,
quindi il riquadro lo disegna il Plugin (`Utility.abilitaTooltipGlobali`, con la classe
`.jq-tooltip` di `index.html`). Qui sta il calcolo di dove metterlo.

## Da sapere

**La regola non guarda mai quanto è grande il riquadro.** In UXP quella misura non è attendibile:
passando da un elemento all'altro restituiva le dimensioni del testo precedente, spostando il
riquadro di quella differenza. Si usano solo il rettangolo dell'elemento, che è impaginato da
tempo, e i limiti massimi che imponiamo noi: il riquadro può essere più piccolo del limite, mai più
grande, e questo basta a tenerlo dentro il pannello.

## Variabili globali

| nome | valore | cos'è |
|---|---|---|
| `DISTANZA` | `6` | fra l'elemento e il suo riquadro |
| `BORDO` | `4` | margine minimo dai bordi del pannello |
| `ALTEZZA_MINIMA` | `40` | sotto questa altezza un riquadro non si legge: meglio metterlo dall'altra parte |

Sono esportate perché sono **la premessa del calcolo**, non dettagli di stile: è grazie ai limiti
che imponiamo noi che la regola può fare a meno di misurare il riquadro.

## Funzioni

- `testoTooltip(valore)` → il testo di un `title`, o `null` se non c'è niente da mostrare.
- `larghezzaMassima(finestra)` / `altezzaMassima(finestra)` → i limiti da mettere in stile.
- `ancoraggioTooltip(elemento, finestra, larghezzaDesiderata)` → dove attaccare il riquadro.
  Restituisce sempre `left`, poi **o `top` o `bottom`** secondo dove c'è più spazio: ancorando il
  bordo inferiore il riquadro cresce verso l'alto, e quanto sia alto non serve saperlo.

**Test:** `node --test tests/plugin/tooltipPosizione.test.js`
