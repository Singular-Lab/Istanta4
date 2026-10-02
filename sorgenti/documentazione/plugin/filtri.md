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
  vuota. Le colonne della griglia sono Ordine, Pagina, Filtri, Griglia, Limite, N. ref,
  **Impaginate**, Ref. Avanzate, Ref. Escluse, Data Conteggio. Con Impaginate (I20-1031) le larghezze
  sommano a **110**: le colonne restano larghe come prima (strette, i testi andavano in overflow) e
  la griglia scorre in orizzontale.
- **La barra orizzontale della griglia** (I20-1031) → replica di quella dei Nuovi del
  [Report Integrità](reportIntegrita/README.md) e di quella della lista dei tracciati della Home
  ([indexNew/04](indexNew/04-tracciato-messaggi-e-il-resto.md)): stessi pezzi, stessi stili, stessi
  conti di [barraScorrimento](reportIntegrita/barraScorrimento.md). Il codice è duplicato per scelta
  dell'operatore, per non toccare Home e Report: **se cambia una delle tre, le altre vanno
  riallineate.**
  - **Le larghezze sono in pixel.** In UXP una larghezza in percentuale oltre il 100% non allarga
    la griglia, e le celle di una riga flex si restringono per starci: con le sole percentuali le
    colonne restavano strette e la barra non compariva (visto in collaudo). A ogni ridisegno
    `_applicaLarghezzeGriglia` calcola con `larghezzeColonneGriglia` i pixel di ogni colonna e li
    scrive su ogni cella, intestazione compresa, con `flexShrink: 0`: è il modo del Report
    Integrità.
  - **La regola è quella della lista della Home.** Ogni colonna ha un minimo,
    `MINIMI_COLONNE_GRIGLIA` (50, 50, 60, 80, 50, 110, 90, 110, 110, 120 px: 830 in tutto), che basta
    a «Nessun conteggio», «Nessun escluso», «Nessuna griglia» e alla data per stare su una riga. Se
    ai minimi le colonne non ci stanno, restano ai minimi e la barra le fa scorrere; se ci stanno, si
    allargano in proporzione fino a riempire esattamente lo spazio, e la barra sparisce. I minimi
    sono stati scelti in collaudo: i primi erano di 10 px più larghi.
  - **Al ridimensionamento del pannello** `onresizeWindow` chiama `aggiornaBarraGriglia`, che
    ricalcola le larghezze sullo spazio nuovo e rimette in accordo la barra, prima di dare l'altezza
    alla griglia: come `onResizeTab1Tracciato` per la Home. Senza, la barra restava con i numeri
    vecchi e al primo clic spariva per sempre (visto in collaudo).
  - **Il contenuto da scorrere è la larghezza calcolata**, `statoBarraGriglia.larghezzaTotale`, come
    `state.larghezzaTotale` del Report, non una misura: subito dopo aver scritto le larghezze, UXP
    restituisce ancora quelle di prima, e la barra risultava nascosta con 930 px di colonne su 499
    visibili (provato in console).
  - Intestazione (`#filtriIntestazioneGriglia`) e righe (`#filtriRigheGriglia`) stanno dentro
    involucri che le tagliano, e si spostano insieme con un `margin-left` negativo. Si sposta solo
    l'involucro interno delle righe: `#filtriBodyGriglia`, e con lui la barra verticale, resta fermo.
  - `_crBarraScorrimentoGriglia`, `_crFrecciaScorrimentoGriglia`, `_abilitaTrascinamentoBarraGriglia`,
    `_misureScorrimentoGriglia`, `_posizioneNellaTracciaGriglia`, `_scorriGriglia`,
    `_aggiornaCursoreGriglia`: come le omonime dei Nuovi. Stato in `statoBarraGriglia`, passo
    `PASSO_SCORRIMENTO_GRIGLIA` = 160.
  - La barra rinasce a ogni ridisegno, perché `#filtriBody` si svuota, ma **lo spostamento resta**:
    la griglia si ridisegna a ogni cambio di filtro, e dopo il ridisegno torna dov'era.
  - `altezzaBarraGriglia()` → l'altezza della barra, zero se nascosta. `onresizeWindow` in
    `indexNew.js` la toglie dall'altezza di `#filtriBodyGriglia`, altrimenti `#filtriBody` la
    taglierebbe fuori.
- **La colonna Impaginate** (I20-1031) → quanti box risultano impaginati in quella pagina secondo
  Istanta (`Menabo/getListaImpaginati`, una presenza per box), accanto alle conteggiate. Serve al
  riscontro con quello che si vede in pagina: un box cancellato a mano o da ricollegare resta
  contato qui. Gli impaginati si chiedono **una volta per ridisegno**, prima delle righe.
  - `impaginatiPerPagina(lista)` → le presenze raggruppate per pagina; scarta quelle senza pagina.
  - `cellaImpaginati(impaginatiPerPagina, nomePagina)` → il numero su fondo bianco; «Nessuna» su
    fondo grigio; **«?»** se Istanta non ha risposto, per non far passare per vuota una pagina che
    non si è potuta controllare.
  - `mostraImpaginatiPagina(nomePagina, impaginati)` → al clic sul numero, l'elenco dei box della
    pagina in un popup: codice gruppo e idRec, perché lo stesso codice può stare in pagina due volte.
- `apriFiltriPagina(pagina, scrollTop)` → i filtri di una pagina.

### Costruire
- `addNewFiltro(...)` → il riquadro di un filtro, vuoto o riempito con uno già salvato.
- `addCriterio(body, criterio, isTracciato)` → una condizione. **662 righe**, perché ogni tipo di
  campo ha il suo modo di chiedere il valore: tendina, testo libero, data, intervallo.
- `refreshNarrow(filtroDiv)` → il restringimento progressivo: quali valori restano possibili dati i
  criteri già scelti.
- `getLetturaFacilitataDellaParola(operatore)` → l'operatore di un criterio detto in parole, per la
  frase che riassume il filtro: `IN` diventa «contiente», `>=` «è maggiore o uguale di». Un
  operatore sconosciuto torna com'è. Stava in `utility.js` fino a I20-1012; la usa solo
  `refreshNarrow`, che la chiama `filtri.X` perché sta dentro una callback.

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
