# utility.js

**Cosa è:** il file in cui è finito tutto quello che non aveva un posto.

Esporta **due** oggetti: `Utility`, con 76 membri, e `FotoPlacer`. Non ha un concetto: ne ha almeno
otto.

**Solo otto membri su settantasei meritano il nome «utility».**

## Le otto famiglie

| famiglia | membri | tocca InDesign? |
|---|---|---|
| **modali e dialoghi** | 11 | no |
| **tooltip** | 13 | no |
| **menu e picker** | 5 | no |
| **testo e tag InDesign** | 9 | sì |
| **trovare cose nel documento** | 10 | sì |
| **foto** | 5 + `FotoPlacer` | sì |
| **utilità vere** | 8 | no |
| varie | il resto | in parte |

### Modali e dialoghi — 11

`confirm`, `confirmCustom`, `confirmRimozioneRef`, `confirmRimozioneRefNonTrovata`, `popup`,
`apriModal`, `apriModalCustom`, `chiudiModal`, `chiudiModalCustom`, `closeAllModal`.

**`popup` ha un contratto da conoscere:** rimuove il popup **prima** di chiamare `alChiudi`, e il
suo ciclo di attesa non finisce da solo.

### Tooltip — 13

Tutto il meccanismo dei suggerimenti, che il Plugin si disegna da sé perché in UXP l'attributo
`title` non basta su un elemento creato da codice. **Metà della logica sta già fuori**, in
[tooltipPosizione.md](tooltipPosizione.md), che è un modulo puro con i suoi test: qui restano il
ciclo e il disegno.

### Menu e picker — 5

`creaFloatingMenu`, `chiudiFloatingMenu`, `registerDateMenuPicker` — **378 righe da sola** —
`setPickerValue`, `setPickerWidthHack`.

### Testo e tag InDesign — 9

`parseContent`, `componiStringTagFromInndTextFrame`, `applicaTagStringToInndTextFrame`,
`applyNeastedStyles`, `parseStile`, `parseObjStile`, `trimDescrizione`, `trattiDiStileDelCampo`,
`getLetturaFacilitataDellaParola`.

### Trovare cose nel documento — 10

- `getFieldByLabel(label, box, parseLabel)` → una delle funzioni più chiamate del Plugin.
- `getAllFieldsInGroup(box)` → tutti i campi, scendendo nei gruppi annidati.
- `parseLabel(label)` → **taglia quello che segue il primo `$`**, che nelle label porta il codice
  della referenza. Chi lavora sulle copie da duplicazione **non deve usarla**, perché taglierebbe il
  suffisso che le distingue — vedi [cssComposizioneBox.md](cssComposizioneBox.md).
- `getDnaOfBox(box)` → i dati della referenza contenuta, letti dalle label.
- `setCampoDNA`, `getBoxFromElementOfBox`, `_findBoxInExpectedPage`, `_findBoxInDocument`,
  `getGrigliaFromPage`, `getMasterSpreadByName`.

### Foto — 5 più `FotoPlacer`

- `getLinkHash(rectangle)` → l'md5 dell'immagine collegata, per sapere se è ancora quella del
  server. Passa da [cacheHashFoto](cacheHashFoto.md), perché il calcolo su centinaia di file è il
  costo dominante del Report Integrità.
- `getBolloNOFOTO`, `getBolloFOTONOFOUND`, `getNomeFotoLogoBolloBySigla`.
- **`FotoPlacer`** — `placeFoto`, `applicaNoRender`, `updateFoto` — è già un oggetto separato dentro
  lo stesso file.

### Utilità vere — 8

`sleep`, `generateId`, `replaceAll`, `replaceAllSpecialCharacters`, `getDirSeparator`,
`cercaChiaveContesto`, `duplicaFile`, `applyObjectStyle`.

Sono le uniche che meritano il nome del file, e sono anche quelle che dovrebbero **accogliere le
ricollocazioni annotate altrove**: `normalize`, `isIn`, `getValueByPath` e `toFitOptions` da
[pluginMiddleware](pluginMiddleware.md), `calcolaDistanza` da [griglia](griglia.md).

---

## La divisione è un task a sé

Qui non ha senso spostare una funzione: **il file va diviso**, ed è l'altro capo dello stesso
problema di `indexNew.js`. Il task è stato aperto, con l'elenco completo membro per membro.

**Il guadagno vero sta nelle tre famiglie che non toccano InDesign** — tooltip, modali, menu:
separate, diventerebbero verificabili. Per le altre il guadagno è solo di ordine.

**Il costo da mettere in conto:** `utility.js` è importato da quasi tutto il Plugin come
`{Utility, FotoPlacer}`, quindi ogni spostamento tocca decine di file.

Il candidato più semplice è `FotoPlacer`: basta portarlo fuori, perché chi lo usa lo importa già
col suo nome.

## Cosa è stato rimosso in I20-1002

| membro | nota |
|---|---|
| `cercaChiaveValore` | esiste anche in `Trea/custom.js` e `Pac/custom.js`, ma quelle sono **loro copie**, non chiamate a questa |
| `chiudiModalSync` | nessun chiamante |
| `itemsInfami` | variabile mai letta |
| `pagInfame` | variabile mai letta; l'unica assegnazione era commentata |
| `testPerformance` | nessun chiamante |

Quarantuno righe in tutto.
