# custom.js

**Cosa è:** il file dell'agenzia, `plugin/Agenzie/<Cliente>/custom.js`. Dal I20-1064 il Plugin lo
legge direttamente da lì, senza copie in radice: lo indica la voce `custom` dell'ipconfig del
cliente, che a sua volta è indicato da `plugin/clienteAttivo.json` (vedi [ipconfig](ipconfig.md)).
Le correzioni si fanno nell'archivio, che è in git. La prima riga dice di quale cliente è.

## Cosa contiene

Due cose diverse.

**Le tarature** che il Plugin legge attraverso [pluginMiddleware](pluginMiddleware.md) o
direttamente:

| taratura | a cosa serve |
|---|---|
| `customPadding` | il margine dei singoli ostacoli nel fix foto |
| `paddingBox`, `paddingFoto` | i margini del box e delle foto |
| `ignoreElementsFixFoto` | cosa non è un ostacolo per le foto |
| `exceptionElementsToIgnoreFixFoto` | le eccezioni alla riga sopra |
| `calcoloDistanziamentoFoto` | le percentuali di distanziamento fra le foto |
| `area`, `canale`, `codiceFormato`, `tipoLavorazione`, `contesto_promo` | la lavorazione corrente |

**Le funzioni di comportamento** che il cliente sovrascrive:

- `setLavorazione()` → legge dalla lavorazione corrente i dati che servono alle regole del cliente.
- `bindRefDataCompiled(...)` e `getRefCompiledInBox_Css(...)` → i campi della referenza già
  compilati per il box, pronti da scrivere in InDesign.
- `parseMeccanica_provvisorioCompiled(objRef, allEtichette, canale)` → traduce le etichette di una
  referenza nella **meccanica** del box. È la funzione più lunga del file, quasi seicento righe, ed
  è il cuore di ciò che distingue un cliente dall'altro.
- Edro21, **stili della base** in `getRefCompiledInBox_Css`: per ogni formato speciale `base_A_…` per
  il canale SC e `base_P_…` per gli altri (SDB, BDP, Piacersi, B&F, Verso Natura, Parmigiano). Vale
  l'ultimo applicato. Dal I20-1046 c'è **Artisti della Qualità** (`base_A_ADQnaz` / `base_P_ADQnaz`),
  riconosciuto da `artistiDellaQualita(objItem)`: il campo `art_qual` è un testo non vuoto, lo stesso
  criterio del server, che allora aggiunge i loghi `Logo_ADQnaz` e `Margherita_ADQnaz`. Viene per
  ultimo, quindi vince su tutti gli altri; non vale per i box focus.
  Se la ref è anche del **Buono del Paese**, il logo (`foto_extra$Logo_BDP$…`) e lo sfondo
  (`sfondo$sfondo_bdp$…`), che il core ha già messo nel box, si **nascondono**
  (`elementoBuonoDelPaese`): starebbero sotto quelli di ADQ. Si fa nel custom e non nel server, per
  non toccare `AgenziaLib.dll`.
- `setCustomFixFoto(box)` → la sistemazione delle foto a modo del cliente, al posto di quella
  standard. `indexNew` la cerca **prima** di chiamare `SistemazioneFoto.fixFoto`: se c'è, comanda questa. Lei, dall'agenzia, chiama `CssFramework.fixFoto`, che rimanda allo stesso modulo — vedi [sistemazioneFoto](sistemazioneFoto/README.md).
  Edro21 prova il box in due disposizioni, la descrizione dov'è o spostata in basso a sinistra.
  Fino a I20-1025 teneva quella con l'area maggiore (`Math.floor(area1) >= Math.floor(area2)`, con
  NaN quando una prova non trovava posto); ora le prova con `CssFramework.proiezioneFixFoto`, che
  dice anche quanto la foto dista dal centro, e decide con `CssFramework.preferisciDisposizioneFoto`,
  cioè con la preferenza del box ([sceltaSpazio](sistemazioneFoto/sceltaSpazio.md)).
- `impaginazioneFotoExtraCustom(...)` → come vanno impaginate foto extra e loghi.
- `getEtichetteEsclusePerFixDescrizione()`, `decodificaNomeFile(fullPath)`.

## `callCustom`, l'interruttore

`callCustom: false` — come ha Edro21 oggi — dice a `pluginMiddleware` di **non** leggere da qui ma
dalla configurazione scaricata dal server. Questo file resta allora solo per ciò che il server non
sa ancora esprimere.

È la direzione in cui il progetto si muove, e spiega perché i `custom.js` delle agenzie hanno
dimensioni così diverse fra loro: Coopfi e Famila stanno sotto le 120 righe, Edro21 ne ha 1.334.

## Perché qui non ci sono ricollocazioni proposte

Il criterio «un file, un concetto» vale anche qui, ma il concetto **è** «tutto quello che questo
cliente fa di suo». Il movimento giusto non è spostare funzioni altrove: è **svuotare il file**
portando le tarature nella configurazione del server, che è esattamente ciò che `callCustom: false`
rende possibile.
