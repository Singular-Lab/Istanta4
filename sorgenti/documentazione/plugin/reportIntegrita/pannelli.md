# pannelli.js — l'interfaccia del report

**Cosa è:** i pannelli con cui l'operatore guarda il Report Integrità. 88 membri, 3.072 righe, tutti
usciti da `confronti.js` in I20-1014. **Non è un modulo a sé:** `reportIntegrita.js` lo mescola nel
proprio oggetto, e ogni `this` qui dentro è `ReportIntegrita` — vedi [README.md](README.md). Il
flusso è in [flusso.md](flusso.md).

---

## Lo schema dei pannelli

I quattro capofila sono `_buildPanelCambiati`, `_buildPanelEliminati`, `_buildPanelNuovi` e
`_buildPanelConfronti`, e seguono tutti lo stesso schema:

1. un'intestazione con il conteggio, che viene da [conteggi](conteggi.md);
2. le righe raggruppate per pagina;
3. le azioni per riga, che chiamano il flusso (`_onConfrontoAction`).

Attorno a loro ruotano quelli che li governano: `_refresh*` per rifare una parte senza rifare tutto,
`_riempi*` e `_ridisegna*` per i picker e la sezione Confronti, `_renderNuoviTable` per la tabella
dei nuovi, `_refreshPickerLibreriaNuovi` per la scelta della griglia.

## I mattoni: `_cr*`

Ventisette costruttori di pezzi d'interfaccia, dal più piccolo al più grande: `_crButton`,
`_crIconButton`, `_crRow`, `_crPanel`, `_crTabRoot`, `_crTabButton`, `_crPageHeader`,
`_crCodiceGruppo`, `_crRiquadroConfronto`, `_crNuoviDataRow`... **Un pulsante, una riga o
un'intestazione del report si fanno sempre con loro**, così hanno tutti lo stesso aspetto.

## Le cose che UXP non fa da solo

- **Lo scorrimento orizzontale della lista dei nuovi** — `_crBarraScorrimentoNuovi`,
  `_abilitaTrascinamentoBarra`, `_scorriNuovi`, `_misureScorrimentoNuovi`, `PASSO_SCORRIMENTO`. In
  UXP la tabella non scorre: la barra la disegna il Plugin, e i conti stanno in
  [barraScorrimento](barraScorrimento.md).
- **La dissolvenza delle righe risolte** — `_dissolviRiga`, `_dissolviElementi` e i loro aiutanti,
  `PROPRIETA_COLORE_DA_ATTENUARE`, `ATTESA_RIDISEGNO_MS`. In UXP `opacity` non si ridisegna: si
  sfumano i colori, e i conti stanno in [dissolvenza](dissolvenza.md).
- **Le conferme a tre scelte** — `_confirmTreAzioniReport`, `_confirmConNonChiedere`.

## I colori

`COLORI_STATO` dà un colore a ogni stato di riga (cambiato, uscito, nuovo...). `_crRow(stato)` lo
applica: **lo stato di una riga si legge dal colore prima ancora che dal testo.**

## Chi sta qui e chi no

Sta qui ciò che **disegna o aggiorna il pannello**. Un membro che disegna *e* decide sta nel flusso:
`_ricontrollaReferenzaDopoScheda` aggiorna una riga, ma prima rifà il confronto e decide cosa resta
da segnalare. Lo stesso vale per `_buildReportConfrontoCsv`, che costruisce il testo del csv, non un
pannello.
