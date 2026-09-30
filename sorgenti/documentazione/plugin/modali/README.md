# modali/ — le finestre di dialogo del Plugin

**Cosa è:** aprire e chiudere una modale, chiedere una conferma, mostrare un avviso, e le conferme
che precedono l'eliminazione di una referenza. Uscito da `utility.js` in I20-1012.

---

## I due file, un oggetto

| file | cosa fa | test |
|---|---|---|
| `modali.js` | **le modali**: `apriModal`, `chiudiModal`, `confirm`, `confirmCustom`, `popup`, `closeAllModal`, e gli elementi `.hideble` | `divisioneUtility.test.js`; sul sorgente `norender-elementi` e `reportIntegritaFlusso` |
| `eliminazione.js` | **le conferme dell'eliminazione**: la rimozione dall'impaginato, l'elemento non trovato, la parola da scrivere per cancellare dal tracciato del server | `confermaEliminazione.test.js` |

Le pagine: [modali.md](modali.md), [eliminazione.md](eliminazione.md).

**Un oggetto solo.** `modali.js` mescola `eliminazione.js` nel proprio oggetto con `Object.assign`,
come flusso e pannelli del [Report Integrità](../reportIntegrita/README.md): da fuori è sempre
`Modali.X`. Le conferme dell'eliminazione usano le modali — nascondono gli elementi `.hideble` e
li riaccendono — e separarle in due oggetti non darebbe niente.

## Come si collega

- **`Modali`** è l'oggetto di `modali.js`, e `indexNew.js` lo dichiara come globale. Lo chiamano
  quasi tutti i file del Plugin, e `index.html` dai suoi pulsanti (`Modali.chiudiModal()`).
- **Dentro `eliminazione.js` il nome `Modali` non c'è.** Le chiamate passano da `modali()`, che
  chiede il modulo al momento: è `modali.js` a caricare `eliminazione.js` mentre si carica, e un
  `require` in testa leggerebbe un oggetto ancora vuoto. Vale anche nelle callback, dove `this` non
  è l'oggetto. Un test lo controlla.
- **Le globali di `indexNew.js`** che usano: `$` e `jQuery`, `delay` per l'attesa delle conferme,
  `cloneElementWithEvents` per copiare nella modale l'elemento da mostrare.

Nessuno dei due file fa `require('indesign')`, e si caricano sotto Node. Il DOM è quello di UXP, e
come si vede una modale si prova solo in collaudo.

## Cosa è rimasto fuori

**`modalSelezioneElementoIncludiEscludi`**, le 382 righe di dialogo di `griglia.js`. Una casa
comune per le modali era già stata valutata e scartata (vedi il [README](../README.md), «Proposte
valutate e scartate»): quella modale è contenuto della griglia, e delle modali usa solo
l'infrastruttura.
