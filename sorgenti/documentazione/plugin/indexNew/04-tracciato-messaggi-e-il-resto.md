# indexNew.js — tracciato, messaggi e il resto

**Cosa contiene questa pagina:** le **118 funzioni** rimaste dopo le tre pagine precedenti. Non
sono un concetto, sono dodici concetti diversi finiti nello stesso file — ed è questa pagina, più
delle altre, a dare la misura del perché `indexNew.js` vada diviso.

Con questo sotto-lotto **tutte e 133 le funzioni globali di `indexNew.js` hanno il commento**.

---

## Le famiglie che ci sono dentro

| famiglia | funzioni | dove dovrebbero stare |
|---|---|---|
| tracciato (elenco, righe, colonne, ricerca) | 14 | qui, è il concetto principale del file |
| messaggi, console e log | 8 | un js dei messaggi |
| accesso e ruoli | 4 | un js dell'accesso |
| percorsi di sistema | 2 | un js dei percorsi |
| kit in lavorazione | 3 | `ficoProcess.js`, che già fa la ricerca del kit |
| libro (impaginazione ed esportazione) | 6 | qui |
| identità di una referenza | 6 | un js loro, o `utility.js` — le usa anche `griglia.js` |
| accesso al disco | 3 | `utility.js` |
| versione del Plugin | 3 | `versionePlugin.js`, che già esiste |
| foto | 7 | il js delle foto già previsto |
| segnalazioni di impaginazione | 3 | il js del Report Integrità già previsto |
| esclusi dall'impaginato | 3 | parcheggiate, vedi sotto |

---

## Quello che non andava

Leggendole una per una sono venuti fuori **sette difetti veri e due cose da verificare**. Tre erano
correggibili senza cambiare comportamento e sono stati corretti qui; gli altri no, e vanno in un
task a parte.

### Corretti in I20-1002

**`showLoading` conteneva una riga col solo identificatore `Default`.** Nel ramo che scrive il
testo di ripiego, e `Default` non esiste da nessuna parte: quel ramo lanciava `ReferenceError`, e
`showLoading` non ha un `try/catch`. Non si notava perché nessuno chiama `showLoading()` senza
testo — ma tre chiamanti passano una variabile che può essere nulla. Riga rimossa.

**`checkPercorsi` leggeva `forceOptions`, che non esiste più.** Era un parametro, rimosso; ne
restano le tre righe commentate in cima alla funzione. La condizione era

```js
if ((percorsoLinks && percorsoLoghi && percorsoLogs && percorsoEsportazione) || forceOptions != null)
```

Per corto circuito, `forceOptions` si valuta **solo quando uno dei quattro percorsi manca** — cioè
esattamente nel caso per cui quel ramo esiste. `ReferenceError`. Ed è passato inosservato perché
la funzione è `async` e i suoi due chiamanti scrivono `await !checkPercorsi()` (vedi sotto), quindi
la promise rifiutata non la raccoglie nessuno.

Nessun chiamante ha mai passato `forceOptions`, perciò quel confronto valeva `false` anche quando
il parametro esisteva: il termine è stato tolto, e il comportamento voluto è lo stesso.

**`sincronizzaBoxGriglia` è stata rimossa**: 142 righe, **zero chiamanti in tutto il repository**, e
dentro **14 occorrenze di `Utiliy.`** invece di `Utility.` — che avrebbero lanciato `ReferenceError`
su quasi ogni ramo. Il refuso è sopravvissuto per anni proprio perché la funzione non gira mai.

### Da correggere in un task a parte

**`await` applicato alla negazione di una promise, in due punti.**

```js
while (await !checkPercorsi()) { await Utility.sleep(1000); }   // initDocumentInLavorazione
let _resTest = await !checkPercorsi();                          // initLibroInLavorazione
```

`!promise` è sempre `false`, quindi `await false` è `false` e **il ciclo non gira mai**:
`checkPercorsi` viene chiamata una volta sola e il suo esito ignorato. Andava scritto
`while (!(await checkPercorsi()))`. L'effetto è che l'attesa dei percorsi di sistema non avviene —
si tira dritto comunque.

**`autoCompilazioneCampiKit` non fa niente.**

