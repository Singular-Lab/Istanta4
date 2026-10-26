# pluginMiddleware.js

**Cosa è:** il mediatore fra il Plugin e la configurazione del cliente. Quando il codice ha bisogno
di sapere «come si comporta *questo* cliente», lo chiede qui.

## La cosa da capire prima di tutto il resto

**Le fonti sono due, e un interruttore sceglie.**

```javascript
getCampo(nomeCampo) {
    if (me.callCustom) return customAgenzia[nomeCampo];   // il custom.js montato
    return me.customPluginDB?.[nomeCampo];                // la configurazione dal server
}
```

`callCustom` viene dal [custom.js](custom.md) del cliente. Se è **vero** comanda il codice del
cliente montato in radice; se è **falso** comanda la configurazione scaricata dal server. Oggi
Edro21 ha `callCustom: false`, quindi lavora con il server.

Quasi ogni metodo di questo file ha la stessa forma a due rami, ed è la traduzione in codice della
direzione in cui il progetto si sta muovendo: **dal comportamento scritto in un `.js` per cliente
alla configurazione dichiarata sul server.**

## Variabili

| nome | cos'è |
|---|---|
| `callCustom` | quale delle due fonti comanda |
| `customPluginDB` | la configurazione scaricata, quando comanda il server |

## A che domande risponde

Le quaranta funzioni rispondono tutte a domande sul cliente corrente:

| famiglia | esempi |
|---|---|
| campi ed etichette | `getCampo`, `getEtichette`, `replacePlaceholders`, `getInfoExtra` |
| cosa si può modificare | `isSchemaEditable`, `getEditabilitaSchedaRef`, `getAvvisoCambioPrimario` |
| testo in overflow | `getOverflowsInstruction`, `getOverflowDirection`, `getDefaultOverflowDirection` |
| logo e bolli | `getFitTypeLogo`, `setBolloNOFOTO`, `setBolloFOTONOFOUND` |
| meccanica e lavorazione | `getDeclinazioneMeccanica`, `getSuffissoLavorazione`, `requiresIngombro` |
| librerie InDesign | `getLibreria` |
| tracciato e ordinamento | `getColonneTracciatoIntestazione`, `applicaSchemaDiOrdinamentoConPesi`, `getRegoleApplicazioneDNA` |
| contesto promo | `contestoPromoDelRecord`, `recordsDellaLavorazione`, `contestoPromoDellaLavorazione` |
| regole condizionali | `valutaBlocchiRegole`, `valutaBloccoRegole`, `valutaRegolaCondizione` |

## Ricollocazioni proposte

**Quattro funzioni non mediano niente.** Non hanno la forma a due rami e non leggono configurazione:
sono utilità generiche finite qui perché servivano qui.

| funzione | cosa fa | destinazione |
|---|---|---|
| `normalize(value)` | minuscolo e senza spazi | `utility.js` |
| `isIn(actual, expected)` | appartenenza a un elenco | `utility.js` |
| `getValueByPath(source, path)` | legge `a.b.c` da un oggetto | `utility.js` |
| `toFitOptions(tipoFit)` | da numero a `FitOptions` di InDesign | `utility.js`, o accanto agli `enum*` di `CssFramework` |

**`getValueByPath` ha una gemella:** `cambiStrutturali._getNestedValue` fa esattamente la stessa
cosa, con lo stesso ordine dei due tentativi — prima la chiave letterale, poi il percorso.

In I20-1002 le due sono state **allineate nel comportamento**, perché quella di `cambiStrutturali`
aveva il corpo commentato e non scendeva più nei percorsi. **Non sono state unite fisicamente**, e
la ragione va conosciuta: `pluginMiddleware.js` e `utility.js` richiedono InDesign e sotto Node non
si caricano, mentre `cambiStrutturali.js` sì e ha il suo test. Importare l'uno dall'altro farebbe
perdere quel test. **Per unirle serve un modulo puro che entrambi possano importare.**

## Una nota di disegno, non una ricollocazione

`setBolloNOFOTO` e `setBolloFOTONOFOUND` hanno la forma a due rami come le altre, quindi *sono*
mediazione — ma ciò che mediano è un'**operazione su InDesign**, non un valore di configurazione.
Se il middleware debba delegare operazioni oltre che rispondere a domande è una decisione di
disegno.
