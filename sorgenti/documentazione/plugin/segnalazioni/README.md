# segnalazioni/ — le segnalazioni di impaginazione

**Cosa è:** gli avvisi che nascono **durante l'impaginazione** di un box e restano scritti nel
documento. Esempi: CSF-009 (un elemento eccede la griglia), CSF-013 (conflitto fra elementi),
«descrizione spostata», «meccanica non trovata», gli errori IDX-57.5 e IDX-58. Nasce con
**I20-1029**.

**Non sono** le differenze della scheda ref (badge rosso e finestra «Differenze rilevate», I20-992)
né le segnalazioni del [Report Integrità](../reportIntegrita/README.md): quelle si ricalcolano
confrontando il box con il server e restano separate, per decisione dell'operatore.

## Come funziona (lotto 1, il registro)

Il **documento è il registro**. Ogni box ha al più un **bollino**:
- **vuoto**, senza testo;
- **colorato con la gravità peggiore** fra le sue segnalazioni: rosso gli errori, arancione i
  warning. Prima ogni segnalazione portava il suo colore, e CSF-013 era giallo;
- con **tutte le segnalazioni nell'etichetta** dell'ovale:

```
segnalazioni$[{"g":"error","c":"CSF-009","t":"Code CSF-009: L'elemento ..."},{"g":"warning","c":"CSF-013","t":"..."}]
```

`g` è la gravità (error, warning, notifica), `c` il codice quando il testo ne ha uno, `t` il testo.
È un JSON e non dei separatori a mano, perché i testi contengono già `$`, apici e due punti.

Così le segnalazioni sopravvivono alla chiusura del Plugin e di InDesign, viaggiano con il file e
si rileggono da qualunque flusso le abbia prodotte: Volantino, PoP, libro, Report Integrità, scheda
ref.

**Prima di I20-1029** il bollino portava come testo **una sola** segnalazione, la prima con
`applicaBollino` dopo l'ordinamento (non sempre la più grave), con « (Testo per mandare in
overflow)» in coda perché InDesign la segnalasse. Le altre si perdevano: restavano solo nel `.txt`
del report, che nessuno rileggeva. Un box rifatto accumulava un bollino sull'altro, e «descrizione
spostata» ne disegnava uno suo in più.

## I file

| file | cosa fa | InDesign | test |
|---|---|---|---|
| `etichetta.js` | il formato dell'etichetta: `scrivi`, `leggi`, `gravita`, `codice`, `ordina`, `gravitaPeggiore`, `colore`, `giaPresente` | no | `segnalazioniImpaginazione.test.js` |
| `segnalazioni.js` | il bollino nel documento: `applicaAlBox`, `togliDalBox`, `leggiDalBox`, `bolliniDelBox`, `leggiDocumento` | no, lavora sugli oggetti che riceve e disegna con `Utility.addBollinoCustom` | `segnalazioniImpaginazione.test.js`, con box finti |

## Chi li usa (indexNew.js)

- `addSegnalazione` raccoglie le segnalazioni del box e **scarta i doppioni**: stessa chiave o
  stesso testo. Il motore CSS ripassa più volte sugli stessi controlli.
- `finalizzaSegnalazioni` chiama `Segnalazioni.applicaAlBox` con **tutte** le segnalazioni del box.
  Senza segnalazioni non tocca il bollino: la funzione arriva due volte per box, e la seconda con
  la lista vuota. Il messaggio nel report `.txt` e il messaggio di fine impaginazione restano com'erano.
- `impaginaBox` **svuota la lista all'inizio**: se il box di prima è andato in errore prima di
  chiuderle, le sue segnalazioni non passano a questo.
- `fixRefImpaginata` **toglie il bollino vecchio** prima di rifare il box: le segnalazioni nuove,
  se ce ne sono, le riscrive `finalizzaSegnalazioni`.
- `Utility.addBollinoCustom` ha un ultimo parametro facoltativo, `etichettaBollino`, che va
  sull'ovale. Senza, come prima.

## I lotti successivi

- **Lotto 2:** la schermata delle segnalazioni del documento, per pagina e per box, con «Risolvi»,
  e la sua apertura a fine impaginazione. Leggerà con `Segnalazioni.leggiDocumento`.
- **Lotto 3:** il badge Pag del tracciato colorato con la segnalazione più grave del box.

**I bollini vecchi**, quelli con il testo, non hanno etichetta e non vengono riconosciuti: spariscono
rifacendo il box.
