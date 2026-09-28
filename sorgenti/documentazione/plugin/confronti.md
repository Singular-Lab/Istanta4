# confronti.js

**Cosa è:** il Report Integrità — il confronto fra quello che c'è nel documento InDesign e quello
che dice il server — e tutta l'interfaccia con cui l'operatore lo guarda.

## Il file è sbilanciato

| | membri | righe |
|---|---|---|
| pubblici — la logica | 36 | 1.802 |
| privati `_` — l'interfaccia | **200** | **5.621** |

**Tre quarti del file sono la costruzione dei pannelli del report.** Questa pagina li tratta con due
profondità diverse: i pubblici uno per uno, i privati per famiglia, perché lì l'informazione utile
è lo schema, non l'elenco.

---

## La logica: i 36 pubblici

### Confrontare

- `confrontoBox(box1, box2, forzaReimpaginazione)` → **308 righe.** Guarda un box impaginato e dice
  cosa non corrisponde più al dato del server. È il confronto vero, quello da cui nascono le
  segnalazioni.
- `confrontoBoxCompiledFieldPreAnalisi(...)` → **389 righe.** Il confronto fatto sui campi già
  compilati, senza rileggere il box: la via veloce, quando la pre-analisi ha già raccolto tutto.
  **`checkMD5` a `false` salta il confronto degli hash delle foto**, che è la parte cara.

### Mappare l'impaginato

- `mappaturaImpaginato(pag, infoDescrizione, simplified)` → **236 righe.** Quali referenze stanno in
  quali box, a quale pagina.
- `semplificazioneMappaImpaginato(...)` → la riduce al necessario.
- `preAnalisiMismatchNumeriPagina(rangePagine, mappa)` → cerca le referenze finite su una pagina
  diversa da quella prevista.

### Sincronizzare col server

- `syncImpaginatoConServer(mappa, preAnalisi, applicaImpaginazioni)` → confronta la mappa coi dati
  del server e può restituire i record da reimpaginare.

### Tenere il report

Il report vive in un file JSON nella cartella di lavorazione:
`leggiReportIntegritaLocale`, `salvaReportIntegritaLocale`, `eliminaReportIntegritaLocale`, e gli
stessi tre per la whitelist.

- `richiediAzioneReportIntegritaEsistente(wrapper)` → cosa fare quando un report è già aperto.
  **Le soglie orarie stanno in [reportIntegritaAvvio](reportIntegritaAvvio.md)**, che è verificabile;
  qui resta il dialogo con l'operatore.
- `reportIntegritaAperto()`, `documentoDelReport()`, `chiudiReportIntegrita()`.

### Esportare

- `compilaReportConfronto(report, options)` → **212 righe.** Le regole del csv stanno in
  [reportConfrontoCsv](reportConfrontoCsv.md).
- `scaricaReportConfrontoCsv(...)`, `cartellaCsvReport()`, `scegliCartellaCsvReport()`.

### Le costanti pubbliche

| nome | valore | cos'è |
|---|---|---|
| `INTERVALLO_VIGILANZA_SCHEDA` | 600 | ogni quanto si controlla se la scheda aperta dal report è stata chiusa |
| `ATTESA_MASSIMA_RILETTURA_SCHEDA` | 20000 | oltre questa attesa si smette di aspettare |
| `FILE_TRACCIATO_SCHEDA` | `/logs/schedaDalReport.log` | |
| `PROPRIETA_COLORE_DA_ATTENUARE` | sei proprietà CSS | quali colori sfuma la dissolvenza |
| `ATTESA_RIDISEGNO_MS` | 40 | quanto si lascia a UXP per ridisegnare |
| `COLORI_STATO`, `PASSO_SCORRIMENTO` | | |

**`ATTESA_MASSIMA_RILETTURA_SCHEDA` esiste per una ragione precisa:**
`XMLHttpRequestClient.abort()` non interrompe davvero la richiesta — vedi
[XMLHttpRequestClient.md](XMLHttpRequestClient.md) — quindi la risposta tardiva si lascia cadere, ma
l'operatore non deve restare fermo ad aspettarla.

---

## L'interfaccia: i 200 privati

Seguono tutti lo stesso schema, e i tre capofila sono `_buildPanelCambiati` (194 righe),
`_buildPanelEliminati` (130) e `_buildPanelNuovi` (174):

1. un'intestazione con il conteggio, che viene da [reportConteggi](reportConteggi.md);
2. le righe raggruppate per pagina;
3. le azioni per riga.

Attorno a loro ruotano i `_refresh*`, `_toggle*`, `_apri*`, `_chiudi*` che li governano, più
`_impaginaTuttiNuoviInCoda` (130 righe) e `_refreshPickerLibreriaNuovi` (132).

**L'unico privato che porta una decisione e non solo disegno** è
`_ricontrollaReferenzaDopoScheda(stato)` (150 righe): quando l'operatore chiude la scheda di una
referenza aperta dal report, si rifà il confronto **solo su quella** e si aggiorna la riga, invece
di rifare tutto. Le regole di cosa resta da segnalare stanno in
[reportIntegritaAvvio](reportIntegritaAvvio.md).

---

## Il Report Integrità è sparso su otto file

Questo è il punto strutturale del file, ed è **un task a sé** che l'operatore ha chiesto di aprire.

| file | cosa ci sta |
|---|---|
| `reportIntegritaAvvio.js` | 349 righe: soglie e decisioni |
| `reportConfronti.js` | 490: la sezione Confronti |
| `reportConfrontoCsv.js` | 397: il csv |
| `reportConteggi.js` | 43: i numeri sulle linguette |
| **`confronti.js`** | 57 membri col report nel nome, più i 200 privati che sono i suoi pannelli |
| **`indexNew.js`** | `avviaReportIntegrita` (131 righe) e `applicaConfronto` (358) |
| `schedaRef.js` | 3 membri |
| `events.js` | `controllaChiusuraReportIntegrita` |

**Un dettaglio che dà la misura del problema**, in `indexNew.js:4535`:

```javascript
var reportFilePath = confronti._getReportIntegritaFilePath
    ? confronti._getReportIntegritaFilePath(idKitLavorazione)
    : pathLavorazione + "/reportIntegrita_" + idKitLavorazione + ".json";
```

`indexNew` **ricostruisce a mano il percorso del file del report**, nel caso la funzione privata di
`confronti` non ci sia. Come si chiama il file del report è scritto in due posti, e uno dei due è
una copia difensiva su un metodo privato di un altro modulo. È il sintomo di un concetto senza casa.

Nel codice, ogni pezzo che appartiene al report è marcato con **`REPORT INTEGRITA'`**, così il task
lo ritrova cercando quella parola.

## Cosa è stato rimosso in I20-1002

`_crPageSection`, `_setConfrontoVisibilityFilter`, `_toggleHiddenElemento`: 62 righe, una sola
occorrenza ciascuno — la definizione. Controllato anche dentro le stringhe HTML generate, dove
questo file costruisce `onclick` inline: non compaiono.
