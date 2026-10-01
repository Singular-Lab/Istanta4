# indexNew.js — tracciato, messaggi e il resto

**Cosa contiene questa pagina:** le **114 funzioni** rimaste dopo le tre pagine precedenti. Non
sono un concetto, sono dodici concetti diversi finiti nello stesso file — ed è questa pagina, più
delle altre, a dare la misura del perché `indexNew.js` vada diviso.

Con questo sotto-lotto **tutte e 129 le funzioni globali di `indexNew.js` hanno il commento**.

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

---

## La barra orizzontale della lista (I20-1035)

In UXP la lista dei tracciati non scorre in orizzontale in nessun modo nativo: `#Tab1Table` è larga
quanto le colonne, `#Tab1Viewport` la taglia, e assegnare `scrollLeft` da codice interrompe il
comando (provato in console). La barra sotto la lista è quindi **disegnata dal Plugin**, ed è la
**replica della barra dei Nuovi del Report Integrità** (`reportIntegrita/pannelli.js`,
`_crBarraScorrimentoNuovi` e seguenti, I20-981): stessi pezzi, stessi stili, stessi conti di
[barraScorrimento](../reportIntegrita/barraScorrimento.md). Il codice è duplicato per scelta
dell'operatore, per non toccare il Report: **se cambia quella dei Nuovi, questa va riallineata.**

| funzione | cosa fa |
|---|---|
| `assicuraBarraScorrimentoTracciato()` | crea la barra la prima volta, subito dopo `#Tab1Viewport`; poi è la stessa, perché `#TracciatoRecords` non si svuota mai |
| `crBarraScorrimentoTracciato(state)` | freccia ‹, traccia con il cursore, freccia ›: `click` su frecce e traccia, `mousedown` sul cursore. Il passo delle frecce è `PASSO_SCORRIMENTO_TRACCIATO` = 160 |
| `crFrecciaScorrimentoTracciato` | il pulsante della freccia, con il tooltip |
| `abilitaTrascinamentoBarraTracciato()` | `mousemove`/`mouseup` sul documento, una volta sola: il mouse esce dal cursore quasi subito |
| `misureScorrimentoTracciato(state)` | contenuto (`scrollWidth` di `#Tab1Table`), visibile (`clientWidth` di `#Tab1Viewport`), traccia: lette al momento |
| `scorriTracciato(state, spostamento)` | `limitaSpostamento`, poi `margin-left` negativo su `#Tab1Table`, poi il cursore. L'intestazione sta dentro la tabella: scorre con le righe |
| `aggiornaCursoreTracciato(state, misure)` | la barra sparisce se le colonne ci stanno; il cursore ha la geometria di `geometriaCursore` |
| `altezzaBarraScorrimentoTracciato()` | l'altezza della barra, zero se nascosta |

Le differenze dal Report sono solo quelle della Home:
- che cosa si sposta e da dove si misura;
- la barra si crea una volta;
- **il ridimensionamento**: `onResizeTab1Tracciato` fa altezza della lista ([altezzaScorrimento](../altezzaScorrimento.md)),
  barra, di nuovo altezza, e passa l'altezza della barra come margine. Lista e barra insieme
  restano così dentro `#contenitoreTab`.

Dopo ogni ricostruzione, `aggiornaTracciatoPostRicerca` riporta la tabella dove dice lo spostamento,
come fa il Report dopo il ridisegno.

---

## Quello che non andava

Leggendole una per una sono venuti fuori **sei difetti veri**. Tre erano correggibili senza
cambiare comportamento e sono stati corretti qui; gli altri tre no, e hanno un task ciascuno.

Altre due cose sembravano difetti e non lo erano: le ha verificate l'operatore, e sono descritte
più sotto perché nessuno provi a «correggerle».

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

### Corretto in I20-1016: l'attesa dei percorsi di sistema

In `initDocumentInLavorazione` la riga era `while (await !checkPercorsi())`: `await` applicato alla
**negazione** della promise, che vale sempre `false`. Il ciclo non girava mai, `checkPercorsi`
veniva chiamata una volta sola e si tirava dritto anche senza i percorsi.

Ora è:

```js
const docAtteso = docInLavorazione;
while (docInLavorazione === docAtteso && !(await checkPercorsi())) { await Utility.sleep(1000); }
```

