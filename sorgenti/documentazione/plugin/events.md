# events.js

**Cosa è:** il registro degli eventi di background del Plugin.

InDesign non avvisa quando qualcosa cambia, e nemmeno il server. `InddEvents` **interroga tutto a
intervalli regolari**, confronta con quello che aveva visto l'ultima volta, e quando qualcosa è
cambiato emette un evento. Chi vuole saperlo si registra con `addEventListener`.

**Gli eventi non sono solo quelli del documento:** connessione, sessione e raggiungibilità di
Istanta sono eventi di background come gli altri, ed è il motivo per cui stanno qui.

`indexNew` ne crea **una sola istanza**, `indesignEvents`. Gli altri file la usano quasi solo per
`setBusy`, che sospende il ciclo durante le operazioni lunghe.

## I ventuno eventi

| famiglia | eventi |
|---|---|
| documento | `EVENT_NEW_DOCUMENT_SELECTED`, `EVENT_NEW_LIBRO_OPENED`, `EVENT_NO_DOCUMENT_OPENED`, `EVENT_NEW_PAGE_SELECTED` |
| selezione | `EVENT_NEW_MULTISELECTION`, `EVENT_NEW_REF_SELECTED`, `EVENT_NEW_MULTIREF_SELECTED`, `EVENT_NO_REF_SELECTED`, `EVENT_NEW_REF_FIELD_SELECTED`, `EVENT_NEW_SELECTION_INVALID_POTENTIAL` |
| artwork e griglia | `EVENT_NEW_ARTWORK_SELECTED`, `EVENT_NEW_ARTWORK_MULTIREF_POTENTIAL_SELECTED`, `EVENT_NEW_GRIGLIA_SELECTED` |
| stato | `EVENT_ONLINE`, `EVENT_OFFLINE`, `EVENT_USER_LOGGED`, `EVENT_USER_NOT_LOGGED`, `EVENT_ISTANTA_DOWN` |
| altro | `EVENT_REF_PAGECHANGED` |

Sono costanti pubbliche: chi si registra usa quelle, non le stringhe.

## Variabili

Tutto lo stato è **«cosa avevo visto l'ultima volta»**:

| gruppo | membri |
|---|---|
| ultima osservazione | `lastActiveDocument`, `lastActiveLibro`, `lastSelectedPage`, `lastSelectionID`, `lastSelectionIDValidated`, `lastSelectionDetails`, `lastInvalidSelectionID`, `lastValidRefsSelection` |
| tempi | `timestampInizioSelezione`, `timeStampStatus`, `timeStampTime`, `timeStampControlloReport` |
| stato del mondo | `istantaState`, `isOnline`, `checkStatusInProcess` |
| il ciclo | `mainInterval`, `isBusy`, `asleep` |
| ascoltatori | `listeners` |
| sessione | `xhrCheckSession`, `sessionCallTimeout` |

**È la struttura di un rilevatore di cambiamenti:** metà dei membri esiste solo per poter dire
«questo è diverso da prima». Senza il confronto con l'ultima osservazione non ci sarebbe nessun
evento da emettere.

`isBusy` e `asleep` sono le due leve con cui il resto del Plugin ferma il polling. È l'unica cosa
che gli altri file chiedono a `events`, oltre ad ascoltare.

## Funzioni

- `constructor()` e `init(firstCheck)` → avviano il ciclo. `init` è lungo perché **è** il ciclo.
- `interpretaSelezione(newSelection)` → da una selezione grezza di InDesign capisce cosa ha
  selezionato l'operatore **davvero**: una ref, più ref, un artwork, una griglia, un campo, o niente
  di valido.
- `addEventListener(event, callback)` e `fireEvent(eventName, params)` → il registro e l'emissione.
- `checkStatus(callback)` e `checkStatusResonse(...)` → connessione e sessione; l'esito diventa uno
  degli eventi di stato.
- `logout()`.
- `setBusy(...)` → sospende il ciclo.
- `resetLastSelection()` → dimentica l'ultima osservazione, così il prossimo giro riemette anche se
  nulla è cambiato davvero. Serve dopo le operazioni che rifanno il documento sotto al ciclo.
- `timestamp()` → l'ora leggibile per i log.

## La chiusura del Report Integrità — ricollocata in I20-1014

`controllaChiusuraReportIntegrita()` decideva qui quando un Report Integrità aperto smette di
valere, ma è una regola del report, non un evento. **Ora qui resta solo il «quando guardare»**: a
intervalli, un controllo alla volta, col documento attivo letto da InDesign, e prima del cancello
`isBusy` — il report tiene `isBusy` per sé. **Il «quando chiudere» è del report**:
`ReportIntegrita.chiudiSeNonValePiu(documentoAttuale)`, che usa `deveChiudereReport` di
[reportIntegrita/avvio](reportIntegrita/avvio.md). Vedi [reportIntegrita/flusso.md](reportIntegrita/flusso.md).

## Cosa è stato rimosso

`quit()`, tre righe che fermavano il ciclo: nessun chiamante in tutto il Plugin.
