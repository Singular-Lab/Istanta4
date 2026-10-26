# reperimentoFoto/ — procurarsi la foto giusta

**Cosa è:** quale foto va su una referenza, chiederla al server, scaricarla, sapere se quella nella
cartella Links è ancora quella del server, sostituirla, gestire primarie, secondarie, extra ed extra
auto, e le operazioni grosse sul pacchetto foto.

**Da non confondere con [sistemazioneFoto](../sistemazioneFoto/README.md)**, che decide *dove* la
foto sta dentro il box. Qui si decide *quale* foto, e *come* arriva. Sono due concetti e due
cartelle.

È il terzo concetto del Plugin ad avere una cartella sua (I20-1015). Prima era **sparso su sette
file**: `schedaRef.js`, `indexNew.js`, `cmd.js`, `utility.js` e i tre moduli puri in radice.

---

## Gli otto file

| file | cosa fa | InDesign | test |
|---|---|---|---|
| `schedaFoto.js` | **la parte foto della scheda**: cambio foto, proposta dalla cartella, anteprime, primarie e secondarie, extra | sì | attraverso la scheda: `schedaRef-aperturaFoto.test.js` e gli altri `schedaRef-*` |
| `reperimentoFoto.js` | **le operazioni**: le foto nei Links, il server, lo scaricamento singolo, il sync del pacchetto, il ricollegamento massivo, l'hash, i bolli | sì | sul sorgente: `reperimentoFoto.test.js` |
| `scaricamento.js` | **lo scaricamento vero** e l'md5: non riscaricare quello che c'è già | sì | — |
| `fotoPlacer.js` | **collocare il file nel riquadro**: `placeFoto`, `updateFoto`, `applicaNoRender` | sì | — |
| `autoSync.js` | la decisione del cambio foto: c'è già? chiederla? è arrivata davvero? | no | `fotoAutoSync.test.js` |
| `cacheHash.js` | la memoria degli hash md5 delle foto collegate | no | `cacheHashFoto.test.js` |
| `dataCaricamento.js` | la data sul badge e l'ordinamento delle foto | no | `data-caricamento-foto.test.js` |
| `fineScaricamento.js` | quando lo scaricamento del pacchetto foto è finito davvero, e il pulsante Fine (I20-1027) | no | `fineScaricamentoFoto.test.js` |

Le pagine: [schedaFoto.md](schedaFoto.md), [operazioni.md](operazioni.md),
[scaricamento.md](scaricamento.md), [fotoPlacer.md](fotoPlacer.md), [autoSync.md](autoSync.md),
[cacheHash.md](cacheHash.md), [dataCaricamento.md](dataCaricamento.md),
[fineScaricamento.md](fineScaricamento.md).

**Nomi di prima.** `scaricamento.js` era `cmd.js`; `autoSync.js`, `cacheHash.js` e
`dataCaricamento.js` erano `fotoAutoSync.js`, `cacheHashFoto.js` e `dataCaricamentoFoto.js`;
`fotoPlacer.js` era l'oggetto `FotoPlacer` dentro `utility.js`. Chi importa i tre moduli puri li
chiama ancora `fotoAutoSync`, `cacheHashFoto`, `DataCaricamentoFoto`. **`cmd` invece non c'è più**:
chi lo usava ora dice `scaricamentoFoto`, ed è la rinomina che I20-1002 aveva proposto.

---

## I tre livelli

La distinzione che conta, già annotata in I20-1002:

1. **Le operazioni concrete** — toccano disco o server: `fotoPresenteNeiLinks`,
   `getInfoFotoDalServer`, `scaricaFotoSingolaNeiLinks`, `scriviFileInCartella`, `getLinkHash`, i
   bolli; e lo scaricamento in `scaricamento.js`.
2. **Il ponte** — `assicuraFotoNeiLinks` inietta le operazioni concrete in `autoSync.js` e **gli
   lascia la decisione**. È il modello da conservare: la decisione sta dove si può provare, le
   operazioni dove devono stare.
3. **Le operazioni grosse** — il sync del pacchetto foto (`apriSchermataSyncPacchettoFoto`,
   `avviaSyncPacchettoFoto`, `abortSyncPacchettoFotoFunction`), `getFotoData`,
   `ricollegaFotoMassivo`, `impaginaFotoAppenaDisponibile`.

## Come si collega

- **La parte foto della scheda è la scheda.** `schedaRef.js` fa
  `Object.assign(schedaRef, require('./reperimentoFoto/schedaFoto'))`: i 36 membri restano
  `schedaRef.X`, un solo oggetto e un solo `this`, come per flusso e pannelli del
  [Report Integrità](../reportIntegrita/README.md). `schedaRef` continua a caricarsi sotto Node, e i
  test della scheda la provano così.
- **Le operazioni** sono l'oggetto `ReperimentoFoto`, che `indexNew.js` dichiara come globale.
  `index.html` (i pulsanti del pacchetto foto e del ricollegamento), la scheda, `confronti.js` (per
  `getLinkHash`) e `indexNew.js` stesso lo chiamano `ReperimentoFoto.X`.
- **Lo scaricamento** è la globale `scaricamentoFoto`, dichiarata da `indexNew.js`. Non la importa
  nessuno col `require`, per una ragione precisa: `scaricamento.js` al caricamento legge `uxp`, e
  sotto Node non si carica; se `schedaFoto.js` lo importasse, sotto Node non si caricherebbe più
  nemmeno `schedaRef`. È lo stesso modo in cui si usava `cmd`.
- **`FotoPlacer`** lo importano ancora tutti da `utility.js`, che lo **riesporta**:
  `module.exports.FotoPlacer = require('./reperimentoFoto/fotoPlacer')`. Il core
  (`indexNew.js`, `schedaRef`) e le agenzie Coopfi e Famila fanno `require('./utility')`, e nessuno
  di loro ha dovuto cambiare.

## Cosa è rimasto fuori

- **`escapeHtml` ed `elementiNoRenderDelBox`**, in `schedaRef.js`: li usano anche la clonazione e il
  noRender.
- **Il posto della foto nel box**: è [sistemazioneFoto](../sistemazioneFoto/README.md).

## I bolli, e il server

`getBolloNOFOTO` e `getBolloFOTONOFOUND` chiedono al server, **a ogni accesso dell'operatore**
(`cambioDiStatoDelSistema` in `indexNew.js`), il nome del bollo «foto mancante» e di quello «foto non
trovata» dell'agenzia, e li passano a `pluginMiddleware`. Passano da
`getNomeFotoLogoBolloBySigla`, che chiama `LoghiBolli/getBySigla/{codice}` di Istanta
(`SyncFotoController.getLogoBolloBySigla`).

In I20-1015 si è verificato che **quell'azione di Istanta ha un solo chiamante, il Plugin**, ed è
viva: non c'era niente da togliere, né qui né lato server.
