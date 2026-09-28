# filtri.js

**Cosa è:** i filtri di pagina del volantino. Ogni pagina ha un insieme di criteri che dicono
**quali referenze ci vanno**, e questo file li costruisce, li salva, li applica e li sposta da una
pagina all'altra.

**Funziona solo per il Volantino.** La prima riga di `visualizzaHomePageFiltri` esce subito se il
tipo di lavorazione non è 1: nei PoP i filtri di pagina non esistono.

## Dove sta lo stato

Una sola variabile nel file:

| nome | cos'è |
|---|---|
| `paginaFiltro` | la pagina di cui si stanno guardando i filtri |

Come per [griglia.js](griglia.md), lo stato vero sta **fuori**: nel file `Filtri.json` della
cartella di lavorazione, con una voce per pagina — i criteri, se è attiva, se è bloccata.

## Le funzioni

### Mostrare
- `visualizzaHomePageFiltri()` → la schermata. Se `Filtri.json` non c'è, lo crea con la struttura
  vuota.
- `apriFiltriPagina(pagina, scrollTop)` → i filtri di una pagina.

### Costruire
- `addNewFiltro(...)` → il riquadro di un filtro, vuoto o riempito con uno già salvato.
- `addCriterio(body, criterio, isTracciato)` → una condizione. **662 righe**, perché ogni tipo di
  campo ha il suo modo di chiedere il valore: tendina, testo libero, data, intervallo.
- `refreshNarrow(filtroDiv)` → il restringimento progressivo: quali valori restano possibili dati i
  criteri già scelti.

### Template
- `creaPickerTemplateFiltro(templates, onTemplateSelected)`, `applicaTemplateFiltro(...)`,
  `apriMenuTemplateFiltri(...)` → filtri preconfezionati, da riusare invece di ricostruirli.

### Valori
- `trovaValoriPerTendinaValueDelFiltro(chiave, scope)` → guarda nel tracciato quali valori esistono
  davvero, così la tendina propone solo cose che si possono trovare.

### Salvare
- `salvaFiltri()` → scrive in `Filtri.json`.
- `getNomeFileFiltriJson()`.

### Cercare
- `ricercaFiltro(filtro)` → applica i criteri e restituisce le referenze. **557 righe**, il cuore
  del file.

### Operare sulle pagine
- `bloccaSblocca()` → congela una pagina perché non venga toccata dagli spostamenti.
- `scorriFiltri(...)` → sposta i filtri avanti o indietro fra le pagine, potendosi fermare alla
  prima bloccata o alla prima senza filtri.
- `scambiaFiltri(modalita)`, `duplicaFiltri()`.

---

## `isCampoData`: dieci nomi per dire «è una data»

Dentro `ricercaFiltro` c'è una funzione locale che decide se un campo è una data. Prova **due
strade**:

**Quattro flag booleani:** `isData`, `isDate`, `date`, `data`.

**Sei campi di tipo:** `tipo`, `tipoCampo`, `tipoValori`, `fieldType`, `inputType`, `formato`,
`format` — confrontati con i valori `data`, `date`, `datetime`, `dataora`.

**Non è codice difensivo: è la fotografia di un formato che nel tempo è stato scritto in modi
diversi**, e che nessuno ha potuto normalizzare perché non si sa quale variante usi ancora qualche
cliente.

È l'informazione più importante di questo file, perché non si trova da nessun'altra parte: **chi
toccasse quel punto senza saperlo romperebbe i filtri data di qualcuno.**

È anche logica pura — nessun InDesign, nessun DOM — e meriterebbe un test, che oggi non può avere
perché `filtri.js` richiede InDesign. Resta segnalata come candidata se un domani nascerà un modulo
puro sul tracciato.

## Nessun membro morto

Il preflight ne segnalava due, `apriMenuTemplateFiltri` e `trovaValoriPerTendinaValueDelFiltro`:
erano **falsi positivi**. Sono chiamati come `filtri.nomeFunzione(...)` dentro lo stesso file, e il
controllo cercava le chiamate solo sugli oggetti con l'iniziale maiuscola.
