# reportIntegrita/ — il Report Integrità

**Cosa è:** il confronto fra quello che c'è nel documento InDesign e quello che dice il server, e
tutto quello che l'operatore ci fa sopra: vedere cosa è cambiato, cosa è uscito, cosa è nuovo,
risolvere, mandare in whitelist, aprire la scheda di una referenza, scaricare il csv.

È il secondo concetto del Plugin ad avere **una cartella sua** (I20-1014, dopo
[sistemazioneFoto](../sistemazioneFoto/README.md)). Prima era **sparso su otto file**: `confronti.js`,
`indexNew.js`, `events.js`, `schedaRef.js` e i quattro moduli puri `report*.js` in radice.

---

## I sei file

| file | cosa fa | InDesign | test |
|---|---|---|---|
| `reportIntegrita.js` | **il flusso**: avvio, sync col server, file del report e della whitelist, azioni sulle segnalazioni, scheda aperta dal report, csv, liste da confrontare, impaginazione dei nuovi | sì | sul sorgente: `reportIntegritaFlusso.test.js`, `reportIntegrita.test.js` |
| `pannelli.js` | **l'interfaccia**: i pannelli Cambiati, Eliminati, Nuovi e Confronti, righe, pulsanti, scorrimento, dissolvenza, colori | sì | sul sorgente, come sopra |
| `avvio.js` | le soglie e le decisioni: quando il report parte, quando smette di valere, cosa resta da segnalare dopo un ricontrollo | no | `reportIntegritaAvvio.test.js` |
| `sezioneConfronti.js` | la sezione Confronti: cosa è cambiato nei campi che l'agenzia tiene d'occhio | no | `reportConfronti.test.js` |
| `csv.js` | il csv: nome del file, ordine delle righe, virgolettatura | no | `reportConfrontoCsv.test.js` |
| `conteggi.js` | i numeri sulle linguette | no | `reportConteggi.test.js` |
| `barraScorrimento.js` | i conti della barra di scorrimento dei Nuovi, che in UXP non scorrono (dal I20-1007) | no | `barraScorrimento.test.js` |
| `dissolvenza.js` | i conti della dissolvenza delle righe risolte, perché `opacity` non si ridisegna (dal I20-1007) | no | `dissolvenza.test.js` |

Le pagine:

- [flusso.md](flusso.md) — `reportIntegrita.js`: dall'avvio alla chiusura;
- [pannelli.md](pannelli.md) — `pannelli.js`: come sono fatti i pannelli;
- [avvio.md](avvio.md), [sezioneConfronti.md](sezioneConfronti.md), [csv.md](csv.md),
  [conteggi.md](conteggi.md) — le quattro regole pure.

I quattro moduli puri si chiamavano `reportIntegritaAvvio.js`, `reportConfronti.js`,
`reportConfrontoCsv.js` e `reportConteggi.js`. **Dentro la cartella il prefisso non serve più**, e
`reportConfronti` è diventato `sezioneConfronti` per non confonderlo con `confronti.js`. Chi li
importa usa ancora il nome di prima come variabile (`reportIntegritaAvvio`, `reportConfronti`...):
il codice spostato non ha cambiato un nome, solo i percorsi. I file di test hanno tenuto il nome.

---

## Flusso e pannelli sono un oggetto solo

`reportIntegrita.js` definisce `ReportIntegrita` e ci mescola dentro `pannelli.js`:

```js
Object.assign(ReportIntegrita, require('./pannelli'));
```

**A runtime c'è un solo oggetto e un solo `this`**, come quando stavano insieme in `confronti.js`:
un pannello chiama il flusso con `this.`, il flusso chiama un pannello con `this.`, e lo stato
creato a runtime (`this._confrontoReportState`, `this._schedaDalReport`...) è lo stesso per tutti.
La divisione è di file, non di stato. `pannelli.js` non importa il report e non lo nomina mai.

**Cosa sta dove.** In `pannelli.js` quello che **disegna o aggiorna il pannello**: i costruttori
`_cr*`, `_build*`, `_render*`, chi riempie e ridisegna (`_refresh*`, `_riempi*`, `_ridisegna*`),
lo scorrimento e le colonne della lista dei nuovi, la dissolvenza delle righe risolte, gli stili, i
colori, le conferme a video. **Tutto il resto in `reportIntegrita.js`.** Un membro che disegna *e*
decide sta nel flusso: `_ricontrollaReferenzaDopoScheda` è l'esempio.

