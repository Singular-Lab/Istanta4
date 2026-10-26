# cambiStrutturali.js

**Cosa è:** valuta quali «cambi strutturali» si applicano a una referenza.

Il server manda un elenco di strutture, ognuna con una condizione e delle istruzioni. Questo modulo
scorre l'elenco, verifica le condizioni contro il record della referenza e contro i campi presenti
nel box, e restituisce le azioni applicabili. Lo usano `schedaRef.js:2037` nella schermata di edit
e `ficoProcess.js:1886`.

## Variabili globali

| nome | cos'è |
|---|---|
| `cambiStrutturaliDB` | l'elenco delle strutture scaricato dal server |
| `OPZIONI_GRUPPO` | `["tutto", "primario"]`: a chi si applica un'azione in un gruppo, nell'ordine della tendina (I20-1049) |

È **cache e stato insieme**, e lo riempiono in due: questo modulo quando lo trova vuoto, e
`pluginMiddleware.js:32` dalla risposta di inizializzazione. Due strade che scrivono la stessa
variabile: da sapere prima di toccarlo.

**Quattro globali esterne, nessuna importata:** `XMLHttpRequestClient`, `messaggioUtente`,
`hideLoading`, `indesignEvents`, più `Utility` dentro `_matchRegola`. È il motivo per cui il test
inietta `Utility` come globale.

## Funzioni

- `getCambioStrutturale()` → scarica l'elenco da `Menabo/getCambioStrutturale` e lo memorizza.
  Codici di errore: `CST-001` parsing, `CST-002` generico, `CST-003` rete, `CST-004` HTTP.
- `getCambioStrutturalePath(itemRef, box)` → le azioni applicabili a questa referenza in questo
  box, numerate da 1. Se l'elenco non è ancora stato caricato lo chiede al server (`CST-005` se non
  ci riesce).
- `_matchCambioStrutturale(record, condizioneRoot, dbItems)` → se almeno una condizione è
  soddisfatta. **Le condizioni sono in OR fra loro, le regole dentro una condizione sono in AND.**
  Una condizione senza regole vale sempre.
- `checkCondizione(record, condizione, dbItems)` → tutte le regole della condizione, più le
  eventuali regole annidate.
- `_matchRegola(record, regola, dbItems)` → una singola regola. Con `isBox` il valore si legge dal
  campo presente nel box — e **solo da una casella di testo**, le altre non hanno un contenuto da
  confrontare — altrimenti dal record.

  Gli operatori sono numeri che arrivano dal server: `0` Equals, `1` NotEquals, `2` Contains, `3`
  NotContains, `4` In, `5` NotIn, `6` Exist, `7` NotExist. Exist e NotExist guardano la **presenza**
  del campo, non il contenuto.

- `_getNestedValue(obj, path)` → il valore di un campo del record. **NON scende nei campi
  annidati**: il corpo che lo faceva è commentato, e oggi è una lettura diretta. Il nome resta
  quello di prima ed è fuorviante.
- `_equals`, `_contains`, `_in` → i tre confronti, tutti senza distinzione fra maiuscole e
  minuscole e **tutti falsi su un valore assente**. È il motivo per cui una regola sbagliata non dà
  errore: risponde «no» come se la condizione non fosse soddisfatta.
- `_mapCambioStrutturaleToLegacy(struttura, record, id)` → traduce una struttura del server nella
  forma che si aspetta la schermata di edit. Da I20-1049 porta anche `opzioniValide`.
- `_opzioniValide(struttura)` → le opzioni che la struttura dichiara in `OpzioniValide`, ripulite e
  nell'ordine della tendina. **Senza opzioni, o con sole opzioni sconosciute, le ammette tutte**: è
  il comportamento di prima, e resta quello dei clienti che non le configurano (I20-1049).
- `opzioniComuni(azioni)` → le opzioni valide per tutte le azioni scelte insieme, perché al
  salvataggio l'opzione è una sola. Senza azioni nessuna; vuota se due azioni non ne hanno in
  comune (I20-1049).
- `_resolveIstruzioneValue(istruzione, record)` → il valore secondo l'operazione: `0` Set scrive il
  valore, `1` AppendText lo accoda a quello che c'è, `2` RemoveText lo toglie e ripulisce i bordi.

## Opzioni gruppo/primario dichiarate dall'azione — I20-1049

Nella scheda ref, per una ref di gruppo, le azioni sul box si applicano a tutto il gruppo o al solo
primario. Prima la tendina della scelta compariva sempre, anche dove non serviva — a Edro21 non
serve mai — e anche senza nessuna azione scelta.

Ora ogni azione può dichiarare in `SourceCustomPlugin.json` → `cambiStrutturali` → `OpzioniValide`
quali opzioni ammette: `"tutto"`, `"primario"` o entrambe. La scheda (vedi
[schedaRef](schedaRef.md)) mostra la tendina solo per un gruppo con almeno un'azione aggiunta e più
di un'opzione valida; con una sola applica quella senza chiederla. Un'azione che non ha opzioni in
comune con quelle già aggiunte non si aggiunge (`SRF-99`). Edro21 dichiara `["tutto"]` su tutte le
sue azioni.

La proprietà vive in `IstantaLib` (`CambioStrutturale.OpzioniValide`). Le quattro azioni scritte
nel codice di `AgenziaLib.Edro21.GetCambioStrutturalePath` — la riserva usata solo se la
configurazione è vuota — non la dichiarano, quindi ammettono entrambe le opzioni.

## Il difetto corretto in I20-1002

Il confronto sul tipo dell'oggetto InDesign era scritto `"textFrame"`, mentre `constructorName`
vale `"TextFrame"` — così si scrive in tutto il resto del Plugin, undici occorrenze, e quella era
l'unica minuscola.

Il confronto non era quindi mai vero: per una regola con `isBox` su una casella di testo
`valoreCampo` restava `null`, e siccome i tre confronti tornano tutti `false` su `null`, **ogni
regola che guardava il contenuto di un campo del box falliva sempre**. Reggevano solo `Exist` e
`NotExist`.

Il caso peggiore era `NotEquals`, che tornava **sempre vero**: valore `null`, `_equals` falso, e la
negazione lo ribaltava. Una regola «diverso da» che non guarda niente è peggio di una che non c'è,
perché sembra funzionare.

La correzione **accende regole che prima erano sempre false**: per i clienti con condizioni sul
contenuto dei campi, l'edit si comporta diversamente da prima.

**Test:** `node --test tests/plugin/cambiStrutturali.test.js`
