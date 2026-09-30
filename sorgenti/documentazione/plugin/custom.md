# custom.js

**Cosa è:** il file dell'agenzia, copiato in radice da `monta-cliente.sh` dalla cartella
`plugin/Agenzie/<Cliente>/`.

**Quello che trovi nel repository è l'ultimo cliente montato su quella macchina, non il prodotto.**
La prima riga dice quale: oggi `//EDRO21`.

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
- `setCustomFixFoto(box)` → la sistemazione delle foto a modo del cliente, al posto di quella
  standard. `indexNew` la cerca **prima** di chiamare `SistemazioneFoto.fixFoto`: se c'è, comanda questa. Lei, dall'agenzia, chiama `CssFramework.fixFoto`, che rimanda allo stesso modulo — vedi [sistemazioneFoto](sistemazioneFoto/README.md).
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