## Come si usa

`indexNew.js` dichiara `ReportIntegrita`; `events.js` e `index.html` lo usano da lì.

- `ReportIntegrita.avviaReportIntegrita(idKit)` — dalla riga di sincronizzazione del tracciato
  (`creaRigaSync` in `indexNew.js`), quando l'operatore sceglie il report nel picker;
- `ReportIntegrita.chiudiReportIntegrita()` — dal pulsante di chiusura in `index.html`;
- `ReportIntegrita.chiudiSeNonValePiu(documentoAttuale)` — da `events.js`, a intervalli;
- `ReportIntegrita.etichettaSegnalazione(label)` — dalla scheda, per mostrare le segnalazioni;
- `ReportIntegrita.eliminaReportIntegritaLocale(idKit)` — da `scaricaContenutoKit`, quando la lista
  cambia e il report salvato non vale più.

**Nessuna agenzia usa il report**, quindi non ci sono rimandi.

## Cosa resta fuori, e perché

- **Il motore di confronto**, in [confronti.js](../confronti.md): `confrontoBox`,
  `confrontoBoxCompiledFieldPreAnalisi`, `mappaturaImpaginato`, `semplificazioneMappaImpaginato`,
  `decodeSpecialCharacters`. Lo usano anche il cambio strutturale, la reimpaginazione di una
  referenza, la scheda, la griglia e il ricollegamento delle foto. Il report lo chiama come
  `confronti.X`.
- **`datiPrimarioPerConfronto`**, in `indexNew.js`: la usa anche la reimpaginazione.
- **L'aggancio della scheda al report**, in `schedaRef.js`: `apertaDalReport`,
  `DAL_REPORT_VOCI_BARRA_NASCOSTE`, `DAL_REPORT_VOCI_SOTTOMENU_NASCOSTE`, `refDalBoxPerReport`,
  `serveRiaggancioDalReport`. Dicono come si comporta la scheda quando la apre il report — la barra
  e il sottomenù si riducono — e sono stato della scheda: il report li imposta da fuori. Spostarli
  renderebbe la scheda dipendente dal report per la propria interfaccia.
- **`barraScorrimento.js` e `dissolvenza.js`**, in radice: li usa solo il report, ma sono aggiramenti
  dei limiti di UXP e stanno con quelli, nel resto di I20-1007.

## Le globali

Il report usa, come faceva `confronti.js`, le globali di `indexNew.js`: `idKitLavorazione`,
`pathLavorazione`, `docInLavorazione`, `messaggioUtente`, `showLoading`, `hideLoading`,
`scaricaContenutoKitAsync`, `datiPrimarioPerConfronto`, `indesignEvents`, `schedaRef` e gli altri
moduli che `indexNew` dichiara. Le funzioni arrivate da `indexNew.js` le usavano già, e sono
rimaste le stesse.

**`cacheHashFoto` invece la importa** (`require('../reperimentoFoto/cacheHash')`, da I20-1036): a
fine confronto ne scrive le statistiche nel log. Fino a I20-1015 era una globale di `indexNew`; da lì
è uscita insieme a [reperimentoFoto](../reperimentoFoto/README.md), il report la chiamava ancora per
nome, e il confronto finiva in un `ReferenceError` (IDX-41) proprio prima di mostrare il report.
Quando una globale esce da `indexNew`, chi la usa ancora va cercato in tutto il Plugin: il test
`chi usa le globali tolte da indexNew le dichiara nel proprio file`, in `reperimentoFoto.test.js`,
lo fa per le tre di I20-1015.

## Cosa è stato tolto in I20-1014

- Dal motore, due membri senza chiamanti: `testMappaturaImpaginato` e `ripristinaCacheConfronto`
  (la chiamata a `Menabo/restoreCacheConfronto` e i messaggi `CNF-016`…`CNF-019`), su decisione
  dell'operatore.
- Quattro `require` di `confronti.js` che nessuno usava: `InputEditController`, `GarbageCollector`,
  `{ parse }` da `path`, `{ ref }` da `process`.
- I marcatori `//#region` e `//#endregion`, che dopo la divisione sarebbero rimasti spaiati fra i
  file, e le parole `REPORT INTEGRITA'` in testa ai commenti: servivano a ritrovare i pezzi sparsi.
- Il percorso del file del report che `indexNew.js` ricostruiva a mano — vedi [flusso.md](flusso.md).