- **Si aspetta davvero.** `checkPercorsi` apre la finestra dei percorsi, se non è già aperta, e la
  si ricontrolla ogni secondo. `impostaPercorsiDiSistema` scrive subito in `lavorazioni.json`
  ogni cartella scelta, quindi l'attesa finisce da sola quando ci sono tutti e quattro. La
  chiusura della finestra la fa `Modali.closeAllModal()`, in coda all'inizializzazione.
- **L'attesa si interrompe se cambia il documento.** `checkPercorsi` legge le globali: senza
  questo controllo il ciclo vecchio continuerebbe sul documento nuovo — che ha già la sua
  inizializzazione — e se quello non ha una voce in `lavorazioni.json` ripeterebbe «IDX-143» ogni
  secondo. Col documento cambiato l'inizializzazione vecchia esce senza fare altro.
- **Gli errori si vedono.** Finché la promise non veniva attesa, un'eccezione dentro
  `checkPercorsi` non arrivava a nessuno: è così che il `ReferenceError` su `forceOptions` è rimasto
  nascosto. Ora diventa il messaggio `IDX-167`, e poi l'inizializzazione prosegue come faceva
  sempre.

**Il libro è rimasto com'era, di proposito.** In `initLibroInLavorazione` c'è ancora
`let _resTest = await !checkPercorsi();`: `checkPercorsi` parte, il suo esito non viene atteso e
`_resTest` vale sempre `false`. Il ciclo d'attesa, lì, era stato scritto e poi commentato.
`tests/plugin/attesaPercorsi.test.js` lo esclude per nome dal controllo contro `await !`.

### Da correggere in un task a parte

**`autoCompilazioneCampiKit` non faceva niente.** *Corretto in I20-1017.*

Il difetto annotato qui, il risultato di `customAgenzia.decodificaNomeFile` buttato via, era solo il
primo di quattro, e correggere quello da solo non sarebbe bastato:

1. l'assegnazione mancava, e tutto il corpo utile era irraggiungibile;
2. la funzione leggeva `promo`, `canale`, `area`, `formato`, mentre il decoder di Edro21 restituisce
   `nomePromo`, `siglaCanale`, `siglaArea`, `siglaFormato`;
3. al decoder arrivava solo il nome del file, ma la promo la ricava dal nome della **cartella**:
   ora riceve il percorso completo (`percorsoCompletoDocumento`);
4. le tendine hanno come valore il `guidID` e `Menu.setPickerValue` confronta il valore: nomi e sigle
   non corrispondevano mai. Ora `opzioniKitDaNomeFile` li traduce nei guid (promo per `nomePromo`,
   canale e area per sigla fra quelli della promo, formato per `codice`). In piu' canale e area si
   riempiono solo scegliendo la promo, e dopo averla impostata si chiama `kitPromoCmb_changed`.

Dopo la prova dell'operatore i metodi sono diventati due, nell'ordine:

1. **principale**, `decodificaNomeFileConPromo` in `custom.js` di Edro21: tutto dal nome del file,
   `<NOME PROMO>_<CANALE><AREA>.indd`, per esempio `P2621_VOL_08-10-26_SSTO.indd`. La promo e'
   l'inizio del nome cercato fra le promo aperte (vince la piu' lunga, perche' i nomi delle promo
   hanno anch'essi dei `_`); il formato e' il codice che compare fra le parti del nome della promo,
   senza badare alle maiuscole. Se trova tutte e quattro le opzioni basta lui, e la cartella non si
   guarda;
2. **riserva**, `decodificaNomeFile`: la promo e' il nome della cartella, e il file si chiama
   `<FORMATO>_<CANALE><AREA>_....indd`. Un risultato parziale del principale non si mescola con la
   riserva.

Se manca anche uno dei quattro si compila quello che si e' trovato e la ricerca del kit non parte.
I clienti senza nessuno dei due metodi (Coopfi, Famila) non passano di li'.

**`writeDebugMessageForCrash` scriveva su un percorso che non esiste.** *Corretto in I20-1018.*