```js
var campiDecodificati = null;
...
if (customAgenzia.decodificaNomeFile != null)
    customAgenzia.decodificaNomeFile(docInLavorazione.name);   // <- il risultato si butta
...
if (campiDecodificati != null) { ... }                        // <- irraggiungibile
```

Manca l'assegnazione. `campiDecodificati` resta `null`, tutto il corpo da lì in giù è morto, e
l'unica cosa che la funzione fa davvero è nascondere `#actMassivaSuKit`. Dovrebbe leggere il nome
del documento, ricavarne promo, canale, area e formato, riempire le quattro tendine e far partire
la ricerca del kit. **Non si nota perché non c'è un errore**: le tendine restano vuote e si
compilano a mano, come se l'automatismo non fosse mai stato previsto.

**`writeDebugMessageForCrash` scrive su un percorso che non esiste.**

```js
var logPath = pathLavorazione + percorsoLogs;      // writeDebugMessageForCrash
var logPath = /*pathLavorazione +*/ percorsoLogs;  // messaggioUtente, due funzioni sopra
```

`percorsoLogs` è **già assoluto** — glielo assegna `impostaPercorsiDiSistema` leggendo
`file.pathLogs`. In `messaggioUtente` la concatenazione è stata commentata, qui no. Doppio effetto:
il log di crash non viene mai scritto, e la scrittura fallita fa comparire all'operatore
*«Code IDX-98 Errore cartella logs assente»*, che manda a cercare un guasto che non c'è.

### Da verificare in esercizio

Due cose che dal solo sorgente sembrano rotte, ma che non si possono provare senza InDesign. Non
sono state toccate.

**`creaRigaSync` legge la tendina con `box.$picker[1].value`.** È un oggetto jQuery che avvolge un
solo elemento, quindi l'indice `1` dovrebbe essere `undefined` e la lettura lanciare. È **l'unico
accesso indicizzato di questa forma in tutto il Plugin**. Se in esercizio il pulsante *Avvia* del
tracciato funziona, allora qui c'è qualcosa che dal sorgente non si vede; se non funziona, l'indice
giusto è `0`.

**`cambioVisualizzazioneConsole` riconosce lo stile dal colore.** Confronta
`.css("background-color")` con le parole `"red"`, `"darkorange"` e `"green"`. Il colore è scritto
con quelle parole nello stile in linea, ma `.css` legge lo stile **calcolato**, che di norma
restituisce `rgb(255, 0, 0)`. Se qui si comporta come altrove, nessun confronto è mai vero e
spuntando un filtro spariscono tutti i messaggi. In ogni caso lo stile andrebbe letto da un
attributo nostro, non dedotto dal colore.

---

## Annotazioni minori

Cose che non rompono niente oggi ma che vale la pena sapere, tutte segnate anche nel codice.

