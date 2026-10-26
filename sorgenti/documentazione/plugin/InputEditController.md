# InputEditController.js

**Cosa è:** governa i campi di testo della scheda referenza — cosa è stato modificato, cosa si può
modificare, e cosa va salvato.

È una **classe**: ne nasce una per ogni scheda aperta.

## L'idea che regge tutto

Tiene da parte il valore che ogni campo aveva **all'apertura**. Su quello si regge il metodo
principale: `getOperazioniDiSalvataggioDaFare` confronta e restituisce **solo le operazioni che
servono davvero**, invece di risalvare ogni campo a ogni conferma.

## Variabili

| nome | cos'è |
|---|---|
| `inputCollection` | i campi sotto controllo |
| `datasource` | i valori di partenza, per sapere cosa è cambiato davvero |
| `myContainer` | il contenitore jQuery della scheda |
| `convalidaFirma` | se la referenza è stata revisionata con la firma del tracciato, o è da controllare |
| `descrInArchivio` | la descrizione in archivio, per il confronto |
| `inMismatch` | se quella mostrata e quella in archivio non coincidono |
| `solaLettura` | I20-993: le varianti che non comandano si guardano e non si toccano |

## Funzioni

- `constructor(container, convalidaFirma, descrInArchivio, compiledFields)` → prende i campi e
  memorizza i valori di partenza.
- `listen()` → si mette in ascolto delle modifiche dell'operatore.
- `checkStato()` → aggiorna lo stato della scheda dopo una modifica: cosa risulta cambiato, e se la
  descrizione mostrata si discosta da quella in archivio.
- `getOperazioniDiSalvataggioDaFare(descrizioneEreditata)` → **il cuore**. Senza questo confronto
  ogni conferma riscriverebbe tutti i campi, anche quelli che l'operatore non ha toccato.

## Cosa è stato rimosso

`impostaSolaLettura(solaLettura)`, 26 righe: nessun chiamante in tutto il Plugin. Era nata con
I20-993 insieme al campo `solaLettura`, che invece resta perché viene valorizzato altrove.
