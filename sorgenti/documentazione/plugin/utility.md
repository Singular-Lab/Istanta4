# utility.js

**Cosa è:** quello che resta del file in cui era finito tutto quello che non aveva un posto.
**I20-1012 l'ha diviso**, da 3.048 righe a 726, e ci ha lasciato quello che le agenzie chiamano per
nome: le etichette e il DNA del box, le utilità vere, e un resto che non ha ancora una casa.

Esporta **due** oggetti: `Utility` e `FotoPlacer`. `FotoPlacer` sta in
[reperimentoFoto/fotoPlacer.js](reperimentoFoto/fotoPlacer.md) dal I20-1015, e `utility.js` lo
riesporta con lo stesso nome.

## Dove sono andate le famiglie

| famiglia | dove sta ora | chi la chiama |
|---|---|---|
| **modali e dialoghi**, con le conferme di eliminazione | [modali/](modali/README.md), oggetto `Modali` | quasi tutto il Plugin e `index.html` |
| **tooltip** | [tooltip/](tooltip/README.md), oggetto `Tooltip` | `indexNew.js`, la scheda, il Report Integrità |
| **menu e picker** | [menu.js](menu.md), oggetto `Menu` | `filtri.js`, `indexNew.js`, la scheda |
| **testo e tag InDesign** | [testoTag.js](testoTag.md), oggetto `TestoTag` | la scheda, `InputEditController`, `confronti`... |
| **foto** | [reperimentoFoto/](reperimentoFoto/README.md), dal I20-1015 | — |
| **trovare cose nel documento** | **qui** | tutto il Plugin e le agenzie |
| **utilità vere** | **qui** | tutto il Plugin e le agenzie |
| varie | **qui** | pochi |

I quattro oggetti nuovi li dichiara `indexNew.js` come globali, subito dopo `Utility`. **Il core li
chiama per nome, `Modali.confirm`, e non più `Utility.confirm`**: un test controlla che non resti
nessun `Utility.X` per un membro uscito, e che ogni `Oggetto.X` del Plugin esista davvero.

**Le agenzie non hanno dovuto cambiare niente.** `Agenzie/*/custom.js` e `custom.js` chiamano per
nome cinque membri — `parseLabel`, `getFieldByLabel`, `setCampoDNA`, `cercaChiaveContesto`,
`applyObjectStyle` — e sono tutti rimasti qui.

## Cosa resta

### Trovare cose nel documento

- `getFieldByLabel(label, box, parseLabel)` → una delle funzioni più chiamate del Plugin.
- `getAllFieldsInGroup(box)` → tutti i campi, scendendo nei gruppi annidati.
- `parseLabel(label)` → **taglia quello che segue il primo `$`**, che nelle label porta il codice
  della referenza. Chi lavora sulle copie da duplicazione **non deve usarla**, perché taglierebbe il
  suffisso che le distingue — vedi [cssComposizioneBox.md](cssFramework/composizioneBox.md).
- `getDnaOfBox(box)` → i dati della referenza contenuta, letti dalle label.
- `eUnClone(label)` → se un elemento è una copia da duplicazione.
- `setCampoDNA`, `getBoxFromElementOfBox`, `_findBoxInExpectedPage`, `_findBoxInDocument`,
  `getGrigliaFromPage`, `getMasterSpreadByName`.

### Utilità vere

`sleep`, `generateId`, `replaceAll`, `replaceAllSpecialCharacters`, `getDirSeparator`,
`cercaChiaveContesto`, `duplicaFile`, `applyObjectStyle`.

### Varie

- `addBollinoCustom` → il bollino disegnato su un box. Dal I20-1029 lo usa
  [segnalazioni/](segnalazioni/README.md), con l'ultimo parametro facoltativo `etichettaBollino` che va
  sull'ovale; le chiamate in `confronti` sono commentate e quella di `CssFramework` per «descrizione
  spostata» non c'è più.
- `getListaCodiciImpaginati` → chiede al server i codici impaginati.
- `moveToPasteBoard`, `impostaValHiddenVal`.

`getLetturaFacilitataDellaParola`, che la issue metteva nel testo, **è andata in
[filtri.js](filtri.md)**: traduce gli operatori dei filtri in parole, e la usa solo lui.

## Le ricollocazioni annotate, e perché non si sono fatte

I20-1002 aveva proposto di portare qui `normalize`, `isIn`, `getValueByPath` e `toFitOptions` da
[pluginMiddleware](pluginMiddleware.md), e `calcolaDistanza` da [griglia](griglia.md). **In I20-1012
si è deciso di no:** hanno chiamanti solo nel proprio file — `getValueByPath` anche in
`cambiStrutturali` — e portarle qui aggiungerebbe una dipendenza da un file che sotto Node non si
carica, senza togliere niente a nessuno.

## Cosa è stato rimosso in I20-1002

| membro | nota |
|---|---|
| `cercaChiaveValore` | esisteva anche in `Trea/custom.js` e `Pac/custom.js`, ma erano **loro copie**, non chiamate a questa; quelle due agenzie sono state poi rimosse del tutto |
| `chiudiModalSync` | nessun chiamante |
| `itemsInfami` | variabile mai letta |
| `pagInfame` | variabile mai letta; l'unica assegnazione era commentata |
| `testPerformance` | nessun chiamante |

Quarantuno righe in tutto.