| dove | cosa |
|---|---|
| `applyOverflowFix` | `overflowInstruction` assegnata senza `var`/`let`: globale implicita. Il file non ha `"use strict"` |
| `ripristinaElemento` | stessa cosa con `boxNumber` |
| `registraStatoLavorazioneLibro` | `file== readFile(filePath)` — doppio uguale al posto di uno. Non fa danno, quella variabile non si rilegge |
| `getSchedeRefsMassivo` | `let me = this` e `me.isInvalidated` sono un trapianto da `schedaRef.js`, dove `this` è il modulo. Qui la funzione è globale, quindi il controllo non scatta mai |
| `creaElementoTracciato` | chiama `getTracciatoColumns` **a ogni riga**, e quella interroga il `pluginMiddleware`. Su migliaia di referenze è lo stesso lavoro rifatto migliaia di volte |
| `writeFileInConsole` | il messaggio viene inserito come HTML e finisce anche dentro un attributo. I messaggi contengono testi di eccezione: uno con dentro un apice o un `<` rompe il markup |
| `impaginazioneSingoloIndd` | la variabile `found` è assegnata e mai letta |
| `impaginaSingolo` | `res` diventa vero solo sul cammino riuscito: se il server risponde con un errore, l'operatore vede il messaggio giusto ma la funzione aspetta comunque venti secondi e poi aggiunge un timeout che timeout non è |
| `creaRigaSync` | due gestori vuoti (clic sull'icona info, `change` della tendina) e un campo `pagineRange_<uid>` che nasce nascosto e che nessuno mostra né legge |
| `raggruppa` | riceve `enumSchedaRef` e non lo passa: la funzione chiamata non ne vuole |
| `delay` | fa esattamente quello che fa già `Utility.sleep`. Una delle due va tolta |

---

## Le tre funzioni parcheggiate

`escludiRef`, `ripristinaElemento` e `compilaTabElementiEsclusi` formano **un ciclo chiuso senza
porta d'ingresso**: si chiamano fra loro e nessuno chiama il gruppo dall'esterno. Il meccanismo è
intero — legge il codice dall'etichetta `info$<codice>`, lo scrive in `listaRefEscluse.json`, colora
di rosso il box, ridisegna l'elenco con un pulsante per copiare e uno per ripristinare. **Gli manca
solo il pulsante che lo avvia.**

Tutte e tre portano in testa la nota `//da ripristinare` dell'autore. **Non sono state cancellate
proprio per quella nota**: è codice morto, ma parcheggiato di proposito. Da decidere nel task di
divisione se ripristinarlo o toglierlo.

Stesso discorso, in piccolo, per **`decodificaNomeFile`**: non la chiama nessuno e restituisce
valori fissi inventati (`"A2515_SC_27-06-25"`, `"SC"`, `"TO"`, `null`), col commento *«qui ci sarà
roba che per ora non c'è»*. Quella vera è `customAgenzia.decodificaNomeFile`, perché le regole con
cui si battezza un file sono del cliente. È un abbozzo pericoloso: se un domani qualcuno la
chiamasse per sbaglio al posto di quella dell'agenzia, non avrebbe un errore — avrebbe una promo
inventata.

---

## Le due unificazioni

**`replaceAll`** esisteva in due copie, e non erano equivalenti.

```js
// Utility.replaceAll — split/join
// indexNew.replaceAll — while (str.indexOf(cerca) != -1) str = str.replace(cerca, sost)
```

La seconda **non termina** se la sostituzione contiene la stringa cercata:
`replaceAll("pippo", "p", "pp")` è un ciclo infinito, e il `try/catch` che l'avvolge non salva da
un ciclo. Non la chiamava nessuno — l'unica chiamata nuda era in `Trea/custom.js`, per giunta con
un solo argomento. **Rimossa**: resta `Utility.replaceAll`, e con essa se ne va il ciclo infinito.

**`makeRegexFromGroupName`** esisteva in due copie che facevano cose diverse: quella di
`CssFramework` toglie i suffissi `[itemLink]` e `[exist]` prima di costruire la regex, quella di
`indexNew` no. E quella di `indexNew` era una **globale**: se in `CssFramework` qualcuno dimentica
il `this.`, la chiamata non lancia `ReferenceError` — cade sulla globale e si comporta in modo
diverso **in silenzio**. È il caso peggiore della classe di difetti corretta nel Lotto 5, perché lì
almeno l'errore c'era.

Quella di `indexNew` è stata rinominata **`makeRegexFromFieldName`**, che è anche il nome giusto:
i suoi quattro punti d'uso confrontano nomi di **campi** (`compiledFields`, `deletedFields`), non di
gruppi.

---

## Le agenzie deprecate

`Agenzie/Pac/` e `Agenzie/Trea/` sono state rimosse: **11.733 righe**. Erano le ultime due agenzie
non più in uso — restano Edro21, Coopfi e Famila.

Con loro se ne sono andate le uniche due copie di `rimuoviSimboli` fuori da `indexNew`, che peraltro
**non le chiamava nessuno** (Edro21, Coopfi e Famila non ne hanno una): la sola viva è la globale.

`monta-cliente.sh` è stato allineato — senza, avrebbe continuato a offrire due clienti montando un
file che non c'è più.

**Fuori dal Plugin, Pac e Trea esistono ancora**: `AgenziaLib/Pac.cs`, `AgenziaLib/Trea.cs`,
`Istanta/appsettings.pac.json`, `Istanta/wwwroot/external_source/Trea/`. È lato server, fuori dal
perimetro di I20-1002.