Usava `pathLavorazione + percorsoLogs`, ma `percorsoLogs` è già assoluto dopo
`impostaPercorsiDiSistema`: il `Debuglog_<data>.txt` non veniva mai scritto, e la scrittura fallita
mostrava *«Code IDX-98 Errore cartella logs assente»* con la cartella al suo posto. Ora
`writeDebugMessageForCrash` e `messaggioUtente` chiedono la cartella a `cartellaDeiLog()`, che
completa solo il valore di partenza `"/Logs/"`: aprendo una lavorazione nuova si scrive nel log
prima che `percorsoLogs` sia diventato assoluto, e togliere e basta la concatenazione avrebbe
mandato quei log alla radice del disco.

### Due cose che sembrano difetti e non lo sono

**Verificate in esercizio in I20-1002: funzionano entrambe.** Sono scritte in un modo che a chi
legge il codice come se fosse un browser sembra sbagliato — e chi provasse a «correggerle» le
romperebbe. Stanno qui perché non succeda.

**`creaRigaSync` legge la tendina con `box.$picker[1].value`.** In una pagina normale quell'oggetto
jQuery avvolgerebbe un solo elemento e l'indice `1` sarebbe `undefined`. In UXP no: il pulsante
*Avvia* del tracciato funziona regolarmente. È **l'unico accesso indicizzato di questa forma in
tutto il Plugin**; non cambiarlo in `[0]` senza averlo provato.

**`cambioVisualizzazioneConsole` riconosce lo stile dal colore.** Confronta
`.css("background-color")` con le parole `"red"`, `"darkorange"` e `"green"`. In un browser `.css`
restituirebbe lo stile calcolato — `rgb(255, 0, 0)` — e nessun confronto sarebbe mai vero. In UXP
il confronto regge: spuntando le caselle spariscono esattamente i messaggi corrispondenti.

Resta valida una sola osservazione di disegno: lo stile sarebbe più solido letto da un attributo
nostro invece che dedotto dal colore. Ma è un miglioramento, non una correzione.

---

## Annotazioni minori

Cose che non rompono niente oggi ma che vale la pena sapere, tutte segnate anche nel codice.

| dove | cosa |
|---|---|
| `applyOverflowFix` | `overflowInstruction` assegnata senza `var`/`let`: globale implicita. Il file non ha `"use strict"` |
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

## Gli esclusi: una versione vecchia rimasta indietro

`escludiRef`, `ripristinaElemento` e `compilaTabElementiEsclusi` formavano **un ciclo chiuso senza
porta d'ingresso**: si chiamavano fra loro e nessuno chiamava il gruppo dall'esterno. Portavano in
testa la nota `//da ripristinare` dell'autore, e a prima lettura sembravano un meccanismo intero a
cui mancava solo il pulsante.

Non era così. **La funzione è già stata reintegrata in `griglia.js`**, dove è viva e si usa. Le tre
di `indexNew` erano la versione precedente, e le due scrivono `listaRefEscluse.json` in **formati
incompatibili**:

| | formato |
|---|---|
| `griglia.js` (vivo) | `[{ Pag, listaEscluse: [record, …] }, …]` — raggruppato per pagina |
| le tre di `indexNew` (rimosse) | `["{\"Codice\":…,\"Info\":…,\"BoxNumber\":…}", …]` — array di stringhe JSON, piatto, senza pagina |

Che quello giusto sia il primo lo dicono tutti gli altri lettori del file:
`indexNew.js` stesso (`listaRefEscluse.find(f => f.Pag == pItem.name)`) e `filtri.js`. Se le tre
funzioni fossero mai ripartite non avrebbero solo duplicato una funzione esistente: avrebbero
**riscritto quel file in un formato che nessun altro sa leggere**. **Rimosse** (219 righe).

Rimossa anche **`decodificaNomeFile`**: non la chiamava nessuno e restituiva valori fissi inventati
(`"A2515_SC_27-06-25"`, `"SC"`, `"TO"`, `null`), col commento *«qui ci sarà roba che per ora non
c'è»*. Quella vera è `customAgenzia.decodificaNomeFile`, perché le regole con cui si battezza un
file sono del cliente. Era un abbozzo pericoloso: chi l'avesse chiamata per sbaglio al posto di
quella dell'agenzia non avrebbe avuto un errore — avrebbe avuto una promo inventata.

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
