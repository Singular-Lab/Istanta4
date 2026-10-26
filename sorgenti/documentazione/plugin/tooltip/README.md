# tooltip/ — i suggerimenti al passaggio del mouse

**Cosa è:** il riquadro che compare quando il mouse si ferma su un elemento che ha un
suggerimento. In UXP l'attributo `title` su un elemento creato da codice non mostra niente, e i
`title` scritti in giro per il Plugin, un centinaio, erano muti: il riquadro lo disegna il Plugin
(I20-981).

Uscito da `utility.js` in I20-1012. Metà della logica stava già fuori, in `tooltipPosizione.js`;
ora le due metà stanno nella stessa cartella.

---

## I due file

| file | cosa fa | DOM | test |
|---|---|---|---|
| `tooltip.js` | **il ciclo e il disegno**: il gestore delegato che ascolta l'hover, il ritardo, il riquadro `.jq-tooltip`, il trasloco del vecchio `title` | sì | `divisioneUtility.test.js`, `reportIntegritaFlusso.test.js` sul sorgente |
| `posizione.js` | **dove mettere il riquadro**, senza misurarlo | no | `tooltipPosizione.test.js` |

Le pagine: [tooltip.md](tooltip.md), [posizione.md](posizione.md).

## Come si collega

- **`Tooltip`** è l'oggetto di `tooltip.js`, e `indexNew.js` lo dichiara come globale. Lo accende
  una volta sola, all'avvio: `Tooltip.abilitaTooltipGlobali()`.
- **Chi crea un elemento da codice** gli dà il suggerimento con `Tooltip.impostaTooltip(elemento,
  testo)`: lo fanno i pannelli del [Report Integrità](../reportIntegrita/README.md) e la scheda.
  Scrivere `elemento.title` come proprietà in UXP non crea l'attributo.
- **`tooltip.js` importa `posizione.js`** e lo chiama ancora `tooltipPosizione`: il codice spostato
  ha cambiato solo il percorso.

Nessuno dei due file fa `require('indesign')`, e si caricano entrambi sotto Node. `tooltip.js` usa
`$`, `document` e `window` al momento della chiamata, non al caricamento.
