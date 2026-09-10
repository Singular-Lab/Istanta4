## [2.17.007] - 2026-07-08

### Corretto
- **`RisultatoConfrontoTracciati` — PDF: liste di codici gruppo sovrapposte alle colonne vicine**: le liste `Scatto.CodiceGruppo` (es. `1143108,1143117,…`) sono virgole senza spazi e l'algoritmo Unicode di a-capo di `@react-pdf/renderer` non spezza mai cifra,cifra (le tratta come un numero unico): la lista sbordava sopra Tipo/Tema e veniva tagliata al bordo pagina. Ora i codici vengono mostrati con `", "` (virgola + spazio) e vanno a capo dentro la propria cella — tutti i codici restano interi e leggibili. Ribilanciate le colonne della tabella raggruppata (Codice 1.2→1.7, Tema 1.8→1.3) per contenere l'altezza delle righe con molti codici.

## [2.17.006] - 2026-07-02

### Corretto
- **`MenaboPromo` — ripristinato lo stile originale del canvas**: annullato il restyling non richiesto introdotto da un intervento precedente (toolbar sopra l'header riscritta con pulsanti grandi, header pagina trasformato in card, note e pill "Nota di pagina" passate da ambra a bianco/primary, pannello anteprima ridisegnato, carosello "pagina attiva" su schermi compatti). Toolbar, header pagina, note ambra, pannello anteprima e barra di stato sono tornati identici alla versione precedente. Mantenute le modifiche funzionali della stessa sessione (protezione kick per superadmin, pulsante "Rimuovi" sulle divisioni occupate, redirect alla promo per gli utenti espulsi).

### Modificato
- **`MenaboPromo` — canvas responsive con qualsiasi contenuto e dimensione schermo, senza cambi di stile**: (1) **zoom adattivo (fit-to-width)** — finché non si zooma manualmente, lo zoom segue la larghezza disponibile del workspace (misurata con `ResizeObserver`, mai oltre lo 0.82 di default): niente overflow orizzontale quando la finestra è stretta o i pannelli laterali sono aperti. Lo **zoom manuale resta libero** (pulsanti +/−, Ctrl+rotella): oltre il fit il workspace scorre in orizzontale come prima, così i contenuti piccoli si possono ingrandire e leggere anche su schermi stretti; il pulsante % / Ctrl+0 riporta allo zoom adattivo; (2) **colonna singola automatica** — le doppie pagine affiancate (spread recto/verso) collassano in colonna singola quando lo spread non ci sta; (3) **pannello anteprima referenze in overlay** sotto il breakpoint `lg` (non schiaccia più il canvas, su desktop resta la colonna fissa da 384px); (4) **pannello note dentro il foglio** in colonna singola (prima si apriva a destra della pagina causando scroll orizzontale); (5) **sidebar "Contenuti" in drawer** sotto il breakpoint `lg`: si apre in overlay sopra il canvas (larghezza max `85vw`) invece di rubargli metà spazio, e al primo caricamento su schermi piccoli parte chiusa (resta la striscia laterale con "Mostra pannello"); su desktop resta la colonna fissa da 384px identica a prima; (6) `scrollbar-gutter: stable` sul workspace per evitare oscillazioni del fit alla comparsa della scrollbar.

### Corretto
- **`Coopfi` — variazioni `prezzo_promo_kgl` (e `prezzo_continuo`) mai rilevate nel report tra momenti**: la config Mongo (`data_fields_refs`, che ha priorità sulla mappa Coopfi) mappa questi campi in identità (es. `prezzo_promo_kgl → prezzo_promo_kgl`), ma il confronto leggeva solo la chiave normalizzata attesa (`prezzoPromoKgl`), che con quella config non esiste mai: le variazioni venivano silenziosamente ignorate sia nella tabella "Variazioni per referenza" sia nel conteggio "modificati". Ora la lettura dei campi tracciati usa una catena di fallback (campo atteso → chiave originale ISTANTA → output mappa Coopfi) in `buildWidgets`. **Nota:** i report già persistiti restano invariati; per vedere il kgl serve rieseguire il confronto.

### Modificato
- **`Coopfi` — campi prezzo collegati sempre visibili nelle variazioni**: se in una referenza cambia uno tra `txt_sconto`, `prezzo`, `prezzo_continuo`, `prezzo_promo_kgl`, il report mostra sempre tutti e quattro (gli invariati con prima = dopo), perché sono legati tra loro. Il conteggio "variazioni totali" continua a contare solo le variazioni reali.
- **`RisultatoConfrontoTracciati` — restyling PDF del report tra momenti**: (1) eliminati tutti i troncamenti con "…" — descrizioni, temi, codici e valori sono mostrati per intero con testo a capo; (2) nome della promo in grande (30pt) in cima alla prima pagina (nuova query `GET /promo/:idPromo` nella pagina, passato a `createTracciatoReportPdfBlob`); (3) separatori verticali tra le colonne di tutte le tabelle per capire a colpo d'occhio in quale colonna è la variazione; (4) rimossi i limiti di righe ("+ altri N record non inclusi"): le tabelle mostrano tutti i record e si spezzano correttamente tra le pagine; (5) testata e barra blu solo in prima pagina (non più ripetute su ogni pagina), footer con numeri di pagina invariato su tutte.

## [2.17.004] - 2026-07-02

### Modificato
- **`Coopfi` — export InDesign (timone): forzatura filtro per temi "jolly"**: in `buildIndesignPluginJson` (lib verticale Coopfi), quando il valore del tema contiene "jolly" (match case-insensitive) il criterio esportato diventa `tema in JOLLY` invece di `tema = <valore esatto>`. Se l'elemento è stato trascinato **per intero** nel menabò, i criteri per reparto (che nascevano dal fallback sul campo secondario) non vengono più emessi: il gruppo collassa in un unico filtro `tema in JOLLY` per pagina, con `limite` pari alle referenze del gruppo su quella pagina. Se invece è stato trascinato un **sottogruppo con reparto esplicito**, si mantiene un filtro per reparto nell'ordine attuale (`tema in JOLLY` + `reparto = <valore>`). Comportamento invariato per i temi senza "jolly". Esteso `IndesignPluginFiltro.operatore` a `'=' | 'in'` in `lib/types.ts`.

## [2.17.003] - 2026-06-29

### Modificato
- **`MenaboPromo` — Note di pagina richiudibili "a linguetta" e fuori dal contenuto**: il badge in stato di riposo era ingombrante e, posizionato nell'angolo, copriva il contenuto della pagina sotto. Ora a riposo compare solo una **linguetta compatta** (icona + numero note) attaccata al **bordo superiore** del foglio, sollevata fuori dall'area di stampa (non copre nulla). Click sulla linguetta → si apre il **pannello note che si espande a lato (a destra) della pagina**, quindi senza coprire il contenuto che si sta annotando; la X del pannello lo richiude alla linguetta.

## [2.17.002] - 2026-06-29

### Modificato
- **`MenaboPromo` — Note di pagina: ora multiple per pagina con visualizzazione "a pila"**: una pagina può avere più note. In modalità compatta compare un **badge unico all'angolo del foglio** con effetto pila (cards sfalsate) e un contatore quando le note sono più di una, mostrando l'anteprima della prima nota — niente post-it sovrapposti che intasano il canvas. Click sul badge → **pannello con l'elenco completo** delle note della pagina, ognuna modificabile inline (textarea) ed eliminabile singolarmente, con pulsante "Aggiungi nota". Trascinando la "Nota di pagina" dal pannello laterale si aggiunge una nuova nota e si apre il pannello. Persistenza aggiornata: campo `notes[]` (`MenaboPageNote { id, text }`) su `MenaboLayoutPaginaSalvata`, con migrazione automatica dalla vecchia singola `note`. Nessuna modifica al DB; le note restano escluse da export e stampa.

## [2.17.001] - 2026-06-29

### Aggiunto
- **`MenaboPromo` — Note di pagina (post-it)**: nuovo strumento di annotazione per pagina, pensato per segnalare/ricordare qualcosa a livello di singola pagina del menabò. Funziona come gli altri contenuti — si **trascina** dal pannello laterale (blocco "Nota di pagina") su una pagina — ma **non è contenuto stampabile**: compare come post-it giallo ancorato all'angolo del foglio (sporge fuori dal margine), ben visibile e leggibile a colpo d'occhio. Click sul post-it per scrivere/modificare il promemoria (textarea), X per eliminarlo. Una nota per pagina; ammessa anche sulle pagine bloccate da etichetta. La nota è persistita nel layout (`menabo_layout`, JSONB) e partecipa a undo/redo, inserimento/eliminazione pagine e "Elimina tutto"; **esclusa dagli export** Excel/InDesign e dal volantino. Nessuna modifica al DB (campo `note` opzionale aggiunto a `MenaboLayoutPaginaSalvata`, serializzato nel blob esistente).

## [2.16.037] - 2026-06-29

### Sicurezza
- **`PromoController` — rimosso `permissionGuard('promo.modifica')` dal salvataggio del menabò**: il `PUT /promo/:idPromo/menabo-layout` restava bloccato con 403 per ruoli senza `promo.modifica` (es. `Marketing`), pur potendo leggere il menabò (la `GET` e `getDatoPerMenabo` hanno solo `authMiddleware`). Allineata la scrittura alla lettura: la rotta ora richiede solo l'autenticazione. **Nota:** qualsiasi utente autenticato può ora salvare il layout del menabò; se in futuro serve restringere, valutare un permesso dedicato (`menabo.modifica`).

### Corretto
- **`MenaboPromo` — salvataggio "nel vuoto" del layout (lost update con più utenti)**: `PromoService.saveMenaboLayout` faceva read-modify-write sull'intera colonna JSONB `menabo_layout` (`findById` → merge in memoria di una divisione → `update` completo). Con più utenti che salvavano divisioni diverse in parallelo, l'ultimo a committare partiva da uno snapshot stale e sovrascriveva la divisione dell'altro: il `PUT` rispondeva 200 ("Menabò salvato") ma il dato non si persisteva. Il guard `if (!updated)` non poteva intercettarlo perché in Postgres l'`UPDATE` su una riga esistente riporta comunque `affectedRows = 1`. Ora la singola divisione viene scritta in modo **atomico** dentro il JSONB con `jsonb_set` + `||` in un unico `UPDATE`: il row-lock di Postgres serializza i salvataggi concorrenti e ogni merge si applica sul valore già committato, eliminando il lost update senza lock applicativi. Rimosso il `findById` preliminare (l'esistenza della promo è verificata dal `RETURNING` vuoto).

## [2.16.036] - 2026-06-29

### Corretto
- **`MenaboPromo` — lock fantasma sulla divisione dopo una riconnessione del socket**: la presenza è chiavata per `socket.id` nella mappa in-memory `menaboSessions` (lato `ws-server.ts`). In produzione i socket si riconnettono spesso e prendono un nuovo `socket.id`; la sessione del vecchio socket restava nella mappa fino al pingTimeout (~15s) continuando a occupare la divisione (canale/area) su cui l'utente si trovava prima. Passando da una tendina all'altra restava così uno "zombie" che faceva risultare quella divisione ancora bloccata per gli altri utenti, aprendo il dialog "in uso". Lo snapshot completo (2.16.034) eliminava la deriva client ma non lo zombie server-side. Ora su `menabo:page:join` il server fa deduplica per utente (`pruneUserSessions`): evice subito le altre sessioni dello stesso `userId` nella stessa promo (un utente = una sola presenza per promo) e ribroadcasta lo snapshot alla room, senza aspettare il `disconnect`.

## [2.16.035] - 2026-06-25

### Corretto
- **`OrdiniStampaService` e `WhatsAppService` — `ReferenceError: Colorize is not defined`**: in entrambi i file l'import di `Colorize` (usato in `console.error(Colorize.bgRed(...))` nei blocchi catch) era stato rimosso per errore. A runtime il catch stesso lanciava un `ReferenceError`, mascherando l'errore originale e rompendo operazioni reali (es. il conteggio badge degli ordini di stampa via `getAllOrdiniDiStampaInCorso`, visibile nei log di produzione). Ripristinato l'import mancante in entrambi i servizi.

## [2.16.034] - 2026-06-25

### Corretto
- **`MenaboPromo` — presenza fantasma che bloccava l'ingresso in un canale/area libero**: con gli update incrementali `menabo:presence-update`, se un singolo aggiornamento non veniva applicato lato client lo stato `allPresences` restava sfasato. Dopo che un utente "passava" per un canale/area e ne usciva, sul client di un altro utente quella divisione poteva risultare ancora occupata → il controllo apriva il dialog "in uso" impedendo l'ingresso, finché non si ricaricava la pagina. Ora il server invia **sempre lo snapshot completo** delle presenze a tutta la room (`menabo:all-presences`) a ogni cambiamento e il client fa replace totale: niente più deriva dello stato. Rimosso l'evento incrementale `menabo:presence-update` (server e client).

### Rimosso
- **`ws-server.ts` — log diagnostici temporanei del menabò** (`Menabò DIAG page:join/join/broadcast`) usati per diagnosticare la frammentazione presenze in cluster: ripristinati i log `debug` puliti.

## [2.16.033] - 2026-06-25

### Corretto
- **`MenaboCanvas` — eliminazione di una pagina in mezzo a pagine piene**: `removePageAtIndex` rimuoveva i contenuti e cancellava la voce delle mappe per-pagina all'indice rimosso, ma non rinumerava le pagine successive. Gli item che iniziavano dopo la pagina rimossa restavano a `pageIndex` alto → `lastTouchedPage` non scendeva → `requiredPageCount` faceva rimbalzare su il conteggio e la pagina non veniva di fatto eliminata (restava un buco). Ora la funzione è speculare a `insertPageAt`: shift −1 del `pageIndex` degli item successivi e rinumerazione di `pageLabels`, `hiddenRegoleLabelPages`, `pageMaxOverrides`.

## [2.16.032] - 2026-06-25

### Aggiunto
- **`MenaboPromo` — indicatori visivi dei canali/aree occupati**: nel pannello laterale del menabò ora si vede a colpo d'occhio cosa è in uso e da chi, prima ancora di selezionare. Aggiunta una lista "{Canale/Area} in uso" sotto il selettore con avatar colorati (iniziali, colore stabile per utente) per ogni canale/area occupato da altri; ogni voce è cliccabile per entrare (riusa il dialog di conferma occupazione). Le opzioni del select sono annotate con 🔒 e i nomi degli occupanti. Il banner della selezione corrente mostra anch'esso l'avatar colorato dell'utente. Helper `colorForUser` (hash userId→palette) e `getInitials`.

### Modificato
- **`MenaboPromo` — terminologia "canale/area" al posto di "divisione"**: tutte le scritte visibili (etichette, tooltip kick, toast di rimozione, dialog "modifiche non salvate" e dialog di occupazione) ora usano l'etichetta dinamica coerente col `tipoDivisione` configurato (Canale / Area / Canale/Area) invece del termine generico "divisione".

## [2.16.031] - 2026-06-25

### Aggiunto
- **`ecosystem.config.cjs` — launcher PM2 diretto**: avvia il server con `node --import tsx server/index.ts` (entry-point = file del server, così PM2 legge la versione dal `package.json` del progetto e non da tsx) senza passare da `npm start`. Forzato `exec_mode: 'fork'` + `instances: 1` + `NODE_ENV=production`: il WebSocket server parte solo nel primary dell'app (che forka i worker HTTP), quindi PM2 NON deve girare in cluster mode (altrimenti il WS non parte e le presenze del menabò si rompono). Path di produzione `cwd: /var/www/fidelity_promotion`.

## [2.16.030] - 2026-06-25

### Corretto
- **`MenaboPromo` — presenze non aggiornate live e kick inefficace in produzione**: in produzione i socket si riconnettono spesso (rete/reverse-proxy). Al `disconnect` il server rimuoveva la sessione da `menaboSessions`, ma il client non rifaceva `menabo:page:join` alla riconnessione (l'effetto dipendeva da `[socket, idPromo, user]`, invarianti su un reconnect). L'utente diventava un "fantasma": invisibile agli altri (presenze non live) e con `socketId` morto (kick → `return` silenzioso). Ora `useMenaboPresence` ri-annuncia la presenza a ogni evento `connect` (rientro in pagina + ri-join della divisione corrente), rendendo lo stato auto-correttivo dopo ogni riconnessione. In locale il bug non emergeva perché i socket non cadono quasi mai.

## [2.16.029] - 2026-06-25

### Corretto
- **`MenaboPromo/index.tsx` — WebSocket non connesso**: la pagina Menabò è fuori dal layout Echo e non riceveva il `SocketProvider`. Aggiunto wrapper `MenaboPromoPageWithSocket` che monta il provider direttamente attorno al componente, rendendo disponibile `useSocket()` e abilitando la presenza real-time.

## [2.16.028] - 2026-06-25

### Corretto
- **`LavorazioniInCorso/index.tsx` — errori silenziosi sull'eliminazione promo**: l'`onError` della mutation `deleteLavorazione` mostrava un feedback solo per il 403 (permessi negati). Tutti gli altri errori (500 da Istanta, 404, errori di rete) chiudevano dialog e loading senza alcuna notifica. Aggiunto `else` che mostra una notifica di errore generica per qualsiasi altro codice HTTP.

## [2.16.027] - 2026-06-25

### Aggiunto
- **`MenaboPromo` — sistema presenza real-time via WebSocket**: quando un utente seleziona una divisione del menabò (canale/area), il server traccia la sua presenza tramite Socket.IO (room `menabo-page:{idPromo}`). Gli altri utenti sulla stessa pagina vedono in tempo reale chi sta modificando ciascuna divisione. Implementati eventi `menabo:page:join/leave`, `menabo:join/leave`, `menabo:kick`, `menabo:all-presences`, `menabo:presence-update`, `menabo:kicked`.
- **`MenaboPromo/index.tsx` — avviso divisione occupata**: quando un utente cerca di selezionare una divisione già in modifica da altri, compare un dialog di conferma con la lista degli utenti attivi. Il superadmin ha la possibilità di rimuovere gli altri utenti prima di entrare ("Rimuovi e entra"). Un banner ambra nella sidebar mostra in tempo reale chi sta modificando la divisione corrente.
- **`MenaboPromo/index.tsx` — avviso modifiche non salvate al cambio divisione**: se il canvas ha modifiche non salvate (`isDirty`), cambiare divisione mostra un dialog di conferma ("Cambia senza salvare" / "Rimani"). Il browser mostra anche il dialogo nativo `beforeunload` se si tenta di chiudere la pagina con modifiche pendenti.
- **`useMenaboPresence.ts`** — nuovo hook che gestisce la comunicazione WebSocket per il sistema di presenza del menabò (join/leave pagina e divisione, kick, listeners eventi).
- **`ws-server.ts` — handlers menabo presence**: aggiunta gestione in-memory (`menaboSessions Map`) e funzioni helper (`buildAllPresences`, `broadcastDivisionPresence`, `cleanupMenaboSession`). Il cleanup avviene automaticamente al disconnect del socket.

## [2.16.026] - 2026-06-25

### Aggiunto
- **`MenaboCanvas.tsx` — pulsante elimina per singola pagina**: aggiunto un pulsante cestino nell'header di ogni pagina del canvas del menabò. Il pulsante è visibile solo quando ci sono almeno 2 pagine. Se la pagina contiene referenze o un'etichetta, mostra il dialogo di conferma già esistente (`pendingPageRemoval`); altrimenti elimina direttamente. Riutilizza `removePageAtIndex` e `setPendingPageRemoval` già presenti senza nuova logica.

## [2.16.025] - 2026-06-25

### Aggiunto
- **`MenaboCanvas.tsx` / `PromoService.ts` — nome promozione nella toolbar del Menabò**: la toolbar mostra ora il nome della promo corrente affianco al titolo "Gestione Menabò", permettendo all'utente di non perdere il contesto su quale promozione stia lavorando. Il nome viene esposto dall'endpoint `/promo/menabo` aggiungendo il campo `nomePromo` al ritorno di `getDatoPerMenabo` (già disponibile nell'oggetto promo recuperato) e mappato nel tipo `MenaboRisultato`. Il nome è troncato a 260px con `title` per tooltip su testo lungo.

## [2.16.024] - 2026-06-24

### Aggiunto
- **`RisultatoConfrontoTracciati/index.tsx` — copia descrizione e tema nelle righe del report**: aggiunti `CopyButton` su `descrizione` e `tema` nel componente `GroupedTableRow` (widget `grouped_table`, usato per entranti/uscenti per reparto). I pulsanti appaiono al hover con tooltip distinti ("Copia descrizione", "Copia tema"). Aggiunto parametro `title` opzionale a `CopyButton` (default `"Copia"`) senza breaking change sulle chiamate esistenti.

## [2.16.023] - 2026-06-24

### Corretto
- **`TracciatoReportPdfDocument.tsx` — esportazione PDF report confronto momenti**: i widget `referenze_split_table` (singoli/gruppi) e `grouped_table` (entranti/uscenti per reparto) erano esclusi dal PDF e non venivano mai renderizzati. Aggiunti i renderer PDF `PdfReferenzeSplitTable` (mostra singoli e gruppi come due sezioni distinte con label cromatica) e `PdfGroupedTable` (mostra le referenze raggruppate per reparto con codice, tipo, tema, sconto, prezzi e prestazione). Cablati nel router dei widget.
- **`TracciatoReportPdfDocument.tsx` — leggibilità tabella variazioni (`price_diff`)**: tutte le colonne usavano `flex: 1` uguale, risultando cramped con 8+ colonne su A4. Assegnati pesi proporzionali espliciti per colonna (codice 1.4, reparto 1.0, tipo 0.6, extra 2.0, campo 1.2, prima/dopo 1.2, Δ% 0.6); aumentati i limiti di troncatura per i valori prima/dopo.

## [2.16.022] - 2026-06-24

### Corretto
- **`MenaboCanvas.tsx` — desincronizzazione UI/dati al cambio del max referenze per pagina**: `onPageDrop` pre-splittava ogni gruppo trascinato in più `PlacedItem` separati basandosi sul max corrente. Quando il max cambiava in seguito, `paginatePlacedItems` ridistribuiva quegli slice stantii in modo incoerente: stessi record su pagine diverse, due card dello stesso gruppo sulla stessa pagina, delete che rimuoveva solo metà gruppo. Fix: `onPageDrop` salva ora UN singolo `PlacedItem` per gruppo (tutti i record, pageIndex di drop); `paginatePlacedItems` gestisce tutta la distribuzione visiva. Il cambio di max ri-distribuisce correttamente i record e il delete elimina sempre l'intero gruppo.
- **`MenaboCanvas.tsx` — pulsanti inserimento pagina a sinistra/destra**: aggiunta la callback `insertPageAt(insertIdx)` che sposta tutti gli item, etichette, override e label nascosti delle regole delle pagine >= insertIdx di +1, poi incrementa `pageCount`. Nell'interfaccia, ogni pagina mostra due pulsanti circolari (sinistra/destra) nascosti per default e visibili al passaggio del mouse (`group-hover/page`), con animazione hover e supporto dark mode. I pulsanti sono parte dell'undo/redo.
- **`MenaboCanvas.tsx` — hydration di salvataggi esistenti con gruppi multi-slice**: i layout già salvati serializzano i gruppi per pagina (uno slice per pagina). Il restore ora merga gli slice con lo stesso `groupId` in un singolo `PlacedItem` prima di popolare `items`, garantendo compatibilità backward e lo stesso comportamento corretto dalla prima apertura.
- **`MenaboCanvas.tsx` — undo/redo desincronizzava la sidebar**: `applySnapshot()` ripristinava gli item sul canvas ma non notificava il parent (`index.tsx`) del cambio. Dopo undo, i gruppi rimossi dal canvas restavan grigi nella sidebar (non trascinabili). Fix: `undo` e `redo` chiamano `onHydratedRecordsChange` con la lista aggiornata di record piazzati dopo ogni ripristino.
- **`MenaboCanvas.tsx` — hydration key ignorava il contenuto di `pagesFromRegole`**: la chiave di hydration e il dep array dell'`useEffect` usavano `pagesFromRegole.length` (numero intero). Se le regole cambiavano contenuto (es. etichette pagina) senza cambiare il numero di pagine, la re-hydration non scattava. Fix: sostituito con `JSON.stringify(pagesFromRegole)` nella chiave e `pagesFromRegole` nel dep array.
- **`MenaboCanvas.tsx` — fallback `payloadRecordKeys` formato errato**: il fallback in `onPageDrop` produceva chiavi in formato `` `${sourceKey}:${idx}` `` mentre il parent genera chiavi con `JSON.stringify([sourceKey, index])`. Fix: allineato il formato al parent.
- **`MenaboCanvas.tsx` — `clearAllContent` notificava due volte gli stessi record**: `removedFromPages` era ridondante perché derivato dagli stessi `items` già in `removedFromItems`. Rimosso; `notifyRemoved` riceve ora solo `removedFromItems`.

## [2.16.019] - 2026-06-17

### Corretto
- **`lib/server_call.ts` — `ensureCSRFToken`**: reso `public` per consentire l'uso esterno nelle chiamate `fetch` manuali (upload tracciati).
- **`src/pages/LavorazioniInCorso/DettagliLavorazioneInCorso/index.tsx` — `handleUploadTracciato`**: blindato l'upload dei tracciati contro errori CSRF persistenti. Prima del loop si chiama `ServerCall.ensureCSRFToken()` per garantire che il cookie esista; in caso di risposta 403 con codice CSRF (`CSRF_TOKEN_MISSING`, `CSRF_TOKEN_INVALID`, `CSRF_TOKEN_EXPIRED`) il token viene rinfrescato e la richiesta ripetuta automaticamente.

### Aggiunto
- **`src/pages/LavorazioniInCorso/DettagliLavorazioneInCorso/index.tsx`**: aggiunte due variabili d'ambiente Vite (`VITE_MOMENTI_ATTIVI`, `VITE_MENABO_ATTIVO`) per controllare la visibilità delle sezioni "Gestione momenti" e "Gestisci Menabò". Se `'true'` la sezione è visibile; se `undefined` o `'false'` è nascosta.

## [2.16.018] - 2026-06-11

### Aggiunto
- **`src/pages/MenaboPromo/MenaboCanvas.tsx` — pannello "Anteprima referenze"**: aggiunto un pulsante nell'header del pannello che appare alla selezione di un gruppo, che copia negli appunti tutti i codici delle referenze esposte in interfaccia (uno per riga, esclusi i placeholder `—`). Feedback visivo con icona di conferma per 1.5s; pulsante disabilitato quando non ci sono referenze.

## [2.16.017] - 2026-05-27

### Corretto
- **`src/pages/MenaboPromo/MenaboCanvas.tsx` — `buildIndesignPluginExport`**: riscritta la costruzione dei `filtri` per l'export JSON InDesign. La logica precedente appiattiva tutti i record di tutti i gruppi della pagina in un unico array e accoppiava per indice i valori unici di `tema` con quelli di `reparto` — causando la perdita di gruppi con lo stesso `tema` ma `reparto` diverso e accoppiamenti errati. Ora si itera per gruppo e si raccolgono coppie `(tema, reparto)` univoche dai record effettivi, garantendo un `filtro` corretto per ogni gruppo presente sulla pagina.
- **`src/pages/MenaboPromo/MenaboCanvas.tsx` — `getDefaultMaxCellsForPage`**: rimosso il lookup di `pageMaxOverrides` dal ciclo backward di fallback. Gli override utente sul numero massimo di referenze erano erroneamente ereditati da tutte le pagine successive prive di override proprio; ora ogni override è strettamente per-pagina e la propagazione riguarda solo le regole di `pagesFromRegole`.
- **`src/pages/MenaboPromo/MenaboCanvas.tsx` — `pagesFromRegole`**: avvolto in `useMemo` per stabilizzare il riferimento array ed evitare re-render inutili nei hook dipendenti.

## [2.16.016] - 2026-05-15

### Modificato
- **`docker/observability/grafana/dashboards/fidelity-platform-overview.json`**: aggiunta variabile dashboard `$job` (tipo `query`, datasource Prometheus) che si popola automaticamente con `label_values(up{job=~"fidelity-.+"}, job)` — corrisponde al `COMPOSE_PROJECT_NAME` di ciascuna istanza. Tutte le query PromQL e LogQL (47 occorrenze) aggiornate da `job=~"fidelity-server(-.+)?"` a `job=~"$job"`. Supporta selezione singola o "All" (regex `fidelity-.+`).
- **`docker/observability/prometheus.yml`**: aggiunta regola `relabel_configs` che sovrascrive il label `job` con il valore di `com_docker_compose_project` (= `COMPOSE_PROJECT_NAME`); rinominato `job_name` da `fidelity-server` a `fidelity-app` per coerenza.

## [2.16.015] - 2026-05-15

### Rimosso
- **`docker-compose.prod.yml` — servizio `nginx`**: nginx rimosso dalla configurazione di produzione. L'app è ora esposta direttamente sull'host senza reverse proxy interno.

### Modificato
- **`docker-compose.prod.yml` — servizio `app`**: `expose` ripristinato a `ports` (`NODE_PORT` e `WS_PORT`); l'app è ora raggiungibile direttamente dall'host.
- **`docker-compose.prod.yml` — servizio `grafana`**: `expose` ripristinato a `ports` (`127.0.0.1:${DOCKER_GRAFANA_PORT:-3000}:3000`); rimosse le variabili `GF_SERVER_ROOT_URL` e `GF_SERVER_SERVE_FROM_SUB_PATH` non più necessarie senza nginx.
- **`docker-compose.prod.yml` — commento variabili**: rimossi i riferimenti a `DOMAIN`, `NGINX_HTTP_PORT`, `NGINX_HTTPS_PORT` e variabili SSL; aggiunta `DOCKER_GRAFANA_PORT`.

## [2.16.014] - 2026-05-15

### Corretto
- **`docker/observability/prometheus.yml`**: ripristinata la service discovery Docker (`docker_sd_configs`) dopo tentativo fallito con static config. Il problema originale ("No data") era dovuto al container `app`/`server` non in esecuzione, non alla configurazione SD. Docker SD funziona correttamente su Linux (ambienti test/prod) dove tutti i container girano sullo stesso network Compose e Prometheus raggiunge gli IP interni (172.x.x.x) tramite Docker socket.

## [2.16.013] - 2026-05-15

### Modificato
- **`docker/observability/grafana/dashboards/fidelity-platform-overview.json`**: dashboard Grafana completamente riscritta con 49 pannelli organizzati in 6 sezioni. Aggiunta riga **Stato Servizi** con uptime e heap %; riga **KPI HTTP** con P50/P95/P99 e contatore errori ultimi 5min; sezione **HTTP Trend** con request rate per categoria (2xx/4xx/5xx), latenza percentili, top-10 route e distribuzione status code; sezione **Node.js Runtime** con heap %, RSS, CPU user/system, event loop lag P50/P90/P99, GC per tipo e handle/FD; sezione **PostgreSQL** con deadlock, file temporanei, statistiche tabelle e query attive; sezione **Logs (Loki)** con contatori per livello (INFO/WARN/ERROR basati su livelli numerici Pino), volume per minuto e log live filtrati. Tutti i pannelli timeseries hanno tooltip multi-serie, legenda tabulare e fillOpacity gradient; tutti i pannelli stat hanno soglie colorate con `colorMode: background`.

## [2.16.012] - 2026-05-14

### Aggiunto
- **`docker/nginx/nginx.conf.template`**: nuovo template nginx per produzione con redirect HTTP→HTTPS, TLS hardening (TLSv1.2/1.3, OCSP stapling, session cache), security headers completi, gzip, proxy trasparente per API, WebSocket (`/socket.io/`) e Grafana (`/grafana/`), cache statica e SPA fallback.
- **`docker-compose.prod.yml` — servizio `nginx`**: nginx 1.27-alpine aggiunto come unico entry point pubblico in produzione; monta il template, i certificati SSL e la build client staticamente.

### Modificato
- **`docker-compose.prod.yml` — servizio `app`**: `ports` sostituito con `expose` — le porte Node sono ora raggiungibili solo dagli altri container (nginx), non dall'host.
- **`docker-compose.prod.yml` — servizio `grafana`**: `ports` sostituito con `expose`; aggiunte variabili `GF_SERVER_ROOT_URL` e `GF_SERVER_SERVE_FROM_SUB_PATH` per il corretto funzionamento dietro nginx su `/grafana/`.
- **`docker-compose.prod.yml` — variabili SSL configurabili**: i percorsi dei certificati TLS (`SSL_CERTIFICATE_PATH`, `SSL_CERTIFICATE_KEY_PATH`, `SSL_TRUSTED_CERTIFICATE_PATH`) sono ora definibili via `.env` con default a `/etc/nginx/ssl/fullchain.pem` e `privkey.pem`.

## [2.16.011] - 2026-05-14

### Corretto
- **`CombinazioneAreeCanaliService.getAllCombinazioniForGDOReworked`** (`server/core/services/CombinazioneAreeCanaliService.ts`): eliminato pattern N+1 — le query `findById` per canale e area eseguite per ogni combinazione sono state sostituite con due `findAll` con `Op.in` e lookup O(1) tramite `Map`. Da 2N query parallele a 2 query totali. Aggiunti import di `Op`, `Canale` e `Area`.
- **`IstantaService.downloadKitsByTipoDiExport`** (ramo multi-kit) (`server/core/services/IstantaService.ts`): eliminato il nested N+1 — `FilesRuntime.findAll` veniva chiamato una volta per ogni kit. Ora tutti i file vengono caricati in una singola query con `Op.in` sui kit IDs e raggruppati per kit tramite `Map`. Le chiamate API esterne a ISTANTA restano parallele via `Promise.all`.
- **`IstantaService.downloadKitsByTipoDiExport`** (`server/core/services/IstantaService.ts`): sostituito `console.error` con `log.error` strutturato dal logger Pino; rimosso import inutilizzato di `Colorize`.

## [2.16.010] - 2026-05-14

### Corretto
- **`container.ts` — repository singleton** (`server/core/di/container.ts`): tutti i 39 binding di repository usavano `toDynamicValue()` senza `.inSingletonScope()`, bypassando il `defaultScope: "Singleton"` del container e istanziando un nuovo repository ad ogni risoluzione. Aggiunto `.inSingletonScope()` a tutti i binding stateless che estendono `BaseRepository`.
- **`apiKeyAuth.ts` — log config mancante** (`server/core/middleware/apiKeyAuth.ts`): quando `FICO_SECRET` non è configurato, `verifyApiKey` ritornava `false` silenziosamente; il middleware interpretava il risultato come chiave errata invece di config rotta. Aggiunto `log.error` esplicito prima del return.

## [2.16.009] - 2026-05-14

### Corretto
- **`AttivitaService.mark_all_as_read`** (`server/core/services/AttivitaService.ts`): eliminato il full table scan su `Attivita` senza `where`. La logica ora carica solo gli ID delle attività esistenti e quelli già presenti in `AttivitaUtente` per l'utente, crea solo le righe mancanti tramite `bulkCreate`, e aggiorna quelle esistenti non lette con un singolo `update` bulk. Rimosso `Op` da `sequelize` (non più necessario).
- **`AttivitaService.get_attivita_filtered_by_type`** (`server/core/services/AttivitaService.ts`): metodo rimosso — non era dichiarato nell'interfaccia `IAttivitaService` e non aveva chiamanti nei controller.
- **`AttivitaService.getAttivitaCount`** (`server/core/services/AttivitaService.ts`): sostituiti i cast `as any` sui risultati di `sequelize.query` con il tipo locale `CountRow`; aggiunto `parseInt` per convertire correttamente i valori stringa restituiti da PostgreSQL.

## [2.16.008] - 2026-05-14

### Corretto
- **`IGdoService` / `GdoService`** (`server/core/interfaces/IGdoService.ts`, `server/core/services/GdoService.ts`): rimosso il metodo `saveGestionePagineSingular` — l'intero corpo era commentato e ritornava solo `null`. Rimosso anche l'import inutilizzato di `NotFoundError`.
- **`AttivitaController.get_attivita`** (`server/core/controllers/AttivitaController.ts`): sostituito il cast diretto `req.query.categoria as CATEGORIA_ATTIVITA` con validazione tramite `Object.values(CATEGORIA_ATTIVITA).includes(...)` per evitare valori enum non validi passati dall'esterno.
- **`AttivitaController.get_attivita_count`** (`server/core/controllers/AttivitaController.ts`): rimosso il cast `this.attivitaService as AttivitaService` aggiungendo `countUnreadForUser(userId: string): Promise<UnreadCountResponse>` all'interfaccia `IAttivitaService`. Rimosso anche l'import di `AttivitaService` dal controller.

## [2.16.007] - 2026-05-13

### Corretto
- **`AreaService.updateArea`** (`server/core/services/AreaService.ts`): il metodo restituiva l'oggetto fetchato prima dell'update invece del record aggiornato. Ora usa il valore di ritorno di `areaRepository.update()` (che esegue internamente il re-fetch) e applica `mapToDTO`.
- **`AreaService.getAllAreeForGDO`** (`server/core/services/AreaService.ts`): corpo identico a `getAreasByGDOId`. Eliminata la duplicazione: `getAllAreeForGDO` delega ora a `getAreasByGDOId`.
- **`AreaService.getAllAreasFromMaterializedView` / `getAreasByGDOIdFromMaterializedView`** (`server/core/services/AreaService.ts`): rimossi i dynamic import `await import('../db/SequelizeConnector')` ridondanti — `sequelize` era già importato staticamente a inizio file.
- **`CanaleService.updateCanale`** (`server/core/services/CanaleService.ts`): il metodo restituiva il canale fetchato prima dell'update. Ora usa il valore di ritorno di `canaleRepository.update()` e applica `mapToDTO`.
- **`CanaleService.createCanale` — upsert** (`server/core/services/CanaleService.ts`): rimossa la query `findById` ridondante dopo `update` nel ramo upsert — `BaseRepository.update()` ritorna già il record aggiornato.
- **`CanaleService.getAllCanaliForGDO`** (`server/core/services/CanaleService.ts`): rimosso null check su `findAll()` (non ritorna mai null) e eliminata la logica duplicata; il metodo delega ora a `getCanaliByGDOId`.
- **`CanaleService.getAllCanaliFromMaterializedView` / `getCanaliByGDOIdFromMaterializedView`** (`server/core/services/CanaleService.ts`): rimossi i dynamic import ridondanti — `sequelize` era già importato staticamente.
- **Messaggi di log** (`AreaService.ts`, `CanaleService.ts`): tutti i messaggi `log.error` portati al formato strutturato con contesto (`{ id }`, `{ gdoId }`, `{ idGDO }`, ecc.) e descrizione umana dell'operazione fallita.

## [2.16.006] - 2026-05-13

### Modificato
- **DashboardCategory — validità nelle tabelle scoreboard** (`src/pages/DashboardCategory/index.tsx`, `server/core/services/TracciatoService.ts`, `lib/types.ts`): le colonne "Data" nelle tabelle "Focus per canale/area" e "Score per promo × reparto" mostrano ora `validita_dal — validita_al` al posto di `computedAt`. Il backend aggiunge `validaAl` ai dati della `CategoryScoreboardTimeline` tramite lookup sul modello `Promo`.

## [2.16.005] - 2026-05-13

### Modificato
- **DashboardCategory — date validità promozioni** (`src/pages/DashboardCategory/index.tsx`): nella card "Promozioni in corso" la sub-riga mostra ora entrambe le date di validità nel formato `DD MMM YYYY — DD MMM YYYY` (inizio e fine), invece della sola data di scadenza.

### Rimosso
- **DashboardCategory — card "Ultimo calcolo"** (`src/pages/DashboardCategory/index.tsx`): eliminata la KPI card che mostrava la data dell'ultimo calcolo dello scoreboard. La griglia KPI passa da 4 a 3 colonne.

## [2.16.004] - 2026-05-13

### Modificato
- **DashboardCategory — grafici raggruppati per data** (`src/pages/DashboardCategory/index.tsx`, `server/core/services/TracciatoService.ts`, `lib/types.ts`): i grafici per canale/area usano ora la `validaDal` della promozione come asse X. Le promozioni con la stessa data vengono aggregate e gli score per reparto vengono mediati. Le tabelle sotto i grafici continuano a mostrare le singole promozioni non raggruppate. Il backend aggiunge il campo `validaDal` ai dati di `CategoryScoreboardTimeline` tramite lookup sul modello `Promo`.

## [2.16.003] - 2026-05-13

### Corretto
- **DashboardCategory — plurale reparti** (`src/pages/DashboardCategory/index.tsx:419`): il banner mostrava "2 repartoi assegnatoi" a causa di una concatenazione errata. Sostituito con `settoriNomi.length === 1 ? "1 reparto assegnato" : "${n} reparti assegnati"`.
- **DashboardCategory — titolo promozioni** (`src/pages/DashboardCategory/index.tsx:527`): aggiunto fallback `|| "—"` quando `nomePromo` è null/vuoto; la sub-riga mostra ora solo "Scade il GG MMM AAAA" (rimossa la data di inizio, ridondante per promo già attive).
- **TracciatoService — `getCategoryScoreboardTimeline`** (`server/core/services/TracciatoService.ts`): il calcolo della serie per reparto restituiva sempre `null` quando il match era presente solo nei widget `viewsPerCanaleArea` e non nel top-level `report.widgets`. Aggiunto fallback: se il widget top-level non contiene il reparto, la funzione media i valori trovati nelle view per-canale/area.

## [2.16.002] - 2026-05-13

### Modificato
- **`BaseController.handleError`** (`server/core/base/BaseController.ts`): il log dell'errore ora include `path`, `method` (da `res.req`) e, per `AppError`, il codice errore (`[VALIDATION_ERROR]`, `[NOT_FOUND]`, ecc.) e lo status HTTP. Elimina il messaggio generico `'Error:'` precedente e rende ogni log controller identificabile senza leggere lo stack trace.
- **`errorHandler.ts`** (`server/core/middleware/errorHandler.ts`): rimosso `console.error` dal `defaultLogger`, sostituito con `log.error` strutturato Pino con `path`, `method` e — per `AppError` — il codice errore e lo status HTTP.
- **`ws-server.ts`** (`server/ws-server.ts`): eliminati tutti i `console.log/warn/error`. Log per-evento (`emitBuffer`, `socket.onAny`, IPC master↔worker) retrocessi a `log.debug` (silenziosi in produzione); log di lifecycle (avvio, arresto, connessione/disconnessione) promossi a `log.info`; errori fatali (timeout, porta occupata, setup fallito) usano `log.error` con contesto strutturato.
- **`server/index.ts`** (`server/index.ts`): sostituiti tutti i `console.log/error` con `log.info`/`log.error` Pino; ridotto il numero di messaggi di avvio a quelli informativi (rimosso il duplicato per singolo step).
- **`MongoDBConnector.ts`** (`server/core/db/MongoDBConnector.ts`): rimossi i 3 `console.error` residui, sostituiti con `log.error` strutturato con contesto (`dbName`); rimosso import inutilizzato `Colorize`.

## [2.16.001] - 2026-05-12

### Aggiunto
- **Dashboard Category** (`src/pages/DashboardCategory/index.tsx`): nuova dashboard dedicata al ruolo `CATEGORY` con filtro automatico degli scoreboard sui reparti assegnati all'utente via `GlobalUserFilter.settoriNomi`. Include banner reparti, 4 KPI card, box volantini in corso, box promozioni in corso, grafico lineare per reparto, tabella promo × reparto con score colorati e riga media, pannello espandibile con dettaglio ultima promo per ciascun reparto (stabilità, inalterati/modificati/entranti/uscenti, referenze totali).
- **Route `category/dashboard`** (`src/router/index.tsx`): aggiunta route con lazy load verso `DashboardCategory`.
- **Mappa inversa settoriFinali → nomi reparto** (`server/core/agenzia_lib/coopfi/utility/coopfi-settore-finale-map.ts`): mappa statica esplicita da codici `settoriFinali` (es. `"chimica"`) ai nomi canonici usati in `row.reparto` di COOPFI_REPARTO_MAP (es. `"Chimica Igiene Casa e Cura Persona"`). Espone `resolveRepartoNamesForSettoriFinali()`.
- **Campo `settoriNomi`** (`lib/types.ts`, `GlobalUserFilter`): array di nomi reparto canonici per filtrare le righe scoreboard lato client senza aggiungere endpoint.

### Modificato
- **Dashboard Marketing** (`src/pages/DashboardMarketing/index.tsx`): redesign completo del layout con cinque sezioni — (A) 4 KPI card animate (promo analizzate, score medio color-coded, trend positivi ↑, trend negativi ↓); (B) snapshot orizzontale ultimo score per combinazione + istogramma distribuzione score in 5 bucket; (C) top 3 / bottom 3 performer con card color-coded; (D) grafico lineare andamento nel tempo a 420px; (E) tabella dettaglio con colonna trend Δ (↑/↓/→), score colorati, intestazioni cliccabili per ordinamento.
- **`getGlobalFiltersForUser`** (`server/core/agenzia_lib/coopfi/index.ts`): popola `settoriNomi` chiamando `resolveRepartoNamesForSettoriFinali(result.finalSettori)`.
- **`getGlobalFiltersForUser`** (`server/core/agenzia_lib/default/index.ts`): aggiunto `settoriNomi: []` al return per conformità al tipo aggiornato.

## [2.15.003] - 2026-05-11

### Corretto
- **PostGIS mancante nel container Postgres** (`docker-compose.dev.yml`): sostituita immagine `postgres:17-alpine` con `postgis/postgis:17-3.4-alpine` — necessaria perché il modello `Utente` usa `DataTypes.GEOMETRY('POINT', 4326)` sulla colonna `geom_utenti`, che richiede l'estensione PostGIS. Senza di essa `models:sync` falliva silenziosamente e la tabella `utenti` non veniva creata.
- **Estensioni PostgreSQL mancanti** (`docker/postgres-init/00-extensions.sql`): aggiunto script di init che crea `uuid-ossp` (richiesta da `uuid_generate_v4()` nei modelli) e `postgis` prima di qualsiasi restore. Il prefisso `00` garantisce l'esecuzione prima di `01-restore.sh`.
- **Immagine pg_dump in db:export** (`server/core/scripts/exportToDocker.ts`): allineata a `postgis/postgis:17-3.4-alpine` per coerenza con il container postgres di sviluppo.

## [2.15.002] - 2026-05-11

### Aggiunto
- **Migrazione DB locale → Docker** (`server/core/scripts/exportToDocker.ts`, `package.json`): nuovo script `npm run db:export` che usa `docker run postgis/postgis:17-3.4-alpine` per esportare il database locale in `docker/data/fidelity-dump.dump` senza richiedere `pg_dump` installato sul host.
- **Auto-restore al primo avvio** (`docker/postgres-init/01-restore.sh`): script init postgres che rileva il dump e lo ripristina automaticamente al primo avvio del container (quando il volume è vuoto). Se non c'è dump, il DB parte vuoto e può essere inizializzato successivamente dall'applicazione.
- **Entrypoint server Docker** (`docker/server-entrypoint.sh`, `docker/server.dev.Dockerfile`): lo script attende che Postgres sia pronto via `pg_isready` e poi avvia il server; il comando `models:sync` è attualmente presente ma commentato nello script, quindi non viene eseguito automaticamente.
- **`.dockerignore`**: esclude `node_modules`, `dist`, `.env`, dump files dall'immagine Docker.
- **`docker/data/.gitkeep`**: directory per i dump file (esclusi da git).

### Modificato
- **`docker-compose.dev.yml`**: rimosso `.env.docker`, usa `.env` come sorgente unica. Credenziali postgres lette da `.env` tramite interpolazione docker-compose (`${DB_POSTGRESQL_NAME}` etc.). Healthcheck postgres con `pg_isready` e `depends_on: condition: service_healthy`. `extra_hosts: host.docker.internal:host-gateway` per raggiungere servizi host (es. MongoDB) dal container server.
- **`.gitignore`**: aggiunto `docker/data/*.dump`, `docker/data/*.sql`, `.env.docker`.

## [2.15.001] - 2026-05-11

### Aggiunto
- **Corporate Backend Foundation — Docker PostgreSQL-only** (`docker-compose.dev.yml`, `docker/server.dev.Dockerfile`, `docker/client.dev.Dockerfile`, `.env.docker.example`): infrastruttura Docker per lo sviluppo con PostgreSQL 16, Redis 7, Prometheus, Grafana, Loki e Promtail. MongoDB non incluso.
- **Observability stack** (`docker/observability/prometheus.yml`, `docker/observability/loki.yml`, `docker/observability/promtail.yml`): Prometheus fa scrape di `/metrics` sul server ogni 15s; Promtail raccoglie i log container e li invia a Loki; Grafana disponibile su porta 3001.
- **Endpoint `/health` e `/metrics`** (`server/src/app/http/health.routes.ts`, `server/src/app/http/metrics.routes.ts`, `server/core/server.ts`): GET /health verifica HTTP, PostgreSQL e Redis; GET /metrics espone metriche Prometheus (default + custom).
- **Foundation shared — logger, cache, queue, errori, http** (`server/src/shared/`): logger Pino JSON, middleware request-logger, client ioredis opzionale, cache service con fallback no-op, factory BullMQ queue, nomi queue (`whatsapp`, `webhooks`, `exports`, `emails`, `ai-content`), metriche prom-client, health handler, AppError, response helper, pagination helper, rate-limit placeholder Redis-ready.
- **Foundation app** (`server/src/app/di/modules.ts`): placeholder `registerApplicationModules` per futura registrazione moduli.
- **Moduli dominio** (`server/src/modules/*/README.md`): struttura directory per audit, webhooks, whatsapp, menabo, tenants, catalog, promotions, tracking — solo README, nessuna business logic spostata.
- **Documentazione** (`docs/backend-corporate-foundation.md`, `docs/rollback-corporate-foundation.md`): architettura target, guide Docker, Redis, Grafana, ordine migrazione moduli, rollback manuale.
- **Dipendenze** `bullmq`, `ioredis`, `prom-client` aggiunte a `server/package.json`.
- **Script npm** `dev:docker`, `docker:dev:down`, `docker:dev:logs` aggiunti a `package.json`.

### Modificato
- **Config MongoDB opzionale** (`server/core/config/index.ts`): `MONGO_URL` e `MONGO_DB_NAME` resi `optional()` in Zod — il setup Docker PostgreSQL-only non richiede MongoDB.

## [2.14.014] - 2026-05-11

### Aggiunto
- **Global User Filters per utenti CATEGORY** (`lib/types.ts`, `server/core/agenzia_lib/types.ts`, `server/core/agenzia_lib/default/index.ts`, `server/core/agenzia_lib/coopfi/index.ts`, `server/core/controllers/UserController.ts`, `server/core/routes.ts`, `src/query/query.tsx`): introdotto il tipo `GlobalUserFilter` e il metodo `getGlobalFiltersForUser()` nell'interfaccia `IAgenziaLib`. Gli utenti `CATEGORY` in CoopFI ricevono filtri derivati dal loro `codice_posizione` (tramite `buildCoopfiPolicyFromCodeV2`): settori finali, reparti e area di competenza. Tutti gli altri tipi utente (e l'implementazione `DefaultAgenziaLib`) ricevono filtri non restrittivi (`isRestricted: false`). Il metodo è esposto via `GET /api/utenti/me/global-filters` e consumabile dal frontend con l'hook `useFetchGlobalUserFilters()`.

## [2.14.013] - 2026-05-11

### Rimosso
- **Report Tracciati — Opzione "Movimenti prodotti" rimossa da CoopfiAgenziaLib** (`server/core/agenzia_lib/coopfi/index.ts`): l'opzione `coopfi_movimenti_prodotti` è stata eliminata da `getReportOptions()` in quanto non utile per Coopfi. Rimossi anche i metodi privati usati esclusivamente da quell'opzione (`_buildGroupedTableGroups`, `_buildPluginGroupedEntranti`, `_buildPluginGroupedUscenti`).

### Modificato
- **Report Tracciati — Redesign della pagina di selezione opzioni** (`src/pages/ReportTracciati/index.tsx`): le option card sono state ridisegnate con bordo doppio, icona più grande (48×48 px, rounded-xl), badge di selezione animato, chip plugin con icona `Layers` colorati in base allo stato. Il layout è passato da lista verticale a griglia responsive 2 colonne (`grid-cols-1 sm:grid-cols-2`). Rimossa la dipendenza da `Badge`.

## [2.14.012] - 2026-05-08

### Aggiunto
- **Report Tracciati — Opzioni per cliente con plugin builder** (`server/core/agenzia_lib/types.ts`, `server/core/agenzia_lib/coopfi/index.ts`, `server/core/agenzia_lib/default/index.ts`, `server/core/services/TracciatoService.ts`, `server/core/controllers/TracciatoController.ts`, `src/pages/ReportTracciati/index.tsx`, `src/query/query.tsx`, `lib/types.ts`): i preset hardcoded della pagina Report Tracciati sono stati sostituiti con un sistema di opzioni definite per cliente in `IAgenziaLib`. Ogni opzione dichiara autonomamente `query` (promoFilter, momentoSelector, aggregazione) e un set di **plugin builder** — funzioni lato server che costruiscono ciascuna un singolo widget del report. Il frontend carica le opzioni via `GET /api/tracciati/report-options` e invia solo `{ optionId }` a `POST /api/tracciati/scoreboard/opzione`; il server risolve la query e chiama i builder dei plugin. `CoopfiAgenziaLib` espone tre opzioni (Scoreboard completo, Movimenti prodotti, Analisi trend annuale); `DefaultAgenziaLib` restituisce lista vuota. La pagina ReportTracciati è stata riscritta per mostrare le opzioni come card con i plugin elencati sotto.

## [2.14.011] - 2026-05-06

### Modificato
- **MenaboCanvas — Rimossa la griglia SVG** (`src/pages/MenaboPromo/MenaboCanvas.tsx`): eliminati il pulsante "Griglia" dalla toolbar, lo stato `showGrid`, i pattern SVG `gm-*`/`gM-*` (griglia minore/maggiore) e le costanti `GRID_MINOR`/`GRID_MAJOR`. Le guide margine e i segni di registrazione agli angoli rimangono invariati.

### Aggiunto
- **MenaboCanvas — Undo/Redo** (`src/pages/MenaboPromo/MenaboCanvas.tsx`): implementato sistema di annulla/ripristina con stack di fino a 50 snapshot. Ogni mutazione (drag, rimozione gruppo/etichetta, modifica limite referenze per pagina, aggiunta/rimozione pagina, "Elimina tutto") salva uno snapshot prima della modifica. I pulsanti Annulla (Ctrl+Z) e Ripristina (Ctrl+Y / Ctrl+Shift+Z) sono disponibili in toolbar; vengono disabilitati quando non applicabili. La history viene azzerata al cambio di divisione/canale.

## [2.14.010] - 2026-05-05

### Modificato
- **MenaboCanvas — Colore differenziato per la parte reparto nell'etichetta gruppo** (`src/pages/MenaboPromo/MenaboCanvas.tsx`): quando il label di un gruppo contiene il separatore ` · ` (es. `FUORI DEPLIANT FOOD · SALUMI E FORMAGGI`), il nome del gruppo principale viene renderizzato in colore scuro standard, il puntino `·` in grigio attenuato e la parte reparto nel colore accent del gruppo, rendendo immediatamente riconoscibile la suddivisione a colpo d'occhio.

## [2.14.009] - 2026-05-05

### Modificato
- **MenaboCanvas — Export Excel spostato lato server con dati agenziaLib** (`src/pages/MenaboPromo/MenaboCanvas.tsx`, `server/core/services/PromoService.ts`, `server/core/controllers/PromoController.ts`): l'export Excel del menabò non viene più generato client-side con xlsx. Il canvas invia il layout corrente della divisione all'endpoint `POST /api/promo/:idPromo/export/xlsx`; il server usa `agenziaLib.CHIAVE_CAMPO_MENABO` e `CHIAVE_DEDUP_MENABO` per determinare i campi da includere e produce un file xlsx con una riga per ogni referenza piazzata (colonne: Pagina, Note, Gruppo scelto, campo prodotto, codice dedup, referenze nel gruppo, referenze nella pagina). Il download viene eseguito via blob URL. Rimosso il codice xlsx client-side e i tipi `MenaboExportRow` non più necessari.

## [2.14.008] - 2026-05-05

### Aggiunto
- **MenaboPromo — Stato di errore per analisi del primo momento mancante** (`src/pages/MenaboPromo/index.tsx`): quando il server risponde con errore per `useFetchDatoPerMenabo` (es. nessun `TracciatiMomento` configurato per la promozione o risultati del primo momento vuoti), la pagina mostra un full-screen blocking state con icona, titolo "Analisi del momento non disponibile", testo esplicativo e un banner di avviso. L'intera UI canvas/sidebar non viene renderizzata poiché l'operazione non è realizzabile senza l'analisi del primo momento.

## [2.14.007] - 2026-05-05

### Modificato
- **MenaboPromo — Nasconde i singoli coperti da un gruppo piazzato** (`src/pages/MenaboPromo/index.tsx`): quando un record di gruppo (con `Scatto.CodiceGruppo` contenente più codici separati da virgola) viene trascinato sul canvas, i record singoli il cui codice è elencato nel `Scatto.CodiceGruppo` del gruppo piazzato vengono automaticamente nascosti dalla sidebar. La logica rispecchia il pattern già usato nel confronto (`resolveGroupMembersFromScattoCodice`): primo passaggio per raccogliere i `groupedCodes` dai record piazzati, secondo passaggio per applicare il filtro su record disponibili e sottogruppi. I record di gruppo non vengono nascosti, solo i singoli componenti.

## [2.14.006] - 2026-05-05

### Modificato
- **MenaboCanvas — Larghezza piena e altezza proporzionale degli item trascinati** (`src/pages/MenaboPromo/MenaboCanvas.tsx`): i blocchi referenza nella pagina occupano ora tutta la larghezza disponibile (area A4 meno margini). L'altezza di ogni blocco è proporzionale al rapporto tra le referenze dell'item e il massimo consentito per la pagina (`referenzePerPagina`), dando un senso visivo di "pienezza" della pagina. Quando il limite è Infinity (nessuna regola attiva) si usa come denominatore il totale effettivo sulla pagina.
- **MenaboCanvas — Propagazione referenze salta le pagine con etichetta** (`src/pages/MenaboPromo/MenaboCanvas.tsx`): durante il drag (`onPageDrop`) e il ricalcolo della distribuzione (`paginated`), quando le referenze di un gruppo overflow verso la pagina successiva, le pagine bloccate da etichetta (`mergedPageLabels`) vengono saltate automaticamente. Aggiunto `mergedPageLabels` alle dipendenze del `useMemo` di `paginated`.

## [2.14.005] - 2026-05-05

### Corretto
- **Menabò — `label` mostra il codice leggibile di canale/area** (`server/core/services/PromoService.ts`): il campo `label` in `MenaboRisultatoCanale` conteneva il GUID grezzo (es. `e807d197-...`) invece del codice identificativo. `PromoService.getDatoPerMenabo` ora arricchisce le label dopo la chiamata ad agenziaLib: raccoglie i GUID presenti negli `id` delle sezioni, effettua un bulk-lookup su `Canale` (`codice_canali`) e `Area` (`codice_aree`), e rimpiazza le label con il codice leggibile. Per `area_e_canale` la label diventa `"codiceCanale / codiceArea"`. Fallback al GUID originale se il codice non viene trovato.

## [2.14.004] - 2026-05-05

### Modificato
- **Menabò — Separazione `id` e `label` in `MenaboRisultatoCanale`** (`lib/types.ts`, `server/core/agenzia_lib/coopfi/index.ts`, `src/pages/ImpostazioniDiProduzione/PanelMenabo/index.tsx`, `src/pages/MenaboPromo/MenaboCanvas.tsx`, `src/pages/MenaboPromo/index.tsx`): `MenaboRisultatoCanale` ottiene il campo `id: string` (la `sectionKey` prodotta da CoopFi, sempre lowercase: `guidCanale`, `guidArea`, oppure `guidCanale:guidArea`). In precedenza il campo `label` svolgeva entrambi i ruoli — display e chiave di matching — il che era semanticamente scorretto. CoopFi ora espone `id` iterando sulle `entries()` della mappa. `PanelMenabo` salva le divisioni `canale`/`area` con ID lowercase e per `area_e_canale` usa `${id_canale}:${id_area}` (allineato al formato CoopFi) invece dell'ID opaco della combinazione. `MenaboCanvas` matcha la divisione su `.id` anziché `.label` e non usa più `any` per il prop. `index.tsx` seleziona/trova il canale tramite `id` e mostra la `label` solo nel dropdown come testo display.

## [2.14.003] - 2026-05-05

### Corretto
- **MenaboCanvas — Etichette da `regoleMenabo` non visualizzate** (`src/pages/MenaboPromo/MenaboCanvas.tsx`): `mergedPageLabels` veniva calcolato correttamente ma mai usato — il render, `onPageDrop` e `lockedPageCount` leggevano ancora `pageLabels` (stato locale, sempre vuoto con regole attive). Ora tutte e tre le letture usano `mergedPageLabels`/`mergedPageLabelsRef`. Le pagine con etichetta da regola risultano correttamente bloccate e il conteggio "bloccate" in toolbar è preciso. Il pulsante "rimuovi etichetta" viene nascosto per le etichette provenienti da `regoleMenabo` (non modificabili dall'utente).

## [2.14.002] - 2026-05-04

### Modificato
- **AgenziaLib — `getDatoPerMenabo` guidata da `regole_menabo`** (`lib/types.ts`, `server/core/agenzia_lib/types.ts`, `server/core/agenzia_lib/coopfi/index.ts`, `server/core/services/PromoService.ts`, `server/core/di/container.ts`): la firma di `getDatoPerMenabo` passa da `canale?: string` a `params: MenaboDivisioneParams` (`tipoDivisione` + `filtroCanale` opzionale). `PromoService` legge `regole_menabo` tramite `IConfigService` (iniettato via DI) e determina il `tipoDivisione` da passare all'agenziaLib — nessuna query al modello direttamente dalla lib. `CoopfiAgenziaLib` partiziona i tracciati in sezioni in base al tipo scelto: `canale` → chiave `guidCanale`, `area` → chiave `guidArea`, `area_e_canale` → chiave `guidCanale:guidArea`. `MenaboRisultatoCanale` aggiunge `guidArea?`; `MenaboRisultato` aggiunge `tipoDivisione`. Aggiornati i test unitari in `coopfi-menabo.test.ts` con casi per tutte e tre le modalità di divisione.

## [2.14.001] - 2026-05-04

### Aggiunto
- **Regole Menabò — Configurazione base** (`lib/types.ts`, `server/core/models/config.ts`, `server/core/services/ConfigService.ts`, `server/core/controllers/ConfigController.ts`, `src/query/query.tsx`): nuova colonna JSONB `regole_menabo` nella tabella `config` per persistere le impostazioni base del canvas Menabò. La struttura `RegoleMenabo` comprende `tipoDivisione` (`area` | `canale` | `area_e_canale`) e `paginePerDivisione` (array di `RegolaMenaboPagina`, ognuna con `etichetta` opzionale e `referenzePerPagina`). Aggiunti endpoint REST `GET/POST/DELETE /api/regole-menabo`, metodi nel service e nell'interfaccia, hook React Query `useFetchRegoleMenabo`, `useSaveRegoleMenabo`, `useDeleteRegoleMenabo`.
- **Impostazioni di Produzione — Sezione Menabò** (`src/pages/ImpostazioniDiProduzione/PanelMenabo/index.tsx`, `src/pages/ImpostazioniDiProduzione/index.tsx`): nuovo pannello nella pagina Impostazioni di Produzione per configurare le regole base del Menabò. `tipoDivisione` (canale / area / area e canale) è un selettore d'asse che determina su quali entità si costruisce lo scheletro: il pannello carica i canali, le aree o le combinazioni attive tramite `useFetchAreeCanaliECombinazioni` e mostra una card collassabile per ciascuna entità. In ogni card si definisce la lista di pagine con etichetta opzionale e numero massimo di referenze. Cambiando tipo di divisione il form ricalcola l'elenco mantenendo i dati già inseriti per gli ID in comune. Struttura dati aggiornata: `RegoleMenaboDivisione` con `id` + `pagine` sostituisce il precedente array generico `paginePerDivisione`.

## [2.13.020] - 2026-05-04

### Corretto
- **Menabò — Etichetta non trascinabile se vuota** (`src/pages/MenaboPromo/index.tsx`): il drag dell'etichetta è disabilitato quando il campo di testo è vuoto o contiene solo spazi. Il pill mostra cursore `not-allowed` e opacità ridotta; il suggerimento "trascina →" e il tooltip cambiano in base alla presenza di testo.

## [2.13.019] - 2026-05-04

### Modificato
- **Menabò Canvas — Etichette pagina con blocco interazione** (`src/pages/MenaboPromo/MenaboCanvas.tsx`): le etichette non sono più elementi floating spostabili sulla pagina. Trascinando un'etichetta su una pagina, questa viene assegnata all'intera pagina (page-level label) e la pagina diventa bloccata: non accetta nuovi gruppi dalla sidebar, gli elementi esistenti non sono cliccabili/selezionabili, e un overlay semitrasparente mostra il testo dell'etichetta in filigrana. L'header della pagina mostra l'etichetta con colore, icona lucchetto e bottone per rimuoverla (sblocca). Rimossa tutta la logica floating (move/resize pointer events, `PlacedLabel`, `LabelInteraction`).

## [2.13.018] - 2026-05-04

### Corretto
- **Menabò Canvas — Riempimento pagina** (`src/pages/MenaboPromo/MenaboCanvas.tsx`): la pagina si riempie ora in modo uniforme in base al numero di referenze. Corretta la funzione `getRecordSlotHeight` che sovrastimava le righe esterne contando ogni blocco visivo come una riga separata, mentre il CSS grid li affianca sullo stesso asse. La nuova logica simula il piazzamento automatico del grid (span dei blocchi sulle colonne disponibili) per calcolare correttamente le righe occupate. Aggiunto `minHeight: scaledH` al div contenuto della pagina in modo che lo spazio venga distribuito uniformemente anche con pochi gruppi.

## [2.13.017] - 2026-05-04

### Corretto
- **Menabò Canvas — Overflow contenuto** (`src/pages/MenaboPromo/MenaboCanvas.tsx`): il contenuto di una pagina non si comprime più quando ci sono molti gruppi. La pagina ora usa `minHeight` invece di `height` fissa, il div del contenuto è in flow normale (`position: relative`) così la pagina cresce verticalmente per contenere tutti gli elementi senza schiacciare le celle. Il minimo per l'altezza di ogni slot record è stato alzato da 62pt a 80pt per garantire leggibilità.

## [2.13.016] - 2026-05-04

### Corretto
- **Menabò Canvas — Layout pagine pari** (`src/pages/MenaboPromo/MenaboCanvas.tsx`): l'ultima pagina con numero pari termina ora correttamente a sinistra (verso) con un placeholder invisibile a destra, completando il layout libro. In precedenza l'ultima pagina pari appariva sola senza il placeholder.

## [2.13.015] - 2026-05-04

### Modificato
- **Menabò Canvas — Layout pagine** (`src/pages/MenaboPromo/MenaboCanvas.tsx`): la prima pagina è ora posizionata a destra (recto) con un placeholder invisibile sulla sinistra, replicando il layout tipico di un menabò/libro. Tutte le righe sono sempre visualizzate come spread orizzontale (`flex-row` fisso, rimosso il breakpoint `2xl:flex-row` responsivo) per permettere navigazione libera con scroll e zoom.

## [2.13.014] - 2026-05-04

### Corretto
- **Menabò — Fullscreen portal** (`src/pages/MenaboPromo/index.tsx`): l'overlay schermo intero viene ora iniettato tramite `createPortal` direttamente in `document.body`, eliminando il problema dello stacking context dei nodi padre che impediva all'overlay di coprire correttamente il resto dell'interfaccia.

## [2.13.013] - 2026-05-04

### Aggiunto
- **Menabò Canvas — Schermo intero** (`src/pages/MenaboPromo/MenaboCanvas.tsx`, `src/pages/MenaboPromo/index.tsx`): aggiunto pulsante Maximize2/Minimize2 nella toolbar per attivare la modalità schermo intero. In fullscreen l'intera interfaccia (pannello laterale + canvas) occupa il viewport tramite overlay `fixed inset-0 z-[9999]`; il pannello laterale (w-72) è collassabile tramite icona `PanelLeftClose`/`PanelLeftOpen` e consente di trascinare i gruppi nel canvas. Il tasto `Esc` esce dalla modalità fullscreen invece di deselezionare l'elemento corrente.

### Modificato
- **Menabò Canvas — Spazio canvas** (`src/pages/MenaboPromo/index.tsx`): la colonna del canvas è passata da `xl:col-span-9` a `xl:col-span-10` e la sidebar da `xl:col-span-3` a `xl:col-span-2`, dando più spazio di lavoro al menabò in modalità normale.
- **Menabò Canvas — Altezza canvas** (`src/pages/MenaboPromo/MenaboCanvas.tsx`): altezza del canvas in modalità normale portata da `calc(100vh - 200px)` a `calc(100vh - 160px)` per sfruttare più spazio verticale.

## [2.13.012] - 2026-04-30

### Aggiunto
- **Menabò Canvas** (`src/pages/MenaboPromo/MenaboCanvas.tsx`): pulsante × sull'header di ogni gruppo per rimuovere l'intero gruppo dal canvas (con notifica alla sidebar). Pulsante × in alto a destra su ogni singola cella referenza per rimuovere solo quella referenza; se il gruppo rimane vuoto viene rimosso automaticamente e la sidebar viene notificata.

## [2.13.011] - 2026-04-30

### Modificato
- **Menabò Canvas** (`src/pages/MenaboPromo/MenaboCanvas.tsx`): la paginazione usa ora un cursore `(curPage, curUsed)` che permette a più gruppi di condividere la stessa pagina finché non è piena. Se si piazza un gruppo su una pagina con 5 referenze, le nuove si aggiungono alle rimanenti 5 slot. L'overflow va sempre avanti: se la pagina di drop è già superata dal cursore, il gruppo parte dal cursore; se è più avanti, si salta a quella pagina lasciando vuote le intermedie. Stesso algoritmo replicato in `requiredPages` per il calcolo del numero pagine effettivo.

## [2.13.010] - 2026-04-30

### Modificato
- **Menabò Canvas** (`src/pages/MenaboPromo/MenaboCanvas.tsx`): il `pageIndex` del drop è ora la pagina di partenza reale di ogni gruppo (non più `0` fisso). La paginazione ordina i gruppi per `pageIndex` e garantisce che i record in overflow vadano sempre avanti (mai indietro): se la pagina di drop è già occupata dall'overflow di un gruppo precedente, il gruppo viene scalato alla prima pagina libera successiva. `requiredPages` è ora un `useMemo` che simula questo stesso algoritmo per calcolare il conteggio pagine effettivo.

## [2.13.009] - 2026-04-30

### Modificato
- **Menabò Canvas** (`src/pages/MenaboPromo/MenaboCanvas.tsx`): ogni pagina contiene ora record di un solo gruppo. Le referenze in overflow non occupano mai lo spazio rimasto su pagine di altri gruppi: quando un gruppo termina, la pagina rimane dedicata ad esso (riempita visivamente) e il gruppo successivo parte sempre da una pagina nuova. `requiredPages` ora somma `ceil(records/max)` per ogni gruppo invece di usare il totale globale.

## [2.13.008] - 2026-04-30

### Modificato
- **Menabò Canvas** (`src/pages/MenaboPromo/MenaboCanvas.tsx`): il massimo di referenze per pagina è ora una costante esplicita `MAX_CELLS_PER_PAGE = 10` (regola di business) invece di un valore calcolato dinamicamente dalle dimensioni delle celle. Rimosso calcolo di `maxRowsPerPage`; il numero di colonne è ancora calcolato in base alla larghezza disponibile. Le pagine in eccesso vengono create automaticamente tramite `effectivePageCount`.

## [2.13.007] - 2026-04-30

### Modificato
- **Menabò Canvas** (`src/pages/MenaboPromo/MenaboCanvas.tsx`): il blocco di ogni gruppo ora riempie visivamente l'intera pagina. Il card del gruppo usa `flex: records.length` (spazio proporzionale al numero di record per pagine con più gruppi) e `display: flex / flex-direction: column`; la griglia interna usa `flex: 1` con `gridTemplateRows: repeat(N, 1fr)` così le righe si espandono per coprire tutto lo spazio disponibile. Le celle non hanno più dimensioni minime fisse: crescono con il grid.

## [2.13.006] - 2026-04-30

### Corretto
- **Menabò Canvas** (`src/pages/MenaboPromo/MenaboCanvas.tsx`): introdotto `effectivePageCount` che auto-espande le pagine renderizzate quando il contenuto totale supera `pageCount × maxCellsPerPage`. Il numero di pagine manuale resta il minimo gestito dall'utente con i controlli +/−; se i record richiedono più pagine, vengono aggiunte automaticamente fino a coprire tutto il contenuto.

## [2.13.005] - 2026-04-30

### Corretto
- **Menabò Canvas** (`src/pages/MenaboPromo/MenaboCanvas.tsx`): corretto il calcolo di `maxCellsPerPage` che non teneva conto dei gap tra celle (16pt) né dell'overhead verticale del gruppo (bordo, padding, intestazione). Il limite corretto è ora 40 celle/pagina (4 col × 10 righe) invece di 52, garantendo che il contenuto non trabocchi visivamente dalla pagina. I record in eccesso vengono impaginati automaticamente nelle pagine successive. Aggiunto `overflow: hidden` al contenitore pagina come salvaguardia.

## [2.13.004] - 2026-04-30

### Modificato
- **Menabò Canvas** (`src/pages/MenaboPromo/MenaboCanvas.tsx`): la logica di paginazione ora riempie ogni pagina con il massimo di elementi totali consentiti, prendendo i record dei gruppi in ordine. Se un gruppo ha più elementi di quelli che possono stare in una pagina, solo una parte viene visualizzata; gli altri restano fuori e non vengono mostrati.


## [2.13.003] - 2026-04-30

### Modificato
- **Menabò Canvas** (`src/pages/MenaboPromo/MenaboCanvas.tsx`): ora i contenuti vengono disposti automaticamente in una griglia all'interno della pagina, calcolando dinamicamente il numero massimo di celle (prodotti) per pagina in base a dimensioni, margini e zoom. I record non escono più dai margini e la suddivisione tra pagine è automatica e responsiva.

## [2.13.002] - 2026-04-30

### Aggiunto
- **Menabò Canvas** (`src/pages/MenaboPromo/MenaboCanvas.tsx`): nuovo componente canvas InDesign-like per la composizione visiva del menabò. Include area di lavoro a sfondo scuro con pagine A4 (595×842pt), griglia SVG a due livelli (minor 10pt / major 50pt), guide margini blu tratteggiati con segni di registro agli angoli, toolbar macOS-style con controlli zoom (30–200%), gestione pagine multiple e toggle griglia. Gli elementi posizionati sono card colorate con band header (colore univoco per gruppo, conteggio prodotti, etichetta) e body con i campi del primo record; selezionabili con click (ring colorato + handle agli angoli), spostabili con drag-and-drop cross-page, eliminabili con tasto Canc/Backspace o toolbar.
- **Sidebar draggable** (`src/pages/MenaboPromo/index.tsx`): i gruppi nella sidebar mostrano ora un pallino colorato corrispondente al blocco canvas, un'icona grip visibile al hover e supportano `draggable` con ghost personalizzato colorato. Il protocollo di comunicazione sidebar→canvas avviene tramite `dataTransfer` (`application/x-menabo-sidebar`) senza stato condiviso.

## [2.13.001] - 2026-04-29

### Aggiunto
- **Query Engine Scoreboard** (`lib/types.ts`): aggiunti i tipi condivisi `TracciatoQueryRequest`, `PromoFilterQuery`, `MomentoSelectorQuery`, `AggregazioneQuery`, `TracciatoQueryResult`, `TracciatoQueryPromoResult` per modellare query di analisi strutturate.
- **`calcolaQueryScoreboard`** (`TracciatoService.ts`, `ITracciatoService.ts`): nuovo metodo backend che accetta una `TracciatoQueryRequest` e gestisce 4 filtri promo (`all`, `by_ids`, `date_range`, `name_pattern`), 4 selettori momento (`all_confronti`, `first_per_promo`, `last_per_promo`, `index_per_promo`), 3 modalità di aggregazione (`merged`, `per_promo`, `trend`) e filtri opzionali su reparto, canale e area applicati in post-processing sul report.
- **`POST /api/tracciati/scoreboard/query`** (`TracciatoController.ts`): endpoint che espone il nuovo query engine.
- **`useCalcolaQueryScoreboard`** (`src/query/query.tsx`): hook React Query per la mutation del nuovo endpoint.
- **Query Builder UI** (`src/pages/ReportTracciati/index.tsx`): pagina completamente riscritta. Include 4 preset rapidi (Primi momenti, Trend annuale, Ultimi momenti, Analisi libera), 4 sezioni configurabili (Promo, Momenti, Filtri, Risultati), tag-input per il filtro reparto, riepilogo query in linguaggio naturale e anteprima del conteggio promo matchate.
- **Multi-report view** (`src/pages/RisultatoConfrontoTracciati/index.tsx`): nuovo componente `MultiReportView` per visualizzare i risultati di query `per_promo` e `trend` con selettore a pill per navigare tra i report individuali.

## [2.12.002] - 2026-04-29

### Modificato
- **`ReportTracciati/index.tsx`**: allineamento allo stile di progetto. I contenitori della pagina ora usano `box box--stacked` al posto di classi custom (`rounded-[0.8rem] border border-slate-200/70 bg-white`). Il layout a due colonne è migrato da `xl:grid-cols-[minmax(0,1fr)_320px]` al sistema a 12 colonne (`col-span-12 xl:col-span-8` + `col-span-12 xl:col-span-4`). Il wrapper `<div className="mt-8">` è stato sostituito con un fragment `<>` coerente con il pattern del progetto.

## [2.12.001] - 2026-04-29

### Aggiunto
- **Scoreboard Multi-Promo** (`ReportTracciati/index.tsx`, `TracciatoService.ts`, `TracciatoController.ts`): la pagina "Report Tracciati" è stata completamente ridisegnata. Il vecchio wizard a 3 step è stato sostituito con un'interfaccia scoreboard che permette di selezionare più promo in contemporanea e calcolare uno scoreboard aggregato in due modalità: "Scoreboard Completo" (tutti i momenti confronto di ogni promo) e "Confronto Specifico" (filtraggio per uno slot di coppia momenti specifico, es. M1→M2, trasversale a tutte le promo selezionate).
- **`calcolaMultiPromoScoreboard`** (`TracciatoService.ts`, `ITracciatoService.ts`): nuovo metodo di servizio che aggrega i confronti di più promo e li processa tramite la pipeline di scoring esistente (`_buildMatricePromo`, `normalizzaDatoConfrontoPerScore`, `calcolaTerremotoPerMatriceDiValori`, `buildScoreboardReport`) senza duplicare alcuna logica.
- **`POST /api/tracciati/scoreboard/multi-promo`** (`TracciatoController.ts`): nuovo endpoint che accetta `{ promoIds, confrontoFilter? }` e restituisce un `TracciatoReport` calcolato al volo, senza persistenza.
- **`useCalcolaMultiPromoScoreboard`** e **`useFetchMomentiPerPromo`** (`query.tsx`): nuovi hook React Query per la mutation di calcolo e il caricamento parallelo dei momenti delle promo selezionate.

## [2.11.147] - 2026-04-28

### Corretto
- **`TracciatoService.buildRows`** (`TracciatoService.ts`): il contatore `modificati` non veniva ponderato per `pesoEvento` (dimensione del gruppo) a differenza di `uscenti`, `entranti` e `inalterati`. Un gruppo da N referenze modificato in un confronto contribuiva con `1` invece di `N`. Aggiunto campo `modificati: number` in `CodiceAcc`; il valore viene ora accumulato con `+= pesoEvento` e propagato correttamente sia a livello di codice sia di reparto.

## [2.11.146] - 2026-04-28

### Corretto
- **`CoopfiAgenziaLib.calcolaIntensitaTerremoto`** (`coopfi/index.ts`): la funzione ora restituisce sempre un valore nel range `[0, 100]` tramite `Math.min(100, raw)` come unico punto di uscita. Ristrutturata la logica da multi-return a variabile `raw` + clamp finale; corretto anche l'ordine dei branch (la condizione `isUltimoConfronto && isSituazioneAParte` veniva oscurata da `isUltimoConfronto` da sola e non era mai raggiunta).

## [2.11.145] - 2026-04-28

### Modificato
- **`ScoreboardAuditPanel`** (`RisultatoConfrontoTracciati/index.tsx`): redesign completo dell'audit panel — aggiunta summary bar in cima con conteggi per severity, rimosso il doppio accordion annidato (reparto → "Messaggi audit"), gli item vengono ora renderizzati direttamente all'interno del collassabile per reparto. Reparto header mostra icona della severity peggiore + `SeverityDots` inline (puntini colorati con conteggi per tipo).
- **`ScoreAuditItem`**: design aggiornato — background bianco con stripe sinistra colorata (`border-l-[3px]`) al posto del background pieno, layout item più leggibile con `ring-1 ring-slate-100`. Aggiunto nuovo componente `SeverityDots`.
- **`AUDIT_TYPE_TONE`**: aggiunti campi `stripe`, `dot`, `pillActive` per supportare il nuovo design; colore `info` reso leggermente meno saturo.
- **Bottone Audit in `ScoreboardWidget`**: il bottone riflette ora la severity peggiore effettiva tra tutti gli audit (critico → rosso, attenzione → arancione, avviso → ambra, info → blu) anziché sempre ambra fisso. Quando chiuso usa stile neutro; il colore appare all'apertura.

## [2.11.144] - 2026-04-28

### Modificato
- **`CoopfiAgenziaLib.calcolaIntensitaTerremoto`** (`coopfi/index.ts`): aggiunta regola — se il terremoto cade sull'ultimo confronto della storia della referenza (`cella.confrontoIndex === storia[storia.length-1].confrontoIndex`), l'intensità è forzata a 100 indipendentemente dallo stato. Rimossa logica commentata obsoleta.

## [2.11.143] - 2026-04-28

### Modificato
- **`IAgenziaLib.calcolaIntensitaTerremoto`** (`agenzia_lib/types.ts`): firma aggiornata — aggiunto parametro `storia: CellaConfronto[]` (array ordinato di tutte le celle della referenza). Permette di scrivere logica di intensità basata sulla sequenza completa degli stati (es. `entrata → uscita → entrata → 0`).
- **`CoopfiAgenziaLib.calcolaIntensitaTerremoto`** (`coopfi/index.ts`): firma allineata all'interfaccia; call-site in `calcolaTerremotoPerMatriceDiValori` aggiornato a passare `storia`.
- **`DefaultAgenziaLib.calcolaIntensitaTerremoto`** (`default/index.ts`): firma stub aggiornata (`_storia` ignorato).

## [2.11.142] - 2026-04-28

### Corretto
- **`TracciatoService.mergeStorieForInners`** (`TracciatoService.ts`): deduplicazione dei `confrontoIndex` duplicati nella storia dei campi — quando più innerCode modificano lo stesso campo allo stesso indice di confronto, le variazioni precedenti al sort venivano accumulate producendo duplicati. Aggiunto filtro dopo il sort per mantenere solo la prima variazione per ogni `confrontoIndex`.

## [2.11.141] - 2026-04-28

### Corretto
- **`CoopfiAgenziaLib.computeContributo`** (`coopfi/index.ts`): rimosso `require()` inline (non disponibile in ESM) — le regole `coopfi-score-rules.json` sono ora caricate una sola volta a livello di modulo tramite `createRequire(import.meta.url)` e riutilizzate ad ogni chiamata. Risolto `ReferenceError: require is not defined` in produzione.
- **Tipizzazione `computeContributo`**: `group` tipizzato come `AzioniRule`, `modGroup`/`modDefault` come `Partial<ModificaRule>` / `Required<ModificaRule>` — rimossi i fallback `|| {}` che causavano errori di tipo sulle proprietà `uscita`, `entrata`, `peso`, `campi`, `combinazioni`.

## [2.11.140] - 2026-04-28

### Corretto
- **`CoopfiAgenziaLib.computeContributo`** (`coopfi/index.ts`): bug critico — `uscita` e `entrata` ritornavano `hasTerremoto: false` tramite `return` anticipati, impedendo sia l'avvio della cascata forward sia il rilevamento retroattivo in `calcolaTerremotoPerMatriceDiValori`. Ristrutturato il metodo: `contributoRaw` viene calcolato per tutti i tipi prima di applicare cascata extra e decidere `hasTerremoto`. `uscita`/`entrata` ora settano sempre `hasTerremoto: true`; `modifica` lo setta se `contributoRaw > 0`.
- **`computeContributo` — cascata extra**: il blocco cascata era posizionato dopo i `return` di `uscita`/`entrata` e quindi non si applicava mai a quei tipi. Ora la cascata extra (quando `prevEvent` è presente) viene sommata al `contributoRaw` per tutti e tre i tipi di evento.

## [2.11.139] - 2026-04-28

### Aggiunto
- **`TracciatiSchemaItem`** (`lib/types.ts`): aggiunto campo `terremotoDegradoMassimo?: number | null` per definire il degrado massimo retroattivo direttamente nel template schema; quando lo schema viene applicato, il valore viene propagato automaticamente al momento creato.
- **`TracciatiMomentoAttributes` / `TracciatiMomentoResponseDTO`** (`lib/types.ts`): esposto `terremoto_degrado_massimo` nel DTO; il valore è ora restituito da tutti gli endpoint che producono `TracciatiMomentoResponseDTO`.
- **`NuovoSchemaForm`** (`GestioneSchemi.tsx`): aggiunto input numerico opzionale "Degrado terremoto %" per ogni momento dello schema (badge arancione con icona ⚡ se impostato); il valore è visibile sia nella card di preview che nelle righe del form.
- **`MomentoCard`** (`GestioneMomenti.tsx`): aggiunta sezione "Terremoto — degrado max (%)" in fondo alla card con input numerico (0-100); la modifica viene salvata automaticamente al blur/Enter tramite la mutation di update esistente.

### Modificato
- **`TracciatoService.updateMomento`** / **`TracciatoController.updateMomento`**: `terremoto_degrado_massimo` è ora accettato nel body `PUT /tracciati/momenti/:id`.
- **`TracciatoService.applicaSchema`**: il campo `terremotoDegradoMassimo` dallo schema item viene ora propagato al momento creato.
- **`TracciatoService.mapMomentoToDTO`**: `terremoto_degrado_massimo` è ora incluso nel DTO mappato.
- **`TracciatoService.calcolaPromoScoreboard`**: rimosso cast `(m as any)` grazie al typing corretto del modello.

## [2.11.138] - 2026-04-28

### Aggiunto
- **`TracciatiMomento`** (`server/core/models/tracciati_momento.ts`): aggiunta colonna `terremoto_degrado_massimo` (FLOAT, nullable) per configurare per ogni momento il degrado massimo retroattivo applicabile ai confronti precedenti.
- **`calcolaIntensitaTerremoto`** (`IAgenziaLib`, `CoopfiAgenziaLib`, `DefaultAgenziaLib`): nuovo metodo che calcola l'intensità del terremoto [0-100] per una cella, basandosi su stato (`uscita`=80, `entrata`=40, `modifica` proporzionale a campi variati e oscillazioni). Lo stub `Default` restituisce 0.
- **`calcolaTerremotoPerMatriceDiValori`** (`CoopfiAgenziaLib`): implementazione completa della funzione retroattiva. Organizza la matrice per referenza (`scattoCodice::canaleArea`), individua le celle con `hasTerremoto=true`, e applica un degrado aggiuntivo (`intensità/100 × terremotoDegradoMassimo`) a tutti i confronti precedenti della stessa referenza.

### Modificato
- **`RigaConfronto`** / **`PromoScoreboardInput`** (`agenzia_lib/types.ts`): aggiunti campi `terremotoDegradoMassimo?: number` per propagare il valore DB dalla scoreboard all'interno della matrice.
- **`TracciatoService.calcolaPromoScoreboard`**: il `terremoto_degrado_massimo` del momento secondario viene ora propagato a ogni item di `PromoScoreboardInput` e poi alla `RigaConfronto` corrispondente.
- **`TracciatoService.calcolaPromoScoreboard`**: la matrice viene ora post-processata con `calcolaTerremotoPerMatriceDiValori` prima di essere passata a `buildScoreboardReport`.

## [2.11.137] - 2026-04-27

### Modificato
- **`CoopfiAgenziaLib.computeContributo`**: ora le regole di calcolo contributo (pesi, combinazioni, override per reparto) sono lette da `server/core/agenzia_lib/coopfi/utility/data/coopfi-score-rules.json` in modo sincrono. Rimossi i valori hardcoded dal codice; la funzione è ora completamente configurabile da file JSON.

## [2.11.136] - 2026-04-27

### Modificato
- **`ScoreboardAuditPanel`** (`RisultatoConfrontoTracciati/index.tsx`): le sezioni reparto nel pannello audit sono ora collassabili. Ogni intestazione reparto è diventata un button con chevron Up/Down; il contenuto si anima con `AnimatePresence`/`motion.div`. Lo stato `closedReparti` (Set) traccia i reparti chiusi — di default tutti sono aperti.

## [2.11.135] - 2026-04-27

### Modificato
- **`ScoreboardConfig.onCampoModificato`** (`agenzia_lib/types.ts`): aggiunto 5° parametro `confrontoIndex?: number` per permettere al callback di emettere audit contestuali all'indice di confronto corrente.
- **`CalcolaContributoDegradoScoreboardParams.onCampoModificato`** / **`_elaborateScoreboardMaps`** (`TracciatoService.ts`): firma aggiornata con `confrontoIndex`; il callback riceve ora `auditContext?.confrontoIndex` alla chiamata.
- **`onCampoModificato` CoopFi** (`agenzia_lib/coopfi/index.ts`): spostata la logica di rilevamento "ritorno al valore" dal core engine al callback CoopFi. Quando un campo modificato ritorna al valore originale (`storia[0].valoreA === storia[last].valoreB`) all'ultimo confronto in cui è cambiato, viene emesso un audit `danger` con messaggio `[Ritorno al valore] {codice} — {campo}: tornato a {valore}`.

## [2.11.134] - 2026-04-27

### Modificato
- **`ScoreboardConfig.onCampoModificato`** (`agenzia_lib/types.ts`): il parametro `storiaReferenza` è ora opzionale; il return type è cambiato da `void` a `{ extraContributo?: number } | void` per predisporre la possibilità di influenzare il punteggio in futuro.
- **`CalcolaContributoDegradoScoreboardParams`** (`TracciatoService.ts`): aggiunto campo `onCampoModificato` con la stessa firma aggiornata. Il callback viene ora chiamato internamente a `calcolaContributoDegradoScoreboard` quando `tipoEvento === 'modifica'`, tramite `void` (return value ignorato). Il `extraContributo` non è ancora applicato al punteggio (TODO esplicito nel codice).
- **`applyEvent`** (`TracciatoService._elaborateScoreboardMaps`): rimossa la chiamata diretta a `onCampoModificato`; il callback è ora propagato come parametro di `calcolaContributoDegradoScoreboard`.

## [2.11.133] - 2026-04-27

### Aggiunto
- **`TracciatoService.calcolaContributoDegradoScoreboard`**: rilevamento del "ritorno al valore" — quando un campo viene modificato più volte nel corso dei confronti e alla fine torna al valore originale (`storia[0].valoreA === storia[last].valoreB`), viene emesso un audit `danger` con messaggio `[Ritorno al valore] {codice} — {campo}: tornato a {valore}`. L'audit viene emesso una sola volta all'ultimo confronto in cui il campo è cambiato per evitare duplicati.

## [2.11.132] - 2026-04-27

### Modificato
- **`TracciatoService._elaborateScoreboardMaps`**: il nome del reparto nello scoreboard ora viene letto da `reparto_business` (campo impostato dal normalizzatore CoopFi via `resolveRepartoCoopfi`), con fallback a `reparto` per compatibilità con altre implementazioni `IAgenziaLib`.

## [2.11.131] - 2026-04-27

### Corretto
- **`TracciatoService.buildRows`**: gli audit dei singoli codici non venivano mai aggregati nel campo `audit` del reparto → `row.audit` era sempre `[]`, rendendo il contatore del pannello audit sempre 0. Aggiunto `agg.audit.push(...acc.audit)` dopo ogni `codiceRow` aggiunto.
- **`TracciatoService.calcolaContributoDegradoScoreboard`**: i messaggi audit erano tutti identici (`"Calcolato contributo degrado evento"`), collassando a 1 solo item dopo la deduplicazione. Sostituito con messaggi distinti per tipo: `[Uscita] {codice}` (warn), `[Entrata] {codice}` (info), `[Modifica] {codice} — {campi}` (warn), `[Terremoto] {codice} — prev: {evento}` (danger).
- **`TracciatoService.calcolaDegradoReferenza`**: bug preesistente — il `case 'modifica'` calcolava `pesoFinale` ma non lo ritornava, lasciando la funzione restituire `undefined` implicitamente per tutte le modifiche. Corretto con `return` diretto nel branch e rimossa la variabile non letta.

## [2.11.130] - 2026-04-27

### Aggiunto
- **Pannello audit per area/canale/reparto nello Scoreboard** (`src/pages/RisultatoConfrontoTracciati/index.tsx`): il widget `ScoreboardWidget` ora include un pannello espandibile "Audit" (toggle nella header con badge numerico) che mostra tutti i messaggi `TracciatoWidgetScoreAudit` raggruppati per reparto, con filtro per tipo (Info / Avviso / Attenzione / Critico) e deduplicazione. I messaggi dei singoli codici sono mostrati con il codice referenza come fonte. Il pannello è contestuale alla vista canale/area selezionata grazie all'architettura `viewsPerCanaleArea` già esistente.
- **`ScoreAuditItem`**: nuovo componente che renderizza ogni messaggio audit con icona, colore e label di tipo corretti (blu=info, ambra=warn, arancio=danger, rosso=critical).
- **`ScoreboardAuditPanel`**: nuovo componente con barra filtri per tipo e lista reparti scrollabile, raggruppamento per reparto con conteggio e deduplicazione per chiave `type|message|source`.
- **Audit inline per riga reparto migliorati**: rimosso il limite a 2 messaggi e il testo troncato; ogni audit è ora renderizzato tramite `ScoreAuditItem` con icona e tipo distinto. Gli audit inline si nascondono automaticamente quando il pannello principale è aperto.

## [2.11.129] - 2026-04-24

### Modificato
- **Engine di scoring → metodi statici di `TracciatoService`**: tutte le funzioni dell'engine (`buildRows`, `resolveGroupRules`, `calcolaContributoDegradoScoreboard`, `resolveGroupSizeFromScattoCodice`, `resolveGroupMembersFromScattoCodice`, `removeSinglesIncludedInGroups`, ecc.) sono ora `private static` o `public static` dentro la classe `TracciatoService`. `elaborateScoreboardMaps` diventa metodo pubblico di istanza che chiama internamente `this.agenziaLib.getScoreboardConfig()`.
- **`TracciatoScoreboardUtils.ts`** (nuovo): modulo utility puro con `resolveGroupMembersFromScattoCodice` e `removeSinglesIncludedInGroups` — esposto per `coopfi/index.ts` senza creare dipendenza circolare verso `TracciatoService`.
- **`coopfi/index.ts`**: rimosso import diretto di `TracciatoService`; usa ora `TracciatoScoreboardUtils.ts` per le due funzioni pure di cui ha bisogno, eliminando la dipendenza circolare `agenzia_lib → services → IAgenziaLib`.
- **Test scoreboard**: aggiornati `coopfi-scoreboard-groups.test.ts` e `coopfi-scoreboard-line-chart.test.ts` per usare `TracciatoService` come classe (metodi statici `TracciatoService.calcolaContributoDegradoScoreboard`, `TracciatoService.buildRows`, ecc.) e istanza del servizio con mock `IAgenziaLib`.

## [2.11.128] - 2026-04-24

### Modificato
- **Merge `TracciatoScoring` → `TracciatoService`**: tutte le funzioni e i tipi dell'engine di scoring (`elaborateScoreboardMaps`, `buildRows`, `calcolaContributoDegradoScoreboard`, `resolveGroupRules`, `removeSinglesIncludedInGroups`, ecc.) sono ora definiti direttamente in `server/core/services/TracciatoService.ts` come export a livello modulo, prima della classe. Il file `TracciatoScoring.ts` è stato eliminato. Import aggiornati in `coopfi/index.ts` e nei test dello scoreboard.

## [2.11.127] - 2026-04-24

### Aggiunto
- **`server/core/services/TracciatoScoring.ts`**: nuovo modulo a livello di servizio con tutte le funzioni core dello scoreboard (`elaborateScoreboardMaps`, `buildRows`, `calcolaContributoDegradoScoreboard`, `resolveGroupRules`, `removeSinglesIncludedInGroups`, ecc.). Queste funzioni non dipendono da logiche cliente e appartengono al layer servizio.
- **`getScoreboardConfig()` in `IAgenziaLib`**: nuovo metodo che restituisce `ScoreboardConfig | null` (regole di scoring, funzione di rilevamento campi modificati, callback opzionale `onCampoModificato`). Sostituisce `elaboraPromoScoreboard` per separare configurazione cliente da computazione core.
- **`buildScoreboardReport()` in `IAgenziaLib`**: nuovo metodo che riceve `ScoreboardComputedData` pre-calcolato da `TracciatoService` e costruisce i widget cliente-specifici. Tiene in `agenzia_lib` la logica di presentazione (scoreboard, line chart, viste canale/area).
- **Terremoto (`hasTerremoto`)**: `calcolaContributoDegradoScoreboard` applica ora il contributo terremoto quando la referenza aveva già avuto un evento nel confronto precedente (`prevEvent`). Il flag `hasTerremoto` viene propagato fino a `CodiceAcc` e `TracciatoWidgetScoreboardCodiceRow`.

### Modificato
- **`TracciatoService.calcolaPromoScoreboard()`**: ora orchestra direttamente il calcolo score (chiama `elaborateScoreboardMaps` × N+1 per globalMap + snapshot timeline, `buildRows`, costruisce `ScoreboardComputedData`) e delega solo la costruzione dei widget a `agenziaLib.buildScoreboardReport()`.
- **`CoopfiAgenziaLib`**: rimosso `elaboraPromoScoreboard()`; aggiunti `getScoreboardConfig()` (con `onCampoModificato` per la logica cambio prezzo) e `buildScoreboardReport()`.
- **`DefaultAgenziaLib`**: aggiunti `getScoreboardConfig()` (ritorna `null`) e `buildScoreboardReport()` (stub).
- **`coopfi-score-rules.ts`**: aggiornato import da `../../common/types` a `../../types`.

### Rimosso
- **`agenzia_lib/common/`**: eliminata la cartella (files `index.ts` e `types.ts`). Le funzioni core sono in `TracciatoScoring.ts`; i tipi condivisi sono in `agenzia_lib/types.ts`.

## [2.11.126] - 2026-04-24

### Modificato
- **Scoreboard — campi modificati accumulati su tutti i confronti**: `elaborateScoreboardMaps` ora accumula per ogni inner code (codice referenza) l'insieme di tutti i campi modificati attraverso tutti i confronti. Al momento del calcolo del contributo di degrado, `calcolaDegradoReferenza` riceve l'unione cumulativa dei campi invece dei soli campi del confronto corrente; questo consente alle regole di peso e alle combinazioni di valutare correttamente l'impatto complessivo della referenza. La `storiaCampi` per la visualizzazione storica rimane invariata (solo i campi del confronto corrente per ciascun momento).

## [2.11.125] - 2026-04-24

### Aggiunto
- **Storia dei campi modificati nello scoreboard (`storiaCampi`)**: il calcolo dello score ora traccia, per ogni codice referenza, l'intera cronologia delle variazioni campo per campo. Per ogni modifica rilevata viene registrato il valore prima (`valoreA`), il valore dopo (`valoreB`), l'indice del confronto (`confrontoIndex`) e le etichette dei momenti primario/secondario (`labelPrimario`, `labelSecondario`). Il dato è accessibile in `TracciatoWidgetScoreboardCodiceRow.storiaCampi` (`Record<string, TracciatoWidgetScoreboardCampoStoria[]>`). Implementato in `server/core/agenzia_lib/common/index.ts` (`elaborateScoreboardMaps`, `accumulateCounts`, `buildRows`) e propagato dal `getChangedFields` di `coopfi/index.ts` che ora restituisce `FieldChange[]` con i valori effettivi.
- **Raggruppamento di pesi per più campi modificati insieme (`combinazioni`)**: `calcolaDegradoReferenza` valuta ora l'array `combinazioni` già presente in `coopfi-score-rules.json`. Quando un gruppo di campi si modifica contemporaneamente (es. `prezzo_promo` + `prezzo_continuo`) viene applicato il peso combinato (`valore`) invece della semplice somma dei pesi individuali; le combinazioni vengono valutate in ordine di priorità decrescente. I campi non coperti da nessuna combinazione usano ancora i pesi individuali.

### Modificato
- **`resolveGroupRules`**: ora propaga anche `combinazioni` nel `modifica` risolto (merge default + override per reparto).
- **Tipi**: aggiunti `FieldChange`, `CampoStoria`, `CombinazionRule` in `common/types.ts`; `combinazioni?` in `ModificaRule`; `storiaCampi?` in `CodiceAcc`. In `lib/types.ts` aggiunto `TracciatoWidgetScoreboardCampoStoria` e campo `storiaCampi?` in `TracciatoWidgetScoreboardCodiceRow`.

## [2.11.124] - 2026-04-24

### Aggiunto
- **Reset risultato momento**: nuovo endpoint `DELETE /api/tracciati/momenti/:idMomento/risultato` (service, interface, controller) che azzera il campo `risultato` del momento senza eliminarlo. Sul frontend, nella `MomentoCard` compare il pulsante "Rimuovi risultato" con conferma inline quando il momento ha già un risultato.

## [2.11.123] - 2026-04-24

### Aggiunto
- **Analisi massiva in GestioneMomenti**: nuovo pulsante "Analisi massiva" nella toolbar che esegue in sequenza (1) l'analisi su tutti i momenti senza risultato e (2) la generazione dei report per tutti i confronti lineari (adiacenti) privi di report. L'utente può avviare l'operazione e aspettare in background.
- **Barra di avanzamento analisi massiva**: durante l'esecuzione massiva viene mostrata una progress bar con fase corrente ("Analisi momenti" / "Report confronti lineari"), contatore e percentuale.

### Modificato
- **GestioneMomenti — navigazione automatica rimossa**: dopo la generazione di un report di confronto, il componente non naviga più automaticamente alla pagina di report. Viene invece mostrata una notifica; il report si apre manualmente tramite il menu "Apri report" sul connettore.

## [2.11.122] - 2026-04-23

### Aggiunto
- **`percentualeIntegra` come concetto CORE dello scoreboard**: ogni record (codice) nello scoreboard espone ora `percentualeIntegra: number` (0-100) che rappresenta la percentuale di quanto è rimasto integro. Il punteggio del reparto (`score`) diventa la **media aritmetica semplice** delle `percentualeIntegra` di tutti i codici appartenenti al reparto — non più la media ponderata per numero di referenze. Stesso criterio applicato al `totalScore` globale del widget. Campo aggiunto a `TracciatoWidgetScoreboardCodiceRow` e `TracciatoWidgetScoreboardRow` in `lib/types.ts`; logica aggiornata in `server/core/agenzia_lib/common/index.ts` (`buildRows`) e `server/core/agenzia_lib/common/types.ts` (`RepartoAgg`); `buildWidget` in `server/core/agenzia_lib/coopfi/index.ts` allineato.

## [2.11.121] - 2026-04-23

### Modificato
- **Completamento struttura monorepo npm workspaces**: aggiunto workspace `src` (`fidelity-promotion-client`) con tutte le dipendenze del frontend React (UI libraries, mappe, grafici, state management, ecc.). Il root `package.json` è ora puramente coordinatore: contiene solo `scripts` e `devDependencies` (TypeScript, ESLint, Vite, Vitest, PostCSS, tool di build). I pacchetti usati su entrambi i lati (`axios`, `dayjs`, `xlsx`) sono dichiarati in entrambi i workspace e deduplicati da npm. `zod` spostato in `server/package.json` (usato solo dal backend per la validazione DTO). I tool di build (`concurrently`, `cross-env`, `rimraf`, `ts-node`, `tsconfig-paths`, `lightningcss`, `dotenv`, `@vitejs/plugin-legacy`, `babel-plugin-transform-react-remove-prop-types`) spostati da `dependencies` a `devDependencies` nel root.

## [2.11.120] - 2026-04-23

### Modificato
- **Struttura monorepo**: il `package.json` radice è stato suddiviso tramite npm workspaces. Il root ora dichiara `"workspaces": ["server"]` e contiene solo le dipendenze del client (React, Vite, UI libraries, ecc.) e gli strumenti di build condivisi. Le dipendenze del backend (Express, Sequelize, Mongoose, bcrypt, Pino, Socket.IO server, ecc.) sono state spostate nel nuovo `server/package.json`, che le dichiara come workspace separato. I `@types/*` specifici del server precedentemente in `dependencies` sono stati spostati in `devDependencies` di `server/package.json`. Nessun file sorgente o path di import è stato modificato; npm hoisting mantiene tutto in `node_modules` radice come prima.

## [2.11.119] - 2026-04-23

### Aggiunto
- **Sistema terremoto** in `agenzia_lib/common/index.ts`: quando una referenza ha un evento (uscita/entrata/modifica) in un confronto, il confronto successivo in cui compare riceve un fattore moltiplicativo sul contributo al degrado, definito in `scoreRules.terremoto` (base 100). Lo stato si propaga da qualsiasi momento — non solo dall'ultimo — e l'inalterata non azzera il terremoto precedente.
- Nuova funzione `elaborateScoreboardMaps` in `server/core/agenzia_lib/common/index.ts`: estrae il core loop dello scoreboard (loop confronti, accumulo per codiceKey, rimozione singoli nei gruppi, applicazione terremoto) rendendolo riutilizzabile da qualsiasi implementazione client.
- Campo `hasTerremoto?: boolean` su `TracciatoWidgetScoreboardRow` (`lib/types.ts`), `CodiceAcc` e `RepartoAgg` (`common/types.ts`): le righe scoreboard in cui è stato applicato il fattore terremoto vengono marcate.
- Sezione `terremoto` in `coopfi-score-rules.json` con valori base 100: `uscita: 150`, `entrata: 90`, `modifica: 120`.
- Campo `terremoto?: {uscita, entrata, modifica}` nell'interfaccia `AgenziaLibScoreRules`.

### Modificato
- `normalizzaDatoConfrontoPerScore` (`CoopfiAgenziaLib`): semplificato da ~30 righe a 6; normalizza direttamente tutti i tracciati per confronto senza il loop canale/area intermedio.
- `elaboraPromoScoreboard` (`CoopfiAgenziaLib`): il core loop (~150 righe) sostituito dalla chiamata a `elaborateScoreboardMaps`; rimangono solo la definizione di `getChangedFields` e la costruzione del widget/titolo.

### Corretto
- `buildRows`: rimosso il fattore `× 100` erroneo nel calcolo dello score (`100 - degradoPesato` invece di `100 - degradoPesato × 100`), che rendeva praticamente tutti gli score pari a 0 in presenza di qualsiasi evento.
- `calcolaDegradoReferenza` per il caso `modifica`: i pesi dei campi (`campi`) sono ora divisi per 100 prima di moltiplicare per `peso`, in accordo con la scala 0-100 del JSON e i test esistenti.

## [2.11.118] - 2026-04-22

### Modificato
- In `elaboraPromoScoreboard` (`CoopfiAgenziaLib`): sostituita la funzione `removeSinglesIncludedInGroups` con logica inline per la rimozione dei singoli inclusi nei gruppi, migliorando la leggibilità e la trasparenza del codice.

## [2.11.117] - 2026-04-22

### Modificato
- `GestioneMomenti`: il bottone "Analisi totale" ora distingue due stati:
  - **Scoreboard salvato presente** → bottone "Analisi totale" (naviga direttamente al report persistito) + icona `RefreshCw` per ricalcolare; non serve attendere il POST.
  - **Nessuno scoreboard salvato** → bottone "Calcola" come prima, comportamento POST invariato.
- `handlePromoScoreboard`: dopo il POST aggiorna la React Query cache `["promoScoreboard", idPromo]` con `setQueryData` così il bottone si aggiorna senza refetch.
- `RisultatoConfrontoTracciati`: quando `guidIdConfronto === "promo-scoreboard"` senza `location.state.report`, carica il report tramite `GET /tracciati/promo/:idPromo/scoreboard` invece di interrogare l'endpoint dei confronti (che non esiste per questa rotta).

### Aggiunto
- `apiGetPromoScoreboard` helper in `GestioneMomenti` per il `GET` dello scoreboard; restituisce `null` su 404.
- `scoreboardQuery` (`useQuery`, `staleTime: Infinity`) in `GestioneMomenti` per pre-caricare il report salvato al montaggio del componente.

## [2.11.116] - 2026-04-22

### Aggiunto
- Nuova tabella PostgreSQL `promo_scoreboard` (`id_promo PK`, `report JSONB`, `computedat DATE`) per la persistenza del `TracciatoReport` calcolato dallo scoreboard promo.
- `PromoScoreboard` model Sequelize in `server/core/models/promo_scoreboard.ts`; registrato nel map dei modelli e nell'export di `models/index.ts`.
- Metodo `getPromoScoreboard(idPromo)` in `TracciatoService` e `ITracciatoService`: legge il report salvato dalla tabella; restituisce `null` se non ancora calcolato.
- Route `GET /api/tracciati/promo/:idPromo/scoreboard`: serve il report persistito (404 se assente); la `POST` esistente ora salva il risultato su `promo_scoreboard` via `upsert` prima di restituirlo.

## [2.11.115] - 2026-04-22

### Corretto
- `removeSinglesIncludedInGroups` in `common/index.ts`: aggiunto parametro opzionale `externalGroupedCodes` per accettare un set pre-calcolato di codici di gruppo; quando fornito, sostituisce la costruzione locale basata solo sul bucket corrente.
- `elaboraPromoScoreboard` in `CoopfiAgenziaLib`: il set `globalGroupedCodes` viene ora costruito da tutti i record `primRecs + secRecs` della coppia canale/area prima del ciclo per bucket, e passato a `removeSinglesIncludedInGroups`; in questo modo i singoli vengono rimossi correttamente anche quando i membri del gruppo appartengono a bucket `codiceKey` diversi (es. referenze No Food con `codice_settore`/`codice_reparto` differenti ma stesso `Scatto.CodiceGruppo`).

## [2.11.114] - 2026-04-22

### Aggiunto
- `GroupedTableRow`: pulsante di copia codice aggiunto sia sul codice principale della referenza/gruppo che su ciascun sub-codice; visibile all'hover, non propaga il click all'accordion.

## [2.11.113] - 2026-04-22

### Aggiunto
- `PriceDiffWidget`: pulsante di copia del codice referenza/gruppo con feedback visivo (icona `Check` per 1,5 s); visibile solo all'hover della riga e non propaga il click all'accordion.

## [2.11.112] - 2026-04-22

### Modificato
- `PriceDiffWidget` in `RisultatoConfrontoTracciati`: wrapper cambiato da `box box--stacked` a `rounded-xl border border-slate-200 bg-white` per allineamento stilistico con `GroupedTableWidget`.
- `PriceDiffWidget`: il campo `codice` viene ora troncato a 20 caratteri con `…`; il valore completo resta visibile nel tooltip `title`.

## [2.11.111] - 2026-04-22

### Modificato
- `PreviewImmaginePdf`: sostituito `<img>` con `<object type="image/svg+xml">` per il rendering nativo degli SVG da URL (`data` al posto di `src`, `aria-label` al posto di `alt`, rimosso `object-contain` non applicabile).

## [2.11.110] - 2026-04-21

### Aggiunto
- **Normalizzatore factory per referenze ISTANTA CoopFi** (`coopfi-referenza.ts`): `createCoopfiNormalizer()` carica la config una sola volta e restituisce un normalizzatore sincrono `(record: AnalisiMomentoRecord) => DataFields`. Applica `TraduttoreReferenze.traduci_data_fields` con la mappa config+`COOPFI_TRACKED_FIELD_MAP` e imposta esplicitamente `codice_referenza`, `tipo`, `subCodici`, `reparto` e `codiceKey` su ogni record.

### Modificato
- `elaboraDatoPerAgenzia` e `elaboraPromoScoreboard` in `CoopfiAgenziaLib`: usano `await createCoopfiNormalizer()` una volta per metodo e applicano il normalizzatore in modo sincrono; rimossi i `Promise.all` interni ridondanti.
- `getChangedFields` in `elaboraPromoScoreboard`: firma cambiata da `CoopfiReferenzaNormalizzata` a `DataFields` per coerenza con il tipo restituito dal normalizzatore.
- `buildWidgets` in `CoopfiAgenziaLib`: tutti i confronti `r.codice !== '—'` corretti in `r.codice_referenza !== '—'` (il normalizzatore imposta `codice_referenza`, non `codice`).

## [2.11.109] - 2026-04-21

### Aggiunto
- **Widget `grouped_table` per referenze entranti/uscenti**: le referenze entranti e uscenti nel report CoopFi sono ora raggruppate per reparto (via `COOPFI_REPARTO_MAP`) con accordion a tre livelli: reparto → singola referenza (codice, tipo badge, prezzi, prestazione) → sub-codici per referenze di tipo gruppo (il campo `Scatto.CodiceGruppo` viene splittato per virgola).
- Nuovo tipo `TracciatoWidgetGroupedTable` (con `TracciatoWidgetGroupedTableGroup` e `TracciatoWidgetGroupedTableRow`) in `lib/types.ts`, aggiunto all'unione `TracciatoReportWidget`.
- Componente `GroupedTableWidget` in `RisultatoConfrontoTracciati`: accordion a tre livelli con stato espansione indipendente per gruppi reparto e per singoli gruppi di referenze.

### Modificato
- `buildWidgets` in `CoopfiAgenziaLib`: i due widget `type: 'table'` per entranti/uscenti sostituiti con `type: 'grouped_table'`; introdotta funzione `buildGroupedTable` che raggruppa i record per `resolveRepartoCoopfi` e `makeGroupedRow` che classifica le referenze singolo/gruppo e popola `subCodici`.

## [2.11.108] - 2026-04-21

### Aggiunto
- **Sistema di regole score CoopFi**: nuovo file `coopfi-score-rules.json` che definisce pesi differenziati per azione degradante (uscita/entrata/modifica) con granularità per campo e per reparto (`groupRules`). Utility `coopfi-score-rules.ts` con `resolveGroupRules` e `calcolaDegradoReferenza`.
- `TracciatoWidgetScoreboardCodiceRow` in `lib/types.ts`: tipo per lo score del singolo codice `settore-reparto`; campo `codici?` aggiunto a `TracciatoWidgetScoreboardRow` per supportare i dati dell'accordion.
- **Accordion nel widget scoreboard**: i reparti con più codici (es. "No Food") mostrano un chevron espandibile; all'apertura si visualizzano i codici individuali (`62-02`, `62-07`, ecc.) con barra score e chips statistiche.
- **Selettore canale/area nel report Analisi Totale**: quando la promo ha più combinazioni canale-area, il report ora popola `viewsPerCanaleArea` con una vista "Tutte le aree" (aggregato) e una vista per ogni combinazione specifica. Il `ViewSelector` già esistente consente di passare da una all'altra senza round-trip. `TracciatoService.calcolaPromoScoreboard` arricchisce i nomi canale/area da DB con lo stesso pattern dell'analisi singolo confronto.

### Modificato
- `elaboraPromoScoreboard` in `CoopfiAgenziaLib`: ora raggruppa per chiave `${codice_settore}-${codice_reparto}` tramite `resolveRepartoCoopfi`, calcola lo score pesato per codice con la formula `max(0, 100 - degradoPesato * 100)`, e aggrega per reparto con media pesata sul totale referenze. Sostituisce la formula piatta `inalterati / totale * 100`.

## [2.11.107] - 2026-04-20

### Aggiunto
- **Promo Scoreboard**: nuova funzione `elaboraPromoScoreboard` in `IAgenziaLib`, implementata in `CoopfiAgenziaLib` e `DefaultAgenziaLib`. Aggrega i dati di tutti i confronti con report già calcolati per la promo e produce uno score di stabilità per reparto (0–100): più referenze cambiate, entrano o escono → punteggio più basso.
- Nuovo tipo `TracciatoWidgetScoreboard` (con `TracciatoWidgetScoreboardRow`) in `lib/types.ts`, aggiunto all'unione `TracciatoReportWidget`.
- Endpoint `POST /api/tracciati/promo/:idPromo/scoreboard` in `TracciatoController` e metodo `calcolaPromoScoreboard` in `TracciatoService` e `ITracciatoService`.
- Metodo `findConfrontiWithReportByMomentoIds` in `TracciatiMomentoRepository` (recupera confronti con `report IS NOT NULL`).
- Bottone **"Scoreboard promo"** nella toolbar di `GestioneMomenti`, abilitato appena esiste almeno un confronto completato; naviga al report con il widget scoreboard.
- Componente `ScoreboardWidget` in `RisultatoConfrontoTracciati`: lista reparti con progress bar colorata (verde/giallo/arancio/rosso) e chips inalterati/modificati/entranti/uscenti.

### Corretto
- `DefaultAgenziaLib`: il widget `price_diff` ora usa la struttura `changes: TracciatoFieldChange[]` richiesta dal tipo `TracciatoWidgetPriceDiffRow`, correggendo un mismatch di tipo pre-esistente.

## [2.11.106] - 2026-04-20

### Aggiunto
- Colonna `tipo` (`lineare` | `non_lineare`) nella tabella `tracciati_momento_confronti` per distinguere i confronti tra momenti adiacenti da quelli non adiacenti.
- Nuovi confronti non adiacenti: pulsante "Collega non adiacente" su ogni card momento, con dropdown per selezionare il momento target. Il collegamento aggiorna automaticamente `confronti_ids` su entrambi i momenti.
- Script di migrazione `migrate:momenti-linear` (`server/core/scripts/migrateMomentiLinear.ts`): trasforma i confronti esistenti contrassegnando come `lineare` quelli tra momenti adiacenti, eliminando quelli non adiacenti e cancellando tutti i report salvati (`tracciati_report`).
- Nuovi script npm: `migrate:momenti-linear` e `migrate:momenti-linear:dry-run`.

### Modificato
- Vista GestioneMomenti unificata: i connettori lineari tra momenti adiacenti (`MomentoConnector`) e gli archi SVG per confronti non adiacenti sono ora mostrati simultaneamente nella stessa vista, eliminando la biforcazione esclusiva tra "modalità lineare" e "modalità grafo schema".
- `TracciatoService.createMomentoConfronto`: inferisce automaticamente `tipo` basandosi sulla distanza di `ordine` tra i momenti (diff=1 → `lineare`, altrimenti `non_lineare`).
- `isConnectorActive` semplificato: i connettori lineari sono attivi semplicemente quando entrambi i momenti hanno un risultato, senza esclusioni legate agli schemi.

## [2.11.105] - 2026-04-20

### Rimosso
- `buildWidgets` (CoopFi): rimossi i widget grafici `bar_chart`, `pie_chart` e `dual_pie_chart` dal report confronto tracciati.

### Aggiunto
- `buildWidgets` (CoopFi): aggiunte due nuove tabelle nel report — **Referenze Entranti** (presenti nel secondario ma assenti nel primario) e **Referenze Uscenti** (presenti nel primario ma assenti nel secondario). Entrambe sono sempre incluse nel report; se vuote il frontend mostra EmptyState. Le colonne mostrate sono: Codice, Reparto, Tipo Evento, Prestazione, Prezzo Continuo, Prezzo Promo, Testo Sconto.

### Modificato
- `buildWidgets` (CoopFi): il conteggio delle referenze **modificate** usa ora esclusivamente i campi di `TRACKED_FIELDS` (tipo_evento, peso, prestazione, format, txt_sconto, N_Punti, N_pezzi_soci, prezzo_continuo, prezzo_promo, prezzo_promo_kgl) anziché un confronto `JSON.stringify` dell'intero record — allineando il contatore alla stessa logica del widget variazioni `price_diff`.
- `buildWidgets` (CoopFi): `TRACKED_FIELDS` e `getFieldValue` spostati all'inizio della funzione (prima del calcolo di `repartoStats`) per essere riutilizzati sia nel conteggio che nella raccolta delle righe delle nuove tabelle.

## [2.11.104] - 2026-04-20

### Modificato
- PDF report confronto tracciati: il file esportato include ora la label del canale/area selezionato nel sottotitolo dell'intestazione (es. "Canale X — Area Y"), così il documento è auto-descrittivo senza dover guardare la UI.
- Nome del file PDF scaricato include ora lo slug del canale/area selezionato (es. `report-tracciati-canale-x-area-y-2026-04-20.pdf`).
- `IAgenziaLib.improveTracciatiComparison` rinominato in `elaboraDatoPerAgenzia` — il report vero e proprio sarà gestito separatamente; aggiornate le implementazioni CoopFi, Default e il call site in `TracciatoService`.
- `buildWidgets` (CoopFi): il raggruppamento per reparto usa ora il campo `reparto` direttamente dai record anziché `resolveRepartoCoopfi`; tutti i widget (bar chart, pie chart, tabella, price diff, referenze split table) sono ora suddivisi per il valore effettivo del campo `reparto` presente nel dato.

## [2.11.103] - 2026-04-17

### Aggiunto
- Pulsante confronto momenti: quando un confronto è già stato completato, il cerchio verde è ora cliccabile e apre un menu con le opzioni **Apri report**, **Rifai confronto** e **Rimuovi report**. Il menu è disponibile sia nella vista lineare che nella vista a grafo (schema mode).
- Nuovo endpoint `DELETE /api/tracciati/momenti/confronti/:idConfronto/risultato` per azzerare il risultato di un confronto già calcolato senza eliminare il record.
- `TracciatiMomentoResponseDTO` ora include il campo `confronti_con_id` (array `{ momentoId, confrontoId }`), che permette al frontend di risalire all'ID del confronto da gestire senza query aggiuntive.
- Sezione **Schemi di Momenti** aggiunta nella pagina Impostazioni di Produzione, con CRUD completo degli schemi (crea, elimina, lista). Gli schemi sono ora accessibili come configurazione universale, slegata da una specifica promozione.

### Modificato
- Rimossa la sezione collassabile "Schemi di momenti" dalla pagina di dettaglio lavorazione — la gestione degli schemi avviene in Impostazioni di Produzione. Il dropdown "Applica schema" rimane nella pagina lavorazione come azione promo-specifica.
- `findConfrontiByMomentoIds` (repository): aggiunto `id` agli attributi restituiti (prima si recuperavano solo `primario` e `secondario`).

## [2.11.102] - 2026-04-17

### Modificato
- Report confronto tracciati: rimossa la vista globale "Totale" — l'analisi è ora sempre suddivisa per canale/area (non ha senso aggregare canali/aree diverse). `improveTracciatiComparison` non genera più un set globale di widget; `viewsPerCanaleArea` viene sempre popolato, anche per un solo canale/area.
- Il selettore di vista nella pagina `RisultatoConfrontoTracciati` non include più il pill "Totale"; viene mostrato solo se ci sono ≥ 2 viste canale/area. La selezione si inizializza automaticamente sulla prima vista disponibile.
- Il PDF esportato usa i widget della vista correntemente selezionata (non la vista globale).
- `TracciatoReport.widgets` rimane popolato con i widget della prima vista per retrocompatibilità con eventuali report salvati.

## [2.11.101] - 2026-04-17

### Aggiunto
- Nuovo tipo `TracciatoFieldChange` in `lib/types.ts`: rappresenta la variazione di un singolo campo tra primario e secondario, con `valoreA`, `valoreB`, `isNumeric`, `delta` e `deltaPercent`.

### Modificato
- Widget `price_diff` nel report confronto tracciati: ora rileva le variazioni su tutti i campi rilevanti (`tipo_evento`, `Descrizioni.Peso`, `prestazione`, `Format_PdvRif`, `format_1`, `format_2`, `txt_sconto`, `N_Punti`, `N_pezzi_soci`, `prezzo_continuo`, `prezzo_promo`, `prezzo_promo_kgl`), non solo su `prezzo_promo`.
- `TracciatoWidgetPriceDiffRow`: campo rinnovato; le colonne `prezzoA`/`prezzoB`/`delta`/`deltaPercent` sono sostituite dall'array `changes: TracciatoFieldChange[]`.
- Il widget `price_diff` è ora posizionato subito dopo il callout di riepilogo (terza posizione), anziché in coda alla lista widget.
- `PriceDiffWidget` nel frontend: ogni riga è espandibile per mostrare in dettaglio i campi modificati (prima → dopo + variazione%). Pulsante "Espandi tutto / Comprimi tutto".
- `PdfPriceDiff`: struttura tabella ridisegnata — una riga per variazione di campo con Codice/Reparto/Tipo visibili solo sulla prima riga del gruppo; il blocco intestazione+colonne è tenuto unito con `wrap={false}` per evitare separazione tra header e corpo.
- Corretta separazione tra pagine nel PDF (`PdfTable`, `PdfPriceDiff`): aggiunto `wrap={false}` dove mancante per evitare il taglio delle tabelle tra pagine.

## [2.11.100] - 2026-04-17

### Aggiunto
- Report confronto tracciati ora supporta viste per **canale/area**: il report finale include un set di widget per ogni combinazione guidCanale+guidArea oltre alla vista globale aggregata (`TracciatoReport.viewsPerCanaleArea`).
- Nuovo tipo `TracciatoReportCanaleAreaView` in `lib/types.ts` con i widget della singola vista e i nomi canale/area risolti dal DB.
- Componente `ViewSelector` nella pagina `RisultatoConfrontoTracciati`: pills "Totale" + uno per ogni canale/area, visibili solo se il report contiene più di una vista. La selezione aggiorna i widget visualizzati senza ricaricare la pagina.

### Modificato
- `CoopfiAgenziaLib.improveTracciatiComparison`: logica di widget estratta in metodo privato `buildWidgets` riutilizzabile; genera le viste per canale/area in aggiunta alla vista globale.
- `TracciatoService.calcolaRisultatoMomentoConfronto`: dopo la chiamata ad `agenziaLib`, risolve i nomi di canale e area dal DB (modelli `Canale`/`Area`) e arricchisce le viste con `nomeCanale`, `nomeArea` e `label`.

## [2.11.099] - 2026-04-17

### Aggiunto
- Aggiunto metodo `toTitleCase()` su `String.prototype` in `lib/extension.ts`: converte una stringa in Title Case (prima lettera di ogni parola maiuscola, resto minuscolo), es. `"ESTERNO DONNA" → "Esterno Donna"`.

### Corretto
- `coopfi-reparto-map.ts`: il fallback del nome reparto ora usa `toTitleCase()` invece di `toCamelCase()` per una formattazione leggibile.
- Corretta implementazione di `toCamelCase()` in `lib/extension.ts`: aggiunto `.toLowerCase()` iniziale per gestire correttamente stringhe in maiuscolo (es. `"ESTERNO DONNA"` ora produce `"esternoDonna"` invece di `"eSTERNODONNA"`).
- Rimosso `Object.prototype.mapValues/deepFreeze` da `lib/extension.ts` per evitare stack overflow causato dall'enumerazione di proprietà in Sequelize/Inversify; le due funzioni sono ora esportate come utility standalone.

## [2.11.098] - 2026-04-17

### Corretto
- Aggiunto import side-effect di `lib/extension.js` nell'entry point del server (`server/index.ts`) per registrare le estensioni globali dei prototype (String, Number, Array, ecc.) a runtime; in precedenza `toCamelCase()` e gli altri metodi risultavano `undefined` nonostante i tipi TypeScript fossero dichiarati.

## [2.11.097] - 2026-04-16

### Corretto
- Corretto il warning HeadlessUI/Transition: ora il nodo root del Popover.Panel è un elemento reale e il portal wrappa solo il contenuto, garantendo il passaggio corretto dei props di transizione e nessun errore/avviso in console.
## [2.11.096] - 2026-04-16

### Corretto
- Il Popover per la selezione tracciati ora viene renderizzato tramite portal su document.body, risolvendo definitivamente ogni problema di z-index e overflow sopra le card (`GestioneMomenti`, `Popover`).
## [2.11.095] - 2026-04-16

### Modificato
- Sostituito il dropdown custom per la selezione dei tracciati in `GestioneMomenti` con il componente Popover, migliorando accessibilità e leggibilità della lista.
# Changelog

Tutte le modifiche rilevanti a questo progetto saranno documentate in questo file.

Il formato segue le convenzioni di [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).


## [2.11.094] - 2026-04-16

### Corretto
- Migliorata la leggibilità dei nomi tracciati lunghi nella selezione e lista dei momenti: ora il testo va a capo e non viene più troncato, sia nella lista che nel menu di aggiunta tracciato (`GestioneMomenti.tsx`).

## [2.11.093] - 2026-04-16

### Aggiunto
- **`server/core/agenzia_lib/coopfi/utility/coopfi-reparto-map.ts`** — mappa `codice_settore-codice_reparto → nome reparto` secondo la codifica CoopFi (Macelleria, Gastronomia, Pescheria, Forneria, Surgelati, Freschi PLS, Drogheria 1/2, Liquidi, Chimica Igiene Casa e Cura Persona, Pet Food, No Food); funzione `resolveRepartoCoopfi()` che concatena i due codici con `-` e restituisce il nome leggibile, con fallback alla chiave grezza o al solo `codice_reparto`

### Modificato
- **`server/core/agenzia_lib/coopfi/index.ts`** — `getCodiceReparto` sostituita da `resolveRepartoCoopfi`: tutti i widget del report (bar chart reparti, dual pie, tabella, split table, price diff) mostrano ora il nome del reparto invece del codice grezzo

## [2.11.092] - 2026-04-16

### Aggiunto
- **`TracciatoReportPdfDocument.tsx`** — `PdfDualPieChart`: due donut affiancati (Prima/Dopo) con legenda condivisa che mostra conteggio e percentuale per ogni reparto in entrambi i momenti; `PdfPriceDiff`: tabella variazioni `prezzo_promo` con colore verde (ribasso) / rosso (rialzo) sul delta percentuale e badge Singolo/Gruppo; il widget `referenze_split_table` è escluso dal PDF per scelta di design

## [2.11.091] - 2026-04-16

### Aggiunto
- **`lib/types.ts`** — tre nuovi tipi widget per il report confronto tracciati: `TracciatoWidgetReferenzeSplitTable` (tabella referenze divisa Singoli/Gruppi), `TracciatoWidgetDualPieChart` (due torte affiancate prima/dopo), `TracciatoWidgetPriceDiff` (variazioni `prezzo_promo`); aggiornata la union `TracciatoReportWidget`
- **`server/core/agenzia_lib/coopfi/index.ts`** — aggiunti a `improveTracciatiComparison` tre nuovi widget: classificazione Singoli/Gruppi basata su `Scatto.CodiceGruppo` vs `Referenza.Codice`; dual pie chart con distribuzione referenze per reparto (primario vs secondario); tabella variazioni `prezzo_promo` con delta numerico e percentuale
- **`server/core/agenzia_lib/default/index.ts`** — stessa logica portata anche nell'implementazione default di `improveTracciatiComparison`
- **`src/pages/RisultatoConfrontoTracciati/index.tsx`** — tre nuovi widget component con microinterazioni `framer-motion`: `ReferenzeSplitTableWidget` (tab animati Singoli/Gruppi con `AnimatePresence`), `DualPieChartWidget` (due donut affiancati con stagger), `PriceDiffWidget` (tabella con badge rosso/verde e righe animate); aggiornati `resolveSpanClass` e `ReportWidget` per gestire i nuovi tipi

## [2.11.090] - 2026-04-16

### Modificato
- **`server/core/agenzia_lib/coopfi/index.ts`** — `improveTracciatiComparison` riscritta per analisi per reparto: flatten di tutti i record da `primario.tracciati` e `secondario.tracciati`, raggruppamento per `codice_reparto`, calcolo autonomo di **Uscenti** (in primario ma non in secondario per `Referenza.Codice`), **Entranti** (in secondario ma non in primario), **Modificati** (stesso codice ma valori diversi) e **Inalterati** (stesso codice, stessi valori); stabilità % e KPI derivati interamente dai record senza dipendenza dai campi Istanta `uscenti/entranti/inalterati/alterati`; il report include KPI globali, callout stabilità, bar chart per reparto, pie distribuzione e tabella dettaglio con colonne `Ref. Primario`, `Ref. Secondario`, `Entranti`, `Uscenti`, `Modificati`, `Inalterati`, `Tot. Movimenti`

## [2.11.089] - 2026-04-16

### Aggiunto
- **`lib/types.ts`** — campo `confronti_con_risultato: string[]` in `TracciatiMomentoResponseDTO`: lista degli ID dei momenti con cui esiste un confronto già calcolato
- **`server/core/repositories/TracciatiMomentoRepository.ts`** — metodo `findConfrontiByMomentoIds(ids[])` per fetch bulk di tutti i confronti relativi a un set di momenti in una sola query

### Modificato
- **`server/core/services/TracciatoService.ts`** — `getMomentiPerPromo` ora carica in un unico round-trip tutti i confronti dei momenti e popola `confronti_con_risultato` in ogni DTO; `mapMomentoToDTO` accetta il terzo parametro opzionale
- **`GestioneMomenti.tsx`** — stato `completedConfrontiKeys` inizializzato dai dati persistiti (`confronti_con_risultato`) a ogni refresh della query, garantendo persistenza cross-sessione; bottone confronto mostra solo il bordo verde (`border-success/60 bg-white`) senza background fill; SVG freccia e segmenti del connettore cambiano colore in success quando il confronto è completato

## [2.11.088] - 2026-04-15

### Aggiunto
- **`lib/enums.ts`** — enum `TIPO_SCHEMA` con valori `BUSINESS` e `AGENZIA`
- **`lib/types.ts`** — tipo `TipoSchema = 'BUSINESS' | 'AGENZIA'`, tipo `TracciatiSchemaConfronto = { a: number; b: number }` (coppie di item per ordine); campo `tipo: TipoSchema[]` e `confronti: TracciatiSchemaConfronto[]` in `TracciatiSchemaResponseDTO`
- **`server/core/models/tracciati_schema.ts`** — colonne `tipo` (`ARRAY(STRING)`, `NOT NULL`, default `[]`) e `confronti` (JSONB, `NOT NULL`, default `[]`); eseguire `npm run models:sync`
- **`server/core/interfaces/ITracciatoService.ts`** — aggiornate firme `createSchema` e `updateSchema` per includere `tipo: TipoSchema[]` e `confronti?: TracciatiSchemaConfronto[]`
- **`server/core/services/TracciatoService.ts`** — `mapSchemaToDTO` include `tipo` e `confronti`; `createSchema` e `updateSchema` aggiornati con i nuovi parametri
- **`server/core/controllers/TracciatoController.ts`** — validazione `tipo` (array non vuoto, valori in BUSINESS/AGENZIA) e `confronti` (array, coppie non identiche) in `createSchema` e `updateSchema`
- **`GestioneSchemi.tsx`** — selector multi-toggle tipo (BUSINESS/AGENZIA, entrambi selezionabili); costruttore coppie confronto per click sequenziale su due momenti con rimappa ordini dopo rimozione; `SchemaCard` con badge tipo e sezione "Confronti" che mostra `NomeA ↔ NomeB`
- **`GestioneMomenti.tsx`** — badge tipo nel dropdown "Applica schema" per ogni schema nella lista

## [2.11.087] - 2026-04-15

### Aggiunto
- **`GestioneMomenti.tsx`** — componente `MomentoConnector` inserito tra ogni coppia di card momento: freccia orizzontale con pallino sinistro, linea gradiente e punta destra che reagisce al hover (slate → violet); pulsante circolare centrale con icona `GitCompare` e tooltip "Confronta A con B"; handler `handleConfronta` che mostra notifica con i nomi dei due momenti a confronto

## [2.11.086] - 2026-04-15

### Aggiunto
- **`server/core/models/tracciati_schema.ts`** — nuovo modello Sequelize per gli schemi di momenti (tabella `tracciati_schema`): colonne `id` (UUID), `nome` (STRING), `items` (JSONB array di `TracciatiSchemaItem`); eseguire `npm run models:sync`
- **`server/core/models/index.ts`** — registrazione del modello `TracciatiSchema`
- **`server/core/repositories/TracciatiSchemaRepository.ts`** — repository `TracciatiSchemaRepository` che estende `BaseRepository`
- **`server/core/di/types.ts`** — simbolo `TracciatiSchemaRepository` per il container Inversify
- **`server/core/di/container.ts`** — binding singleton di `ITracciatiSchemaRepository` e aggiornamento del binding di `TracciatoService` per iniettare il repository degli schemi come 5° parametro
- **`lib/types.ts`** — tipi `TracciatiSchemaItem`, `TracciatiSchemaResponseDTO` per la gestione degli schemi di momenti
- **`ITracciatoService.ts`** — firme `getAllSchemi`, `createSchema`, `updateSchema`, `deleteSchema`, `applicaSchema`
- **`TracciatoService.ts`** — implementazione di `mapSchemaToDTO`, `getAllSchemi`, `createSchema`, `updateSchema`, `deleteSchema`, `applicaSchema` (crea momenti dalla lista `items` dello schema, con offset ordinale basato sui momenti esistenti)
- **`TracciatoController.ts`** — route REST per schemi: `GET /tracciati/schemi`, `POST /tracciati/schemi`, `PUT /tracciati/schemi/:idSchema`, `DELETE /tracciati/schemi/:idSchema`, `POST /tracciati/schemi/:idSchema/applica`
- **`GestioneSchemi.tsx`** — nuovo componente React per la gestione degli schemi: lista schemi come card, form di creazione inline, pulsante "Applica a questa promo"
- **`GestioneMomenti.tsx`** — integrazione di `GestioneSchemi` in sezione collassabile "Schemi di momenti" sotto la lista dei momenti; al click su "Applica" invalida la query dei momenti

## [2.11.085] - 2026-04-15

### Aggiunto
- **`tracciati_momento` model** — colonna `snapshot BOOLEAN NOT NULL DEFAULT false`; aggiornate la classe e la definizione Sequelize (eseguire `npm run models:sync`)
- **`lib/types.ts`** — campo `snapshot: boolean` in `TracciatiMomentoAttributes` e `TracciatiMomentoResponseDTO`
- **`ITracciatoService.ts` / `TracciatoService.ts`** — `createMomento` accetta parametro opzionale `snapshot?: boolean`; `mapMomentoToDTO` include `snapshot`; payload Istanta usa `momento.snapshot` invece del valore fisso `false`
- **`TracciatoController.ts`** — legge `snapshot` dal body e lo passa a `createMomento`
- **`GestioneMomenti.tsx`** — due bottoni in toolbar: "Nuovo momento" e "Nuovo snapshot"; badge tipo (Normale/Snapshot) nel form di creazione e nell'header di ogni card; corpo della card differenziato: per snapshot mostra messaggio descrittivo senza lista tracciati; `canPlay` abilitato per snapshot senza requisito di tracciati assegnati

## [2.11.084] - 2026-04-15

### Aggiunto
- **`lib/types.ts`** — tipi `AnalisiMomentoRecord`, `AnalisiMomentoTracciato`, `AnalisiMomentoResponse` per la risposta di Istanta `/FicoProcess/analisiMomento`; `risultato` in `TracciatiMomentoAttributes` e `TracciatiMomentoResponseDTO` ora tipizzato come `AnalisiMomentoResponse | null` invece di `any`

### Modificato
- **`TracciatoService.ts`** — `calcolaRisultatoMomento`: la chiamata a `sendToFICOApi` è ora tipizzata con `AnalisiMomentoResponse`; il risultato viene estratto da `.data`, salvato nel campo `risultato` del momento via `momentoRepository.update`, e il DTO aggiornato viene ritornato; `mapMomentoToDTO` usa il cast tipizzato per `risultato`

## [2.11.083] - 2026-04-15

### Aggiunto
- **`lib/types.ts`** — campo `risultato?: any` aggiunto a `TracciatiMomentoAttributes` e `TracciatiMomentoResponseDTO`
- **`ITracciatoService.ts`** — firma `calcolaRisultatoMomento(idMomento: string): Promise<TracciatiMomentoResponseDTO>`
- **`TracciatoService.ts`** — implementazione stub di `calcolaRisultatoMomento`: recupera il momento dal DB e ritorna il DTO (TODO interno per la logica di calcolo); `mapMomentoToDTO` aggiornato per includere il campo `risultato`
- **`TracciatoController.ts`** — route `POST /tracciati/momenti/:idMomento/risultato` con handler `calcolaRisultatoMomento`
- **`GestioneMomenti.tsx`** — helper `apiCalcolaRisultato` e `handlePlay` collegato all'endpoint: imposta `playingId` durante la chiamata, invalida la query al successo, mostra notifica di errore in caso di fallimento

## [2.11.082] - 2026-04-15

### Aggiunto
- **`GestioneMomenti.tsx`** — bottone "Avvia confronto" (icona Play) in fondo ad ogni `MomentoCard`; disabilitato se il momento non ha tracciati o è già in esecuzione; callback `onPlay(id)` pronta per la logica backend; stato `playingId` nel componente padre per tracciare il momento in esecuzione

### Corretto
- **`GestioneMomenti.tsx`** — il dropdown "Aggiungi tracciato" ora esclude anche i tracciati già assegnati ad altri momenti (non solo a quello corrente), garantendo unicità di ogni tracciato tra i momenti della stessa promo

## [2.11.081] - 2026-04-13

### Aggiunto
- **`server/core/models/tracciati_momento.ts`** — nuovo modello Sequelize per la tabella `tracciati_momento`: raggruppa tracciati in "momenti" nominati per promo (`id_promo`, `nome`, `tracciati_ids` JSONB, `ordine`)
- **`server/core/repositories/TracciatiMomentoRepository.ts`** — nuovo repository con metodo `findByPromoId` (ordine per `ordine ASC`, `createdat ASC`)
- **`server/core/services/TracciatoService.ts`** — aggiunti `getMomentiPerPromo`, `createMomento`, `updateMomento`, `deleteMomento`
- **`server/core/controllers/TracciatoController.ts`** — nuovi endpoint `GET /tracciati/momenti/promo/:idPromo`, `POST /tracciati/momenti`, `PUT /tracciati/momenti/:idMomento`, `DELETE /tracciati/momenti/:idMomento`
- **`lib/types.ts`** — aggiunti tipi condivisi `TracciatiMomentoAttributes` e `TracciatiMomentoResponseDTO`
- **`src/pages/LavorazioniInCorso/DettagliLavorazioneInCorso/GestioneMomenti.tsx`** — nuovo componente per la gestione momenti: layout orizzontale scrollabile con card per ogni momento, assegnazione/rimozione tracciati tramite dropdown, rinomina inline, eliminazione con conferma, pool tracciati non assegnati in basso

## [2.11.080] - 2026-04-13

### Aggiunto
- **`server/core/models/report_confronto_tracciati.ts`** — nuovo modello Sequelize per la tabella `report_confronto_tracciati`: archivia il risultato grezzo di Istanta (`istanta_result` JSONB), il report arricchito da AgenziaLib con widget (`report` JSONB), i contesti e gli ID dei tracciati usati nel confronto
- **`server/core/repositories/ReportConfrontoTracciatiRepository.ts`** — nuovo repository con metodo `findByPromoId` (ordine DESC) per recuperare lo storico report per promo
- **`server/core/services/TracciatoService.ts`** — `confrontaTracciati` ora salva automaticamente il report a DB dopo la generazione e ritorna `SavedReportConfronto`; aggiunti `getReportsConfronto(idPromo)` e `getReportConfrontoById(id)`
- **`server/core/controllers/TracciatoController.ts`** — nuovi endpoint `GET /tracciati/confronto/reports?idPromo=` e `GET /tracciati/confronto/reports/:id` per lo storico dei report
- **`lib/types.ts`** — aggiunti tipi condivisi `SavedReportConfrontoSummary` e `SavedReportConfronto`
- **`src/pages/ReportTracciati/index.tsx`** — sezione "Confronti precedenti" nel pannello destro dello step 1: carica lo storico report per la promo selezionata; click su un report naviga direttamente alla pagina di visualizzazione

## [2.11.079] - 2026-04-13

### Aggiunto
- **`server/core/agenzia_lib/coopfi/index.ts`** — widget `callout` inserito come secondo widget del report confronto tracciati (tra KPI grid e i grafici): calcola `stabilitaPercent`, saldo entranti/uscenti e area con maggiore impatto; severity dinamica (success ≥80%, info ≥60%, warning ≥40%, error <40%); badge con percentuale di stabilità
- **`server/core/agenzia_lib/default/index.ts`** — stesso callout insight aggiunto alla lib default; calcola stabilitaPercent e saldo catalogo con la stessa logica di severity

## [2.11.078] - 2026-04-13

### Sicurezza
- **`server/core/middleware/securityMiddleware.ts`** — aggiunto `'wasm-unsafe-eval'` alla direttiva `script-src` del CSP: risolve il blocco di `@react-pdf/renderer` che compila internamente moduli WebAssembly (fontkit/harfbuzz); la direttiva abilita solo bytecode WASM senza sbloccare `eval()` JavaScript

## [2.11.077] - 2026-04-13

### Aggiunto
- **`lib/types.ts`** — nuovo tipo `TracciatoWidgetCallout` (`type: 'callout'`): campi `message`, `severity` (`info | warning | success | error`), `icon` opzionale; aggiunto all'unione `TracciatoReportWidget`
- **`src/pages/RisultatoConfrontoTracciati/index.tsx`** — componente `CalloutWidget`: barra colorata laterale + icona Lucide + titolo/descrizione/messaggio/badge; palette `CALLOUT_TONE` per i 4 severity; `resolveSpanClass` aggiornato per occupare `col-span-12`
- **`src/pages/RisultatoConfrontoTracciati/TracciatoReportPdfDocument.tsx`** — componente `PdfCallout`: stessi 4 severity con colori PDF dedicati (`CALLOUT_COLORS`); barra laterale colorata, titolo, descrizione, messaggio, badge opzionale; stili `calloutWrapper/Bar/Body/Title/Message/Badge` aggiunti al StyleSheet; `PdfWidget` router aggiornato con `case "callout"`

## [2.11.076] - 2026-04-13

### Modificato
- **`src/pages/ReportTracciati/index.tsx`** — wizard di confronto tracciati esteso da 2 a 3 step: aggiunto step "Contesto" obbligatorio che carica i campi via `GET /tracciati/confronto/contesto` e usa lo stesso componente `ContestoLavorazioneFields` del caricamento tracciato; il contesto viene pre-fetch in background al momento della selezione promo e validato prima dell'invio; il pulsante "Avvia confronto" rimane disabilitato finché tutti i campi obbligatori non sono compilati
- **`server/core/dto/TracciatiDTO.ts`** — `CompareTracciatiRequestDTO.context` cambiato da `ContextConfronto` a `ContextConfronto[]` per supportare array di campi contesto come nel caricamento
- **`server/core/interfaces/ITracciatoService.ts`** — firma `confrontaTracciati` aggiornata: `context: ContextConfronto[]`
- **`server/core/services/TracciatoService.ts`** — firma `confrontaTracciati` aggiornata: `context: ContextConfronto[]`

## [2.11.075] - 2026-04-10

### Aggiunto
- **`lib/types.ts`** — campo `icon?: string` su `KpiCardItem`: il server può ora specificare il nome dell'icona Lucide da mostrare su ogni KPI card

### Modificato
- **`src/pages/RisultatoConfrontoTracciati/index.tsx`** — `KpiGridWidget` usa `item.icon` se presente, con fallback al vecchio lookup su label (`KPI_ICON_FALLBACK`); il lookup è stato rinominato per chiarire il suo ruolo di fallback
- **`server/core/agenzia_lib/coopfi/index.ts`** — aggiunto campo `icon` per tutti i KPI card del confronto tracciati (TrendingDown, TrendingUp, Minus, Pencil)
- **`server/core/agenzia_lib/default/index.ts`** — stesso aggiornamento per il default

## [2.11.074] - 2026-04-10

### Aggiunto
- **`src/pages/GestioneApi/StatistichePdfDocument.tsx`** — nuovo documento react-pdf per l'export delle statistiche API: KPI grid (4 card), tabella panoramica metriche, tabella top endpoints, tabella attività recente con colori badge per codice HTTP (2xx verde, 3xx giallo, 4xx/5xx rosso); stile corporate coerente con `TracciatoReportPdfDocument`
- **`src/components/pdf/DataTablePdfDocument.tsx`** — componente react-pdf generico riutilizzabile client-side: intestazione corporate, tabella con righe alternate, footer fisso con paginazione, supporto portrait/landscape
- **`server/core/pdf/DataTablePdfDocument.tsx`** — documento react-pdf generico per export tabellare lato server, con supporto portrait/landscape automatico, intestazione corporate e footer con paginazione

### Modificato
- **`src/pages/GestioneApi/utils/exportHelpers.ts`** — `exportStatisticsToPDF` migrata a generazione client-side con `@react-pdf/renderer` (import dinamico del documento); rimossa dipendenza da `ServerCall`
- **`src/pages/GestioneUtenti/index.tsx`** — export PDF migrato client-side: quando `format=pdf`, il browser genera direttamente il PDF con `DataTablePdfDocument` senza round-trip server
- **`server/core/controllers/UserController.ts`** — `createPDFBuffer` migrata da mupdf a `renderToBuffer` di `@react-pdf/renderer` con `DataTablePdfDocument`; rimosso import mupdf
- **`server/core/controllers/ExternalApiController.ts`** — rimossi route `POST /statistiche/export-pdf`, metodi `exportStatistichePdf` e `buildStatistichePdf`; rimosso import mupdf

### Rimosso
- **`mupdf` (dipendenza)** — eliminata completamente dal progetto; tutti gli export PDF ora usano `@react-pdf/renderer` v4.4.0 con layout corporate dichiarativo

## [2.11.073] - 2026-04-10

### Aggiunto
- **`lib/types.ts`** — campo `badge?: string` su `_TracciatoWidgetBase`: l'agenzia lib può ora specificare il badge mostrato nell'header di ogni widget, rendendo il contenuto completamente gestito lato server

### Modificato
- **`server/core/agenzia_lib/coopfi/index.ts`** — `improveTracciatiComparison` completamente riscritto con contenuto professionale: palette colori brand coerente, KPI con label italiane complete, colonna "Stabilità %" calcolata nella tabella, colonna "Tot. movimenti" aggregata, subtitle dinamico con conteggio prodotti e movimenti, badge espliciti su tutti i widget, descrizioni informative per ogni widget
- **`server/core/agenzia_lib/default/index.ts`** — stesso trattamento: label KPI complete, colonna stabilità nella tabella, subtitle dinamico, badge e descrizioni su tutti i widget
- **`src/pages/RisultatoConfrontoTracciati/index.tsx`** — fix bug chart: rimosso wrapper `<div className="h-64">` e passato `height={260}` direttamente al componente `Chart` (il canvas necessita che il genitore diretto abbia altezza definita per `responsive: maintainAspectRatio: false`); rimosso `useBorderRadius/borderRadius` dalla legend dei chart sostituito con `usePointStyle: true, pointStyle: 'circle'`; tutti i badge ora provengono da `widget.badge` (con fallback row count per le tabelle senza badge esplicito)

## [2.11.072] - 2026-04-10

### Aggiunto
- **`server/core/services/TracciatoService.ts`** — costante `DEV_CONFRONTO_MOCK` con 4 item realistici (2 aree × 2 canali): il metodo `confrontaTracciati` usa i dati mock solo in ambiente `development`, evitando chiamate a Istanta durante lo sviluppo
- **`src/pages/RisultatoConfrontoTracciati/index.tsx`** — helper `resolveSpanClass()` che estrae il calcolo della colonna CSS dal componente `ReportWidget`, correggendo il bug che impediva alle animazioni Framer Motion di funzionare (il `motion.div` aveva `className="contents"` che annulla il box model)

### Modificato
- **`server/core/agenzia_lib/coopfi/index.ts`** — rimossa la costante `DEV_TRACCIATI_COMPARISON_MOCK` e la logica di append in sviluppo: i dati mock sono ora centralizzati in `TracciatoService`
- **`src/pages/RisultatoConfrontoTracciati/index.tsx`** — `KpiGridWidget`: aggiunta percentuale sul totale sotto ogni valore KPI; `BarChartWidget`: `chartData`/`chartOptions` wrappati in `useMemo`, badge rinominato in "Tendenza"; `PieChartWidget`: `useMemo`, totale numerico sotto il donut, badge rinominato in "Distribuzione"; `TableWidget`: badge conta righe, auto-rilevamento colonne numeriche con allineamento a destra e `tabular-nums`, nota footer se righe > 10
- **`src/pages/RisultatoConfrontoTracciati/TracciatoReportPdfDocument.tsx`** — miglioramenti estetici e informativi del PDF: accent line blu 4px sopra l'hero; bordo sinistro colorato per tipo sulle summary card (mappa `SUMMARY_ACCENT`); percentuale sul totale in ogni card KPI; footnote max/media sotto il bar chart; totale numerico sotto il donut; auto-rilevamento colonne numeriche nella tabella con allineamento a destra e riga totali in grassetto; data centrata nel footer; watermark "CONFIDENZIALE" in filigrana

## [2.11.071] - 2026-04-10

### Aggiunto
- **`lib/types.ts`** — nuovi tipi `TracciatoReport`, `TracciatoReportWidget`, `TracciatoWidgetKpiGrid`, `TracciatoWidgetChart`, `TracciatoWidgetTable`, `KpiCardItem` per il sistema di report dinamico tracciati
- **`server/core/agenzia_lib/types.ts`** — `IAgenziaLib.improveTracciatiComparison` ora ritorna `Promise<TracciatoReport>` invece di `Promise<any>`
- **`server/core/agenzia_lib/coopfi/index.ts`** — implementazione CoopFi di `improveTracciatiComparison`: 5 widget (kpi_grid, 2×bar_chart, pie_chart, table) con aggregazione per area/canale
- **`server/core/agenzia_lib/default/index.ts`** — implementazione default di `improveTracciatiComparison`: 2 widget (kpi_grid, table) con totali globali
- **`server/core/services/TracciatoReportPdfService.ts`** — nuovo servizio PDF con `@react-pdf/renderer`: componenti `PdfKpiGrid`, `PdfBarChart`, `PdfPieChart`, `PdfTable` renderizzati lato server
- **`server/core/controllers/TracciatoController.ts`** — nuovo endpoint `POST /api/tracciati/confronto/pdf` per esportazione PDF del report
- **`src/pages/RisultatoConfrontoTracciati/index.tsx`** — nuova pagina report dinamica: renderizza widget dal `TracciatoReport`, esporta PDF via `ServerCall.postRaw`
- **`src/router/index.tsx`** — aggiunta route `/report/tracciati/risultato` con lazy loading

### Modificato
- **`server/core/services/TracciatoService.ts`** — `confrontaTracciati` completato: ritorna `TracciatoReport` da `improveTracciatiComparison`
- **`server/core/interfaces/ITracciatoService.ts`** — `confrontaTracciati` return type aggiornato a `Promise<TracciatoReport>`
- **`server/core/controllers/TracciatoController.ts`** — `avviaConfrontoTracciati` risponde ora HTTP 200 con il `TracciatoReport` invece di 202 vuoto
- **`server/core/dto/TracciatiDTO.ts`** — `CompareTracciatiResponseDTO` è ora un re-export di `TracciatoReport`
- **`src/pages/ReportTracciati/index.tsx`** — `confrontoMutation.onSuccess` naviga a `/report/tracciati/risultato` passando il report come state

## [2.11.070] - 2026-04-10

### Aggiunto
- **`lib/server_call.ts`** — nuovo metodo pubblico `ServerCall.postRaw(url, data)`: POST con CSRF e retry automatico che ritorna la `Response` grezza, per download di file binari

### Modificato
- **`package.json`** — rimossi `jspdf`, `jspdf-autotable`, `@types/jspdf`; aggiunto `mupdf` v1.27.0 come unica libreria PDF
- **`server/tsconfig.json`** — `moduleResolution` aggiornato da `"node"` a `"bundler"` per supportare il campo `exports` dei pacchetti moderni
- **`server/core/controllers/UserController.ts`** — `createPDFBuffer` riscritto con mupdf: layout landscape automatico per >6 colonne, clip testo dinamico per colonna; rimosso import jsPDF
- **`server/core/controllers/ExternalApiController.ts`** — aggiunto endpoint `POST /api/external/statistiche/export-pdf` che genera il PDF statistiche con mupdf lato server
- **`src/pages/GestioneUtenti/index.tsx`** — export utenti migrato da `fetch` nudo a `ServerCall.postRaw`; risolto errore CSRF mancante
- **`server/core/controllers/UserController.ts`** — `exportUsers` ora usa i dati `data` già inviati dal frontend se disponibili, evitando la query `get_all_utenti` (che includeva `canaliInterazione` e causava "not associated" se le relazioni non erano ancora inizializzate)
- **`src/pages/GestioneApi/utils/exportHelpers.ts`** — `exportStatisticsToPDF` ora `async`, usa `ServerCall.postRaw`; rimossi import jspdf
- **`src/pages/GestioneApi/hooks/useStatisticsExport.tsx`** — aggiunto `await` su `exportStatisticsToPDF`

## [2.11.069] - 2026-04-09

### Modificato
- **`src/pages/Api/Statistiche/index.tsx`** — ridisegnato il layout della pagina Statistiche API: rimosso il wrapper unico `box--stacked`, ogni sezione è ora una card indipendente (`box`); nuova griglia a due colonne per i grafici (trend temporale 8/12 + donut 4/12; endpoint bar 7/12 + OS list 5/12); `OsStatCard` sostituito da `OsStatRow` compatto con barra di progresso colorata (verde/ambra/rosso) e velocità media; skeleton loader aggiornato per corrispondere alla nuova struttura
- **`src/pages/GestioneApi/components/statistics/StatCard.tsx`** — aggiunto prop `variant` (`blue`, `green`, `amber`, `rose`, `slate`) con bordo sinistro colorato e background icona semantico; migliorata gerarchia tipografica (label uppercase tracking-wider, valore bold 2xl)
- **`src/pages/GestioneApi/components/statistics/ActivityTable.tsx`** — header tabella con sfondo `bg-slate-50`; righe alternate con effetto zebra; colore del tempo di risposta semantico (verde <200ms, ambra <1s, rosso ≥1s); endpoint mostrato per intero con attributo `title` per tooltip; stato vuoto senza titolo ridondante

## [2.11.068] - 2026-04-09

### Corretto
- **`server/core/agenzia_lib/coopfi/utility/coopfi-policy-v2.ts`** — sostituito l'algoritmo greedy (catena lineare) con il backtracking ricorsivo del file di test: i reparti vengono ora aggiunti come fratelli sotto il nodo ruolo (non annidati l'uno dentro l'altro) e ogni area viene attaccata al reparto che la precede direttamente; estratti `repartoCodes`, `areaCode` e `finalSettori` traversando il nodo root risultante

## [2.11.067] - 2026-04-09

### Modificato
- **`server/core/agenzia_lib/coopfi/index.ts`** — aggiunto metodo privato `fetchWithFibRetry`: gestisce il retry delle chiamate HTTP verso la Coopfi API con backoff a sequenza di Fibonacci (1s, 1s, 2s, 3s, 5s...). Distingue tra errori transitori (5xx, rete) — che vengono ritentati — e errori definitivi (4xx non-401) — che vengono lanciati immediatamente. Il 401 causa un refresh immediato del token senza consumare un tentativo Fibonacci; se il secondo tentativo torna ancora 401 l'errore è definitivo. Refactoring di `fetchUtenteCoopfiCensito`: il blocco manuale di fetch + retry 401 + check errore è stato sostituito con una singola chiamata a `fetchWithFibRetry`, così come il fetch di fallback (ora best-effort con try/catch)

## [2.11.066] - 2026-04-09

### Modificato
- **`src/hooks/useSocket.tsx`** / **`src/themes/Echo/index.tsx`** / **`src/main.tsx`** — spostato `SocketProvider` dal root dell'applicazione al layout autenticato (`Echo`): la connessione WebSocket e le notifiche di sistema vengono ora stabilite solo per gli utenti autenticati, eliminando i toast sulle pagine pubbliche `/login` e `/hub`

## [2.11.065] - 2026-04-08

### Corretto
- **`src/pages/StoricoVolantini/index.tsx`** — gestito correttamente il permission gate nel componente `KitCard`: il titolo del kit e il link alla promozione diventano navigabili (`<Link>`) solo se l'utente ha il permesso `pagina.lavorazioni_in_corso`; in caso contrario vengono renderizzati come testo semplice (`<p>`). Corretta anche la data `validita_dal` per mostrare sempre l'anno completo anche quando entrambe le date sono presenti

## [2.11.064] - 2026-04-08

### Corretto
- **`server/core/agenzia_lib/coopfi/utility/coopfi-policy-v2.ts`** — riscritta `buildCoopfiPolicyFromCodeV2` per restituire il tipo discriminato `PolicyBuildResultV2` (`ok: true/false`) invece di `OlympusUserPolicyRuolo[]` con throw; l'albero viene ora costruito a catena annidata (`role → reparto[0] → reparto[1] → area`) invece di nodi fratelli; in caso di errore (es. ruolo non trovato) viene restituito `{ ok: false, error: { code: "ROLE_NOT_FOUND", ... } }` senza eccezione
- **`server/core/agenzia_lib/coopfi/index.ts`** — aggiornato `getRuoliPolicyFromUtenteCoop` per gestire il nuovo tipo di ritorno: verifica `result.ok` e restituisce `result.tree` in caso di successo, `[]` con log warn in caso di fallimento

## [2.11.063] - 2026-04-07

### Modificato
- **`src/pages/SuperadminDashboard/index.tsx`** — gestione dei tab spostata su query string (`?tab=superadmin|audit|gdo`): ogni click aggiorna la URL preservando gli altri parametri; al refresh del browser viene ripristinato direttamente il tab corrente; se il parametro è assente o invalido viene normalizzato automaticamente a `tab=superadmin`
- **`src/pages/AuditLogDashboard/index.tsx`** — aggiunto pulsante `Aggiorna` nella toolbar Audit con refetch manuale di log, summary, tipi evento e severità; durante l'operazione il pulsante mostra spinner e stato `Aggiornamento...` ed è disabilitato; in caso di errore viene mostrata notifica utente

## [2.11.062] - 2026-04-07

### Modificato
- **`src/pages/ServicesDashboard/components/ServiceDetailsModal.tsx`** — rinnovato il background SVG animato dell'hero header: sostituita la grafica precedente (griglia punti + cerchi pulsanti + rombo rotante) con una composizione multi-layer premium — aurora gradient blob (indigo/sky-blue con drift organico), griglia punti fine con deriva, cluster di esagoni concentrici a rotazione lenta in angolo top-right e bottom-left, costellazione di nodi con linee bezier a flusso dash animato, ripple ring su nodi chiave (espansione `<animate>` SVG), e un beam di luce con sweep orizzontale periodico ogni 18 s

## [2.11.061] - 2026-04-07

### Corretto
- **`src/components/Base/Ckeditor/ClassicEditor/plugins/ToolbarPlugin.tsx`** — corretti 6 nomi icona Lucide incompatibili con l'oggetto `icons` di lucide-react v1.7.0: `AlignLeft`→`TextAlignStart`, `AlignCenter`→`TextAlignCenter`, `AlignRight`→`TextAlignEnd`, `AlignJustify`→`TextAlignJustify`, `IndentIncrease`→`ListIndentIncrease`, `IndentDecrease`→`ListIndentDecrease` — le icone esistevano come export nominali ma non nell'oggetto `icons` usato dal componente `Lucide`, risultando in 6 pulsanti invisibili nella toolbar

## [2.11.060] - 2026-04-07

### Corretto
- **`src/components/Base/Ckeditor/ClassicEditor/index.tsx`** — aggiunto `isInitializedRef` per bloccare `handleUpdate` finché il caricamento iniziale non è completato: Lexical spara un update immediatamente al mount con editor vuoto, chiamando `onChange("")` e azzerando `values.contenuto` nel parent prima che il content loader potesse caricare il contenuto reale della news — il contenuto risultava quindi sempre vuoto all'apertura del modale di modifica. Aggiunto anche `lastEmittedRef` per distinguere cambiamenti di `value` provenienti dalla digitazione utente da quelli esterni, evitando il ciclo reload-su-ogni-tasto

## [2.11.059] - 2026-04-07

### Corretto
- **`src/components/Base/Ckeditor/ClassicEditor/plugins/ToolbarPlugin.tsx`** — aggiunto `type="button"` a tutti i 36 elementi `<button>` della toolbar: in assenza del tipo esplicito, i `<button>` dentro un `<form>` fanno default a `type="submit"` causando l'invio del form (POST) ad ogni click su un controllo dell'editor
- **`src/components/Base/Ckeditor/ClassicEditor/index.tsx`** — rimosso `useEffect` duplicato che registrava `registerUpdateListener` due volte: `onChange` veniva chiamata due volte per ogni modifica, corrompendo lo stato del form genitore
- **`src/components/Base/Ckeditor/ClassicEditor/index.tsx`** — `parseAllowedColor` ora accetta qualsiasi colore CSS valido (hex `#rrggbb`/`#rgb`, `rgb()`, `rgba()`, nomi CSS); in precedenza solo 14 valori `rgb()` specifici erano accettati, causando la perdita silenziosa di tutti i colori hex impostati dal ColorPicker al re-import del contenuto
- **`src/components/Base/Ckeditor/ClassicEditor/index.tsx`** — `parseAllowedFontSize` ora accetta qualsiasi dimensione px tra 8 e 96 (coerente con la toolbar); in precedenza 8 dimensioni specifiche erano accettate e tutte le altre venivano silenziosamente sovrascritte con `16px` al re-import
- **`src/components/Base/Ckeditor/ClassicEditor/index.tsx`** — aggiornati i confronti di default in `getExtraStyles` per escludere anche le varianti hex (`#000000`, `#ffffff`) degli stili di default, evitando emissione ridondante di stili inline
- **`src/components/Base/Ckeditor/ClassicEditor/index.tsx`** — `onChange` ora usa `useRef` per evitare stale closures: il listener non si ri-registra ad ogni render del genitore
- **`src/components/Base/Ckeditor/ClassicEditor/index.tsx`** — `setContentLoaded` e `setLastLoadedValue` sono ora chiamati nell'opzione `onUpdate` di `editor.update()` invece che prima del completamento dell'aggiornamento asincrono, eliminando potenziali race conditions nel caricamento del contenuto iniziale
- **`src/components/Base/Ckeditor/ClassicEditor/index.tsx`** — rimosso `placeholder` duplicato da `RichTextPlugin` (era già gestito da `ContentEditable`); in Lexical 0.21+ la duplicazione causava il rendering del placeholder due volte nel DOM
- **`src/components/Base/Ckeditor/ClassicEditor/plugins/ToolbarPlugin.tsx`** — sostituito `$wrapNodes` (deprecato in Lexical 0.9+) con `$setBlocksType` in `formatParagraph`, `formatHeading`, `formatQuote`
- **`src/components/Base/Ckeditor/ClassicEditor/plugins/ToolbarPlugin.tsx`** — corretto `clearFormatting`: `selection.formatText('bold', 0)` non è un'API Lexical valida; ora usa `selection.hasFormat()` + `editor.dispatchCommand(FORMAT_TEXT_COMMAND, fmt)` per ogni formato attivo
- **`src/components/Base/Ckeditor/ClassicEditor/plugins/ToolbarPlugin.tsx`** — rimossa voce "Code Block" dal dropdown del formato blocco: aveva `onClick={() => {}}` e non eseguiva nulla, confondendo l'utente
- **`src/components/Base/Ckeditor/ClassicEditor/plugins/ToolbarPlugin.tsx`** — rimosso state `isCode` inutilizzato (veniva aggiornato ma nessun elemento JSX lo leggeva)
- **`src/components/Base/Ckeditor/ClassicEditor/plugins/plugin_toolbar.module.scss`** — rimosso riferimento a `icons/chevron-down.svg` inesistente nel select font-size; sostituito con data URI SVG inline che non richiede file esterni

## [2.11.058] - 2026-04-07

### Corretto
- **`server/core/services/HubServiceService.ts`** — `bulkUpdateServices` ora propaga il patch anche alla variante Superadmin per ogni codice aggiornato: in precedenza, la modifica di un gruppo servizi Hub non aggiornava la variante Superadmin esistente

## [2.11.057] - 2026-04-07

### Modificato
- **`src/pages/Dashboard3/index.tsx`** — nel componente `KitCard` della dashboard GDO, il titolo del kit e il link alla promo non sono più cliccabili se l'utente non ha il permesso `pagina.lavorazioni_in_corso`; il nome della promo viene mostrato come testo semplice in assenza di permesso

## [2.11.056] - 2026-04-07

### Modificato
- **`server/core/agenzia_lib/coopfi/index.ts`** — gli utenti `BUSINESS_CATEGORY` ora ricevono il parsing del ruolo dal prefisso del `codicePosizione` (es. `RAA` → `ADMIN`): viene impostato `id_ruolo_utente_gdo` in fase di registrazione e la policy `ruoli` viene inviata a Olympus passport; estratta costante `PREFIX_TO_RUOLO` a livello di modulo per evitare duplicazione con `parseTipoRuoloDaCodicePosizione`

## [2.11.055] - 2026-04-07

### Modificato
- **`src/pages/GestioneHub/components/ServicesTab.tsx`** — rimossa modalità `edit-variant` (modifica singola variante), rimossa selezione multipla con checkbox e barra di selezione, rimosso componente `BulkServiceEditDialog`; la modifica avviene ora esclusivamente tramite `edit-group`
- **`src/pages/GestioneHub/components/ServiceFormDialog.tsx`** — rimossa gestione modalità `edit-variant`; la validazione del target è ora sempre attiva; semplificato il titolo icona e il testo del pulsante salva
- **`src/pages/GestioneHub/components/ServiceSharedAssetsEditor.tsx`** — rimosso riferimento alla modalità `edit-variant` nel calcolo della proprietà `editable`
- **`src/pages/GestioneHub/types.ts`** — rimosso `edit-variant` da `ServiceDialogMode`; rimossi i tipi `BulkEditPatch` e `BulkFieldValue` non più utilizzati
- **`src/pages/GestioneHub/components/BulkServiceEditDialog.tsx`** — file eliminato (dead code)

## [2.11.054] - 2026-04-07

### Corretto
- **`server/core/repositories/HubServiceRepository.ts`** — aggiunta deduplicazione per codice nel ramo "utente senza ruolo" di `findActiveForRole`: PostgreSQL consente più righe `NULL` nello stesso indice univoco su `(codice, tipo_utente, ruolo_gdo)`, causando duplicati visibili agli utenti senza ruolo GDO

## [2.11.053] - 2026-04-07

### Modificato
- **`src/pages/GestioneHub/components/ServiceSharedAssetsEditor.tsx`** — documenti e video ora modificabili anche in modalità `edit-variant` (prima solo `create` e `edit-group`); aggiornato il testo descrittivo per chiarire che in "Modifica gruppo" si aggiornano tutte le varianti mentre in "Modifica variante" si aggiorna solo quella selezionata; messaggio di sola lettura ora specifico per la modalità "Aggiungi variante"

## [2.11.052] - 2026-04-07

### Modificato
- **`src/pages/ServicesDashboard/components/ServiceDetailsModal.tsx`** — hero: bottone "Accedi al servizio" ridimensionato (più compatto: `px-3.5 py-1.5 text-xs`); sfondo arricchito con SVG geometrico inline (griglia di punti, cerchi outline concentrici agli angoli, linea diagonale, rombo decorativo) sovrapposto ai cerchi filled esistenti

## [2.11.051] - 2026-04-07

### Modificato
- **`src/pages/ServicesDashboard/components/ServiceDetailsModal.tsx`** — hero ristrutturato: sfondo scuro (`from-slate-800 to-slate-900`) sempre visibile con cerchi decorativi; layout a due colonne con info servizio a sinistra e video trailer 16:9 nel terzo destro (`w-1/3`, `aspect-video`); controlli video spostati sotto il player; se non c'è trailer mostra l'icona del servizio in placeholder 16:9. Player guide video guide analogamente aggiornato con sfondo e `aspect-video`

## [2.11.050] - 2026-04-07

### Modificato
- **`src/pages/ServicesDashboard/components/ServiceDetailsModal.tsx`** — sezione "Documentazione": rimosso il nome file originale da ogni riga; il titolo del documento è ora in blu hyperlink (`text-blue-600`) con underline e scurimento al hover

## [2.11.049] - 2026-04-07

### Modificato
- **`src/pages/ServicesDashboard/components/ServiceDetailsModal.tsx`** — sezione "Documentazione": rimosso il wrapper con bordo e angoli arrotondati che dava aspetto a card; i documenti sono ora una lista piatta separata solo da divisori sottili (`border-t border-slate-100`), senza contenitore visibile

## [2.11.048] - 2026-04-07

### Modificato
- **`src/pages/ServicesDashboard/components/ServiceDetailsModal.tsx`** — sezione "Documentazione": rimosso il pulsante "Scarica", l'intera riga è ora un `<a>` che apre il documento su Olimpo in nuova scheda (`target="_blank"`); icona `ExternalLink` a destra indica visivamente l'apertura esterna e appare al hover

## [2.11.047] - 2026-04-07

### Modificato
- **`src/pages/ServicesDashboard/components/ServiceDetailsModal.tsx`** — sezione "Documentazione" ridisegnata: rimossa la griglia di card, sostituita con una lista professionale a righe divise da separatori; ogni riga mostra icona tipo file colorata, titolo + nome originale, metadati (pagine, dimensione, badge estensione) allineati a destra, e pulsante "Scarica" con hover invertito (bianco→slate-800); empty state semplificato a riga orizzontale con icona e testo inline

## [2.11.046] - 2026-04-07

### Modificato
- **`server/core/services/HubServiceService.ts`** — `createService` e `bulkCreateService` garantiscono ora che, ad ogni creazione di un servizio, venga sempre generata automaticamente anche la variante per il Superadmin (`tipo_utente: Superadmin`, `ruolo_gdo: null`), a meno che non esista già un record con quel `codice` per il Superadmin. La verifica avviene prima dell'inserimento per evitare violazioni dell'indice univoco `(codice, tipo_utente, ruolo_gdo)`

## [2.11.045] - 2026-04-07

### Modificato
- **`src/pages/ServicesDashboard/components/ServiceDetailsModal.tsx`** — sezione "Documentazione" sempre visibile: quando non sono presenti documenti viene mostrato un avviso inline ambra "Non è presente documentazione per questo servizio" al posto del contenuto vuoto; rimosso l'empty state globale; sezione "Video guide" ristrutturata in layout a due colonne: lista delle guide a sinistra (con evidenziazione della guida attiva) e player 16:9 posizionato a destra (58% della larghezza), evitando che il video occupi l'intera larghezza

## [2.11.044] - 2026-04-03

### Modificato
- **`server/core/middleware/securityMiddleware.ts`** — le attività sospette rilevate da `suspiciousActivityLogger` vengono ora registrate anche nel sistema di audit (`AuditLogService.suspiciousActivity`), con `eventType: SUSPICIOUS_ACTIVITY` e `severity: CRITICAL`; il flush è immediato su PostgreSQL (bypass del buffer da 30s). I `details` salvati in DB includono i flag booleani (`suspiciousUrl`, `suspiciousBody`, `suspiciousQuery`, `suspiciousAgent`), URL, metodo HTTP e user-agent — senza persistere body o headers raw per evitare dati sensibili nel DB

## [2.11.043] - 2026-04-03

### Corretto
- **`server/core/middleware/securityMiddleware.ts`** — escluse le route OIDC (`/auth/oidc/callback` e `/auth/oidc/fake-callback`) dal `suspiciousActivityLogger`: il payload OAuth (authorization code, state, JWT) contiene pattern legittimi (es. `--` nei token base64url, `localhost` nella redirect_uri in dev) che venivano erroneamente rilevati come sospetti, causando blocchi 400 in produzione

## [2.11.042] - 2026-04-03

### Modificato
- **`src/pages/ServicesDashboard/components/ServiceDetailsModal.tsx`** — click-to-pause/play esteso a tutta l'area video: spostato `onClick` dal tag `<video>` al container div sia per il trailer hero che per il `VideoPlayer` delle guide; aggiunto `stopPropagation` sull'overlay dei controlli e sui pulsanti interattivi (chiudi, "Accedi al servizio") per evitare il doppio toggle; il cursore `pointer` viene mostrato su tutta l'area cliccabile

## [2.11.041] - 2026-04-03

### Modificato
- **`src/pages/ServicesDashboard/components/ServiceDetailsModal.tsx`** — redesign completo del modale dettagli servizio: sostituiti tutti gli stili inline con Tailwind CSS; hero section sempre visibile (video trailer in autoplay/muted/loop se disponibile, altrimenti header gradient con icona del servizio); sezione "Trailer" con thumbnail selezionabili (solo se >1 trailer); sezione "Video guide" con player 16:9 dedicato (autoplay senza mute) e thumbnail selezionabili; sezione "Documentazione" con card rich (icona colorata per tipo file — PDF/Excel/Word/CSV, dimensione, numero pagine, pulsante Scarica); stato vuoto se nessun contenuto disponibile; gestione tasto Escape per chiusura; scroll-lock sul body durante apertura; CTA "Accedi al servizio" con 3 stati (normale, in apertura, non disponibile)

## [2.11.040] - 2026-04-03

### Modificato
- **`src/pages/AuditLogDashboard/index.tsx`** — aggiunto stato di caricamento sul bottone "Export CSV" (spinner + testo "Esportazione..." + disabilitazione durante il fetch); aggiunta notifica di errore tramite `useNotification` in caso di risposta non ok o eccezione, eliminando il fallimento silenzioso precedente

## [2.11.039] - 2026-04-03

### Corretto
- **`server/core/repositories/AuditLogRepository.ts`** — rimosso il cap a 200 record per le query di esportazione: aggiunto flag `isExport` nell'interfaccia `AuditLogFilterOptions`; quando attivo, il limite massimo viene portato a 10.000 invece di 200, rendendo funzionale l'export CSV che prima troncava sempre a 200 righe
- **`server/core/controllers/AuditLogController.ts`** — riscritta la generazione del CSV: aggiunta funzione `csvField()` per escaping RFC 4180 corretto (virgolette su campi con `;`, `"` o newline); aggiunto flag `isExport: true` ai filtri; aggiunte colonne "Nome Utente" (nome + cognome già risolti dal service), "ID Utente" e "Ruolo Utente" separate; tradotto il campo `result` in italiano (Successo/Fallimento/Parziale); tradotto il campo `user_type` con etichette italiane per ruolo; campo `Dettagli` ora formattato come coppie `chiave: valore` leggibili invece di JSON grezzo
- **`src/pages/AuditLogDashboard/index.tsx`** — sostituita `window.open()` con `fetch()` + download via Blob/anchor per evitare blocchi popup e gestire correttamente la sessione auth

## [2.11.038] - 2026-04-03

### Corretto
- **`server/core/middleware/securityMiddleware.ts`** — aggiunto `return` dopo l'invio della risposta 400 per richieste sospette in produzione; in precedenza veniva sempre chiamato `next()` anche dopo aver già inviato la risposta, causando l'errore `ERR_HTTP_HEADERS_SENT` nell'error handler

## [2.11.037] - 2026-04-02

### Aggiunto
- **`server/core/agenzia_lib/coopfi/index.ts`** — quando la Coopfi API risponde con HTTP 500/502/503/504 (o status non previsto), viene registrato un evento di audit `SYSTEM_ERROR` con action `COOPFI_SERVICE_DOWN` e severità `HIGH`, contenente endpoint, status code, status text e motivazione, prima di sollevare il `ServiceUnavailableError`

## [2.11.036] - 2026-04-02

### Aggiunto
- **`src/pages/Login/index.tsx`** — gestione del parametro query `message` in pagina di login: il testo viene letto da `?message=...` e mostrato nel banner corrispondente al `reason`; aggiunto caso `reason=logout_success` con banner verde che mostra il messaggio personalizzato; la funzione `dismissReason` ora rimuove sia `reason` che `message` dalla URL al click sulla X

## [2.11.035] - 2026-04-02

### Modificato
- **`src/pages/Api/Plugin/index.tsx`** — testi aggiornati con linguaggio tecnico: descrizione PageHeader, descrizione sezione Filter Template (focus su gestione plugin, non accessibilità API), testo form create/edit
- **`src/pages/GestioneApi/components/plugin/FilterTemplateList.tsx`** — rimosso riferimento a "plugin API" nell'empty state; intestazione lista rinominata in "Filter Template Configurati"
- **`src/pages/GestioneApi/components/plugin/FilterTemplateForm.tsx`** — sezione "Configurazione Endpoint" rinominata in "Sorgente Dati"; "Tipo Endpoint" → "Tipo Sorgente"; "Tipo Rendering" → "Modalità di Rendering"; opzioni dropdown in inglese tecnico (Grid/Carousel/Default); descrizioni dei campi riscritte in linguaggio tecnico (predicati di filtro AND/OR, intervallo di transizione, payload JSON, identificatore runtime, vincolo sorgente)
- **`src/pages/GestioneApi/components/plugin/PluginConfigPanel.tsx`** — "Codice d'esempio" → "Snippet di integrazione"; "Slug" → "Slug (identificatore runtime)"

## [2.11.034] - 2026-04-02

### Corretto
- **`server/core/agenzia_lib/coopfi/index.ts`** — errori HTTP 500/502 della Coop API ora sollevano `ServiceUnavailableError` con messaggio "Il servizio Coop è momentaneamente offline. Si prega di riprovare più tardi." invece di `ExternalApiError` generico; rimosso import `ExternalApiError` non più utilizzato

## [2.11.033] - 2026-04-02

### Corretto
- **`server/core/services/HubServiceService.ts`** — rimossa la forzatura di `ruolo_gdo = null` per i tipi non-GDO in `normalizeServiceInput`: ora tutti i tipi utente (IT, MARKETING, ecc.) possono avere servizi con ruoli specifici (es. IT+ADMIN, IT+IMPIEGATO), coerentemente con le opzioni di target disponibili nel form admin
- **`server/core/services/hubRoleUtils.ts`** — `buildHubUserContext` esteso: per i tipi non-GDO con un ruolo esplicito (es. IT con GDO_IMPIEGATO) il contesto ora include `ruoloGdoKey` e i `roleKeys` corrispondenti, abilitando il filtro per ruolo anche per questi utenti; i tipi non-GDO senza ruolo mantengono il comportamento precedente (solo `tipo_utente`)
- **`server/core/repositories/HubServiceRepository.ts`** — `findActiveForRole` ora applica il filtro per ruolo (con dedup per codice, priorità al record role-specific) a tutti i tipi utente con `ruoloGdoKey`, non solo a GDO; il `tipo_utente` nella query SQL usa il tipo dinamico dell'utente invece di `GDO` hardcoded; rimosso import `TIPO_UTENTI` non più utilizzato
- **`server/core/services/UserService.ts`** — `resolveGdoRuoloKey` ora restituisce `undefined` invece di `'GDO_ADMIN'` quando l'utente non ha una voce in `UtentiGDO` o il record ruolo è privo di nome; eliminata riga `Utente.findOne()` senza `await` inserita accidentalmente; per GDO il default `GDO_ADMIN` è mantenuto via `normalizeGdoRoleKey` in `buildHubUserContext`

## [2.11.032] - 2026-04-02

### Aggiunto
- **`src/pages/GestioneHub/components/ServicesTab.tsx`** — bottone "Modifica" nell'header di ogni gruppo servizio che apre il dialog di modifica gruppo
- **`src/pages/GestioneHub/components/ServicesTab.tsx`** — `editGroupMutation`: gestisce in un'unica operazione aggiornamento bulk delle varianti mantenute, creazione di nuovi target selezionati ed eliminazione delle varianti deselezionate

### Modificato
- **`src/pages/GestioneHub/types.ts`** — aggiunto mode `"edit-group"` a `ServiceDialogMode`; aggiunto campo opzionale `variantsToDelete` a `ServiceMutationPayload`
- **`src/pages/GestioneHub/components/ServiceFormDialog.tsx`** — nuovo mode `"edit-group"`: pre-compila tutti i campi dai dati del gruppo, pre-seleziona tutti i target esistenti, mostra banner danger con lista varianti che verranno eliminate se vengono deselezionate; il pulsante di submit diventa "Salva gruppo"
- **`src/pages/GestioneHub/components/ServicesTab.tsx`** — `handleSave` instrada il mode `"edit-group"` a `editGroupMutation`; se ci sono varianti da eliminare mostra un `ConfirmDialog` prima di procedere

## [2.11.031] - 2026-04-02

### Aggiunto
- **`lib/enums.ts`** — aggiunto `IMPIEGATO` a `RUOLO_UTENTE_GDO` per distinguere gli impiegati dai responsabili nel sistema Coopfi
- **`server/core/agenzia_lib/coopfi/index.ts`** — metodo privato `parseTipoRuoloDaCodicePosizione`: mapping completo dei codici area verso `TIPO_UTENTI` (22 IT + 16 MARKETING) e dei prefissi ruolo verso `RUOLO_UTENTE_GDO` (10 prefissi `ADMIN`: `RES`, `IMR`, `DIR`, `ISP`, `COO`, `COOSGD`, `COS`, `CSF`, `BMR`, `RAA`; 8 prefissi `IMPIEGATO`: `IMP`, `SPC`, `ASS`, `ASD`, `ASR`, `SGD`, `SGF`, `DST`)

### Modificato
- **`server/core/agenzia_lib/coopfi/index.ts`** — logica di registrazione OIDC refactored: rimosso il caso speciale `IMP_APCV` hardcoded; ora tutti i codici posizione noti (`IMP_APCV`, `RES_APCV`, `IMP_COMKTG`, `RES_COMKTG`) vengono risolti genericamente tramite `parseTipoRuoloDaCodicePosizione`, assegnando correttamente `TIPO_UTENTI.IT` o `TIPO_UTENTI.MARKETING` e `RUOLO_UTENTE_GDO.ADMIN` o `RUOLO_UTENTE_GDO.IMPIEGATO`; aggiunto `TIPO_UTENTI.MARKETING` a `TIPI_CON_GDO`

## [2.11.030] - 2026-04-02

### Modificato
- **`lib/types.ts`** — `BulkUpdateHubServicePatch` esteso con tutti i campi modificabili in bulk: `nome`, `descrizione`, `icona`, `colore`, `url`, `tipo_url`, `ordine` (oltre ai 3 booleani già presenti)
- **`src/pages/GestioneHub/types.ts`** — `BulkEditPatch` allineato con i nuovi campi; aggiunto supporto a `tipo_url` con tipo corretto `HubServiceDTO["tipo_url"]`
- **`src/pages/GestioneHub/components/BulkServiceEditDialog.tsx`** — dialog di modifica in blocco completamente ridisegnato: ora gestisce tutti i campi del servizio; i campi booleani usano il sistema tri-state (Non modificare/Sì/No); i campi testo/select/numerici hanno un toggle di abilitazione per-campo; il dialog rileva automaticamente se le varianti selezionate hanno valori uniformi o misti per ogni campo (badge "valori misti"); la sezione target mostra i tipi utente con etichette leggibili e il ruolo GDO formattato; i valori abilitati sovrascrivono completamente quelli esistenti

## [2.11.029] - 2026-04-02

### Aggiunto
- **`server/core/config/index.ts`** — nuova variabile opzionale `FICO_BASE_URL`: URL del gateway d'ingresso del sistema FICO; se configurata viene usata come base per le chiamate external_fico al posto di `service.url`
- **`server/core/controllers/HubController.ts`** — `getFicoContext` ora restituisce anche `base_url` (`FICO_BASE_URL` dalla config oppure `null`)

### Modificato
- **`src/pages/ServicesDashboard/index.tsx`** — click su servizio `external_fico`: `service.url` viene passato come query param `?route=` alla chiamata `GET /hub-services/fico-context` anziché nell'URL finale; il backend lo include nel payload cifrato, così la route non appare mai in chiaro nell'URL aperto
- **`server/core/controllers/HubController.ts`** — `getFicoContext` legge `req.query.route` e lo include nel JSON prima della cifratura: `{ publicKey, codicePosizione, route }`

## [2.11.028] - 2026-04-02

### Aggiunto
- **`src/pages/GestioneHub/components/BulkServiceEditDialog.tsx`** — nuovo dialog per modifiche di massa: mostra i target coinvolti raggruppati per tipo utente (come chip colorati), e permette di impostare in modo tri-state (Non modificare / Sì / No) i campi `attivo`, `in_manutenzione` e `in_evidenza`; solo i campi modificati vengono inviati
- **`src/pages/GestioneHub/components/ServicesTab.tsx`** — selezione multipla varianti tramite checkbox: ogni card variante espansa ha una checkbox individuale, ogni header gruppo ha una checkbox indeterminate che seleziona/deseleziona tutte le varianti del gruppo; action bar contestuale che appare in presenza di selezioni, mostrando i target selezionati come chip e i pulsanti "Modifica in blocco" e "Deseleziona tutto"
- **`server/core/controllers/HubController.ts`** — nuovo endpoint `PATCH /api/hub-services/bulk` con validazione `ids` e `patch`; richiede SUPERADMIN
- **`server/core/services/HubServiceService.ts`** — nuovo metodo `bulkUpdateServices(ids, patch)` che delega al repository e restituisce i DTO aggiornati
- **`server/core/repositories/HubServiceRepository.ts`** — nuovo metodo `bulkUpdate(ids, data)` con `HubService.update` + `Op.in` per aggiornamento atomico in un'unica query SQL
- **`server/core/interfaces/IHubServiceService.ts`** — aggiunto `bulkUpdateServices` all'interfaccia; aggiunto import `BulkUpdateHubServicePatch`
- **`lib/types.ts`** — nuovo tipo `BulkUpdateHubServicePatch` con campi opzionali `attivo`, `in_manutenzione`, `in_evidenza`
- **`src/pages/GestioneHub/types.ts`** — nuovi tipi `BulkFieldValue` e `BulkEditPatch`

## [2.11.027] - 2026-04-02

### Aggiunto
- **`src/pages/GestioneHub/components/ServicesTab.tsx`** — pulsanti "Espandi tutti" / "Comprimi tutti" per espandere o chiudere in un click tutti i gruppi servizio; barra di ricerca per filtrare i gruppi per nome o codice; pills di filtro per stato (Tutti / Attivi / In manutenzione / Inattivi) con empty state dedicato quando nessun risultato corrisponde ai criteri
- **`src/pages/GestioneHub/components/ServiceFormDialog.tsx`** — pulsante "Tutti" per-sezione nella selezione target: seleziona/deseleziona tutti i target disponibili (non già assegnati) di un dato tipo utente; pannello globale con contatore target selezionati e pulsante "Seleziona tutti / Deseleziona tutti" per coprire tutte le sezioni in un colpo solo
- **`src/pages/GestioneHub/components/NewsTab.tsx`** — pills di filtro stato (Tutti / Online / Programmata / Bozza / Scaduta) con contatore per ciascun stato; empty state dedicato quando il filtro non restituisce risultati
- **`src/pages/GestioneHub/types.ts`** — nuovi tipi `ServiceStatusFilter` e `NewsStatusFilter` per tipizzare i filtri delle due tab

## [2.11.026] - 2026-04-01

### Modificato
- **`server/core/services/IstantaService.ts`** — `getStatusImportazione`: quando lo stato dell'importazione è `Terminata`, aggiorna `stato_tracciati` sul record `Tracciati` corrispondente (stesso pattern già usato per lo stato `Scartata`)

## [2.11.025] - 2026-04-01

### Aggiunto
- **`src/pages/ImpostazioniUtente/index.tsx`** — pagina impostazioni account resa pienamente funzionale: form profilo salva e aggiorna il contesto utente con notifica success/error; aggiunto campo Indirizzo Linea 2 (`residenza2` in `UtentiMeta`); badge "Account Esterno" nell'header per utenti OIDC; badge tipo utente nella sezione Tipo di Account
- **`src/pages/ImpostazioniUtente/index.tsx`** — sezione Sicurezza: form cambio password funzionante (con validazione client-side); per utenti esterni (OIDC) mostra Alert informativo al posto del form
- **`src/pages/ImpostazioniUtente/index.tsx`** — sezione Email: form cambio email funzionante; per utenti esterni mostra Alert informativo
- **`src/pages/ImpostazioniUtente/index.tsx`** — sezione Disattivazione Account: per utenti esterni mostra Alert informativo; per utenti interni traduzione completa in italiano
- **`src/pages/ImpostazioniUtente/index.tsx`** — sidebar: link Email, Sicurezza e Disattivazione Account nascosti per utenti esterni; sezioni placeholder (2FA, Cronologia Dispositivi, Servizi Connessi, Link Social Media) con messaggio "funzionalità non ancora disponibile"
- **`server/core/controllers/UserController.ts`** — nuovo endpoint `PUT /api/update_password` autenticato: verifica password attuale, valida coincidenza e lunghezza minima, aggiorna tramite `verifyAndUpdatePassword`
- **`server/core/services/UserService.ts`** — nuovo metodo `verifyAndUpdatePassword`: blocca utenti outsider con `ForbiddenError`, verifica password corrente con bcrypt, delega ad `updatePassword`
- **`lib/types.ts`** — aggiunto campo `residenza2?: string` a `UtentiMeta` per supportare l'indirizzo secondario nel JSONB

### Modificato
- **`src/pages/ImpostazioniUtente/index.tsx`** — traduzione completa in italiano di tutte le sezioni (Notifiche, Preferenze, Disattivazione Account); fix bug Indirizzo Linea 2 che puntava erroneamente allo stato di Indirizzo Linea 1

## [2.11.024] - 2026-04-01

### Aggiunto
- **`src/pages/LavorazioniInCorso/index.tsx`** — aggiunto sistema di ordinamento interattivo per colonne: ogni intestazione (Nome, Scadenza, Valida dal, Valida al, Stato, Visibilità) è ora cliccabile e alterna tra ordinamento ASC e DESC con indicatore visuale a frecce; ordinamento di default per scadenza più vicina (ASC)
- **`src/pages/StoricoLavorazioni/index.tsx`** — stessa funzionalità di ordinamento interattivo per colonne aggiunta alla pagina Storico promozioni

## [2.11.023] - 2026-04-01

### Modificato
- **`CoopfiAgenziaLib`** — se la chiamata con filtro gruppi restituisce array vuoto, viene eseguita una seconda chiamata senza restrizioni: se l'utente esiste ma non appartiene ai gruppi autorizzati viene lanciato `ForbiddenError`; se non è censito nell'AD Coopfi viene lanciato `NotFoundError`

## [2.11.022] - 2026-04-01

### Corretto
- **`src/pages/GestioneUtenti/index.tsx`** — aggiunto import e registrazione del plugin `duration` di dayjs per risolvere `TypeError: D.default.duration is not a function` in produzione; aggiunti i case mancanti `TIPO_UTENTI.MARKETING` e `TIPO_UTENTI.IT` in entrambi gli switch di visualizzazione tipo utente (lista tabella e pannello dettaglio) per evitare la visualizzazione di "Unknown"

## [2.11.021] - 2026-04-01

### Modificato
- **`CoopfiAgenziaLib`** — aggiunto filtro `"gruppi":{"$in":["GA1040_Marketing","GA1040_BUSINESS_CATEGORY","GA1040_Admin"]}` a entrambe le query di ricerca utenti AD (per `azure_id` e per `mail`) per limitare l'accesso ai soli membri dei gruppi autorizzati

## [2.11.020] - 2026-04-01

### Corretto
- **`src/router/index.tsx`** — spostati `/auth/*` e `/auth-ad/*` prima del root layout `/` per evitare che il catch-all `path: "*"` del layout intercettasse queste route pubbliche; cambiato pattern da `/:context` a `/*` (splat) per gestire correttamente i contesti cifrati Base64 che contengono slash nel path
- **`src/router/loaderFunctions.ts`** — aggiornati `funzioneCaricamentoAuth` e `funzioneCaricamentoAuthAD` per leggere il contesto da `params["*"]` invece di `params.context`, in accordo con il nuovo pattern splat

## [2.11.019] - 2026-03-31

### Aggiunto
- **`lib/enums.ts`** — aggiunto `IT = "IT"` a `TIPO_UTENTI` e `ADMIN = "ADMIN"` a `RUOLO_UTENTE_GDO`
- **`CoopfiAgenziaLib`** — gestione codice posizione `IMP_APCV`: utente registrato come tipo `IT` con ruolo `ADMIN`; helper privato `findOrCreateRuolo` che usa `findOrCreate` come fallback per tutti i ruoli (ADMIN, Marketing, Admin, ecc.) evitando errori se il record non esiste in DB
- **`CoopfiAgenziaLib` / `DefaultAgenziaLib`** — aggiunto `TIPO_UTENTI.IT` a `TIPI_CON_GDO` per la corretta risoluzione dell'associazione GDO al login

## [2.11.018] - 2026-03-31

### Aggiunto
- **`CoopfiAgenziaLib`** — recupero foto profilo da Microsoft Graph API (`/users/{oid}/photo/$value`) durante il login OIDC; token Graph ottenuto via `client_credentials` direttamente da Azure AD (`login.microsoftonline.com/{tid}/oauth2/v2.0/token`) con scope `https://graph.microsoft.com/.default`; foto salvata come data URL base64 in `meta.photo` per nuovi utenti (BUSINESS_CATEGORY e GDO) e aggiornata al login per utenti esistenti (solo se cambiata); fallimento silenzioso in caso di 404 o assenza di permessi

## [2.11.017] - 2026-03-31

### Modificato
- **`GestioneHub/types.ts`** — `ServiceTargetOption.category` cambiato da `"base" | "gdo_generic" | "gdo_specific"` a `"base" | "with_role"` per riflettere il nuovo sistema di combinazione universale
- **`GestioneHub/utils.ts`** — `buildServiceTargetOptions` ora genera una matrice completa tipo×ruolo: ogni tipo utente (Agenzia, Category, Marketing, Punto Vendita, GDO) può essere abbinato a qualsiasi ruolo GDO o lasciato senza ruolo; rimosso il vecchio trattamento speciale GDO; aggiornato `getServiceTargetLabel` per gestire il nuovo schema (ex "GDO generico" → "GDO")
- **`GestioneHub/ServiceFormDialog.tsx`** — sezione target ora raggruppata per tipo utente (una sezione per Agenzia, Category, Marketing, etc.) anziché nelle tre sezioni "base / GDO generico / GDO con ruolo"; contatore selezione per sezione; descrizione aggiornata

## [2.11.016] - 2026-03-31

### Modificato
- **`GestioneHub/utils.ts`** — rimossi `Superadmin` e `Guest` dai target base dei servizi Hub (`BASE_SERVICE_TARGETS`) e dai destinatari delle news (`NEWS_ROLE_TARGETS`); aggiunta `SERVICE_COLOR_MAP` e `getServiceColorClasses()` per la mappatura colore→classi Tailwind
- **`GestioneHub/index.tsx`** — badge contatore su ciascun tab (servizi / news); descrizione pagina aggiornata per riflettere l'esclusione di Superadmin e Guest; layout tab panel semplificato (rimosso box wrapper ridondante)
- **`GestioneHub/ServicesTab.tsx`** — icona gruppo colorata in base al campo `colore` del servizio; bordo sinistro colorato per ogni card gruppo; statistiche attivi/manutenzione inline nell'header del gruppo; variant card ridisegnate con layout più compatto e pill stato separate per Attivo/Disattivo, In manutenzione, In evidenza
- **`GestioneHub/NewsTab.tsx`** — news ordinate per priorità di stato (online → programmata → bozza → scaduta) poi per data decrescente; contatori di stato nell'header (online, programmate, bozze, scadute); card news ridisegnate con footer informativo distinto, pulsanti icona nell'header e pulsante "Modifica" nel footer
- **`GestioneHub/ServiceFormDialog.tsx`** — etichette sezione target aggiornate per riflettere i nuovi target disponibili (senza Superadmin/Guest)

## [2.11.015] - 2026-03-31

### Modificato
- **`Echo/index.tsx`** — rimosso il pulsante ArrowLeft dal logo header; eliminata la logica hover-to-expand (`compactMenuOnHover`); il toggle della sidebar è ora gestito da un unico pulsante `PanelLeftClose` sempre visibile nella topbar (ruota a 180° in modalità collapsed); su desktop gestisce il compact mode, su mobile apre/chiude il menu mobile; rimosse classi `side-menu--on-hover` e relative varianti CSS

## [2.11.014] - 2026-03-31

### Modificato
- **`Echo/index.tsx`** — sidebar sinistra ora attaccata al bordo dell'interfaccia: rimosso padding `xl:py-3.5 xl:pl-3.5` e angoli arrotondati `xl:rounded-xl` dal pannello interno; il menu si estende a tutta l'altezza della viewport senza margini; aggiunto `border-r` per separazione visiva dal contenuto e `border-b` sull'area logo
- **`echo.css`** — in modalità collapsed le icone del menu sono ora centrate orizzontalmente tramite `justify-content: center`; aggiunto sizing esplicito `1.125rem` per le icone del menu (`side-menu__link__icon`)

## [2.11.013] - 2026-03-31

### Modificato
- **`GestionePermessi/index.tsx`** — aggiunto `MARKETING` nei tipi gestibili; selettore "Ruolo" ora visibile per tutti i tipi (non solo GDO); query `ruoli-gdo-permessi` abilitata per qualsiasi tipo selezionato; label aggiornate (rimosso "GDO" dai testi)
- **`GestionePermessi/MenuTab.tsx`** — aggiunto `MARKETING` nei tipi menu; selettore "Ruolo" visibile per tutti i non-SUPERADMIN; rimosso blocco empty-state "seleziona ruolo GDO" che impediva la modifica del menu per GDO senza sotto-ruolo; info banner aggiornato
- **`seedPermessi.ts`** — aggiunti permessi default per `MARKETING` (dashboard, promozioni, volantini, materiali, contenuti digitali; azioni: visualizza, download)

## [2.11.012] - 2026-03-31

### Modificato
- **`utenti_gdo` (modello Sequelize)** — aggiunto indice UNIQUE su `id_utente_utentegdo`: ogni utente non-SUPERADMIN è ora legato a esattamente una GDO
- **`UserService`** — sostituita la costante `tipiConGDO = [GDO, SUPERADMIN, AGENZIA, CATEGORY]` con la regola `tipo !== SUPERADMIN`: GDO obbligatoria, validazione login, creazione associazione e risoluzione ruolo ora si applicano a **tutti** i tipi tranne SUPERADMIN (inclusi PUNTOVENDITA, MARKETING, GUEST)
- **`UserService.login`** — i tipi MARKETING e GUEST ora includono `id_gdo` nella risposta di login; aggiunti branch espliciti per MARKETING/GUEST nel `selectedUserType` e nell'auto-detect; PUNTOVENDITA ora restituisce `id_gdo` anche nel branch `selectedUserType`
- **`UserService.user_menu`** — `resolveGdoRuoloKey` ora viene chiamata per tutti i tipi non-SUPERADMIN (non solo GDO)
- **`GestioneUtenti/index.tsx`** — selettore GDO e selettore Ruolo ora visibili per tutti i tipi tranne SUPERADMIN; schema Yup `gdoScelta` richiesto per tutti non-SUPERADMIN; label "Ruolo GDO" → "Ruolo (opzionale)"; tutti gli handler di submit aggiornati di conseguenza
- **`migrateUtentiGDO.ts`** — script di backfill esteso a tutti i tipi non-SUPERADMIN (non solo SUPERADMIN/AGENZIA)

## [2.11.011] - 2026-03-30

### Modificato
- **`NewsCard`** — redesign completo per usare tutti i campi di `HubNewsDTO`: bordo sinistro colorato per tipo (`info`=blu, `warning`=ambra, `success`=verde, `update`=viola); badge tipo con icona e label testuale; badge `in_evidenza` ambra con icona Star; icona tipizzata con sfondo colorato; footer con `data_scadenza` (icona Clock, solo se presente); link "Leggi di più" colorato per tipo; separatore footer; layout `flex flex-col` con `grow` sul contenuto per altezza uniforme
- **`NewsCardSkeleton`** — aggiornato per riflettere il nuovo layout (badge row, icona, 3 righe contenuto, footer con border-t)

## [2.11.010] - 2026-03-30

### Aggiunto
- **`OlympusUserPolicyRuolo`** (`lib/types.ts`) — nuovo tipo condiviso per la struttura ad albero dei ruoli inviata a Olympus; nodo ricorsivo con `nodeType`, `nodeValue`, `children`, `codificaFP`
- **`buildRuoliTree`** (`coopfi/utility/ruoli-tree.ts`) — funzione che converte il `codicePosizione` Coopfi in un albero `OlympusUserPolicyRuolo[]` usando il parsing esistente; gerarchia: `Settore` (ruolo) → `Reparto` (segmenti annidati) → `Area` (foglia opzionale); `codificaFP` contiene la descrizione del ruolo per il Settore, i settori FP mappati per i Reparti, la descrizione area per il nodo Area
- **Invio `ruoli` a Olympus** — campo `ruoli` aggiunto in `campi_policy` di `CoopfiAgenziaLib.initOlympusPassport`; la logica rimane incapsulata dentro AgenziaLib, `ServerUtils` non è coinvolto

## [2.11.009] - 2026-03-30

### Modificato
- **`registerUserWithTransaction` (UserService + IUserService)** — campo `password` reso opzionale (`password?: string`): se assente, `password_utenti` viene salvato come `null` e il bcrypt hash viene saltato; consente la registrazione di utenti OIDC senza password locale
- **`CoopfiAgenziaLib`** — rimossi `password: DEFAULT_OIDC_PASSWORD` e `password: uuidv4()` dalle chiamate a `registerUserWithTransaction`; rimossa la costante `DEFAULT_OIDC_PASSWORD` e l'import `uuidv4` (non più necessari)

## [2.11.008] - 2026-03-30

### Aggiunto
- **Supporto `objectidentifier` URI in `OidcService.validateIdToken`** — estrazione dell'Azure OID anche dal claim URI completo `http://schemas.microsoft.com/identity/claims/objectidentifier` (token legacy/multi-tenant Microsoft), con fallback sul claim corto `oid`
- **Campo `azure_id` in `CoopfiUtenteCensito`** — aggiunto al tipo e alla projection dell'API Coopfi

### Modificato
- **`IAgenziaLib.parseUtenteOIDC`** — il contratto dell'interfaccia non ritorna più `null`: lancia errori tipizzati (`NotFoundError`, `ForbiddenError`, `UnauthorizedError`, `ServiceUnavailableError`, `RateLimitError`, `ExternalApiError`) per ogni casistica di fallimento
- **`DefaultAgenziaLib.parseUtenteOIDC`** — sostituito il `return null` con un `throw new NotFoundError` quando l'utente non è trovato, in coerenza con il nuovo contratto
- **`HubController.oidcCallback`** — rimosso il controllo `if (!parsed)` (non più necessario); aggiunto metodo privato `oidcErrorRedirect()` che mappa gli errori tipizzati in `reason` distinti: `oidc_user_not_found`, `oidc_access_denied`, `oidc_service_unavailable`, `oidc_rate_limited`, `oidc_external_error`, `oidc_error` (fallback)
- **`SessionExpiredBanner`** — aggiunti banner per i nuovi reason codes OIDC: account non trovato (arancione), accesso negato (rosso), servizio non disponibile (giallo), limite richieste (giallo), errore servizio esterno (rosso)
- **`CoopfiAgenziaLib.fetchUtenteCoopfiCensito`** (ex `fetchUtenteCoopfiCensitoByEmail`) — ricerca primaria per `azure_id` (match esatto sull'OID Azure) quando `oid` è presente nei claims OIDC; fallback su regex `mail` se `oid` è assente; `_l` ridotto a 1 (ricerca univoca); `azure_id` aggiunto alla projection

## [2.11.006] - 2026-03-27

### Modificato
- **`getFiltriFromUtenteCoop` in `CoopfiAgenziaLib`** — rimossa la mappa statica `MAPPING_PER_RICAVO_FILTRI`; i filtri utente vengono ora derivati dinamicamente tramite `parseFullInput` (segmenter) usando i nuovi codici reparto/area/ruolo/settore. Ogni `SettoreFinale` risultante viene mappato in un `FilterCondition` con `field: "reparto"`, `operator: "equals"`, `value: settore`. Se nessun settore corrisponde, viene restituito un array vuoto.
- **`codice_posizione` inviato a Olympus `/auth/getPassport`** — sia `initOlympusPassport` (CoopfiAgenziaLib) che `getPassportFromOlympo` (ServerUtils) ora includono `codice_posizione` (da `utente.meta_utenti.codice_posizione`) accanto ai `gruppi` nel campo `policy`/`campi_policy` del body.

## [2.11.005] - 2026-03-27

### Aggiunto
- **Sfondo animato Vanta.js su pagina Login (HubLogin)** — effetto `VANTA.WAVES` con onde blu navy caricate via CDN (Three.js r134 + Vanta.js), sostituisce il gradiente CSS statico in `HubBackground.tsx`
- **Sfondo animato Vanta.js su pagina Hub (ServicesDashboard)** — effetto `VANTA.NET` con rete di nodi su sfondo chiaro, sostituisce il layering di gradienti CSS precedente
- **Hook `useVantaEffect`** (`src/hooks/useVantaEffect.ts`) — inizializza e distrugge effetti Vanta su un `ref` React, con guard per SSR e cleanup automatico
- **Dichiarazioni TypeScript per `window.VANTA`** in `src/global.d.ts` — tipi `VantaStatic`, `VantaEffectInstance`, `VantaEffectOptions` per sicurezza tipologica
- **Script CDN in `index.html`** — Three.js r134 e Vanta `waves`/`net` caricati prima del bundle React come script sincroni bloccanti

## [2.11.004] - 2026-03-27

### Aggiunto
- **Campo `policy.gruppi` nel body del passport Olympus** — sia `initOlympusPassport` (CoopfiAgenziaLib) che `getPassportFromOlympo` (ServerUtils) ora inviano i gruppi AD dell'utente nella chiave `policy.gruppi` del body inviato a `/auth/getPassport`

### Modificato
- **Gestione ruolo `BUSINESS_CATEGORY` in `CoopfiAgenziaLib.parseUtenteOIDC`** — se il ruolo parsed dai gruppi AD è `BUSINESS_CATEGORY`, il nuovo utente viene registrato con `tipo_utente = CATEGORY` senza inserire il ruolo GDO, mantenendo l'associazione GDO
- **`TIPO_UTENTI.CATEGORY` aggiunto alle liste GDO in `UserService.registerUserWithTransaction`** — gli utenti di tipo `CATEGORY` ora passano la validazione GDO e ottengono l'associazione `UtentiGDO` (senza ruolo)

## [2.11.003] - 2026-03-27

### Aggiunto
- **Gestione `tipo_url = external_fico`** in `ServicesDashboard/index.tsx` — al click su un servizio FICO, il frontend chiama `GET /api/hub-services/fico-context`, riceve il contesto criptato e apre `<url>?context=<encrypted>` in una nuova scheda
- **Endpoint `GET /api/hub-services/fico-context`** in `HubController.ts` — recupera la `publicKey` tramite Olympus `getPassport`, la combina con il `codicePosizione` di sessione, cifra il payload JSON con `FICO_SECRET` (3DES ECB) e restituisce `{ context }`
- **Inizializzazione chiavi Olympus al primo login OIDC** in `CoopfiAgenziaLib` — per i nuovi utenti registrati via OIDC, viene chiamato `initOlympusPassport` che contatta `OLYMPUS_IP_ADDRESS/auth/getPassport`, salva la `private_key` nel record utente e la restituisce nella sessione
- **Campo `codice_posizione` nel tipo `ParsedOIDCUtente`** e nella sessione (`SessionData`) — propagato da `CoopfiAgenziaLib` alla sessione via `HubController.oidcCallback`
- **Campo `codice_posizione` in `UtentiMeta`** (`lib/types.ts`) — salvato nel `meta` al momento della registrazione e aggiornato se cambia nei login successivi

### Modificato
- **`CoopfiAgenziaLib.parseUtenteOIDC`** — aggiornamento meta utenti esistenti ora usa `...userExist.meta` per preservare `filtri_utente` e tutti gli altri campi; aggiorna sia `gruppi_ad` che `codice_posizione` se cambiati

## [2.11.002] - 2026-03-27

### Aggiunto
- **Cache token Coopfi in-memory** in `server/core/agenzia_lib/coopfi/index.ts` — il token OAuth (`access_token`) viene salvato e riusato fino a scadenza (`expires_in`), con safety window e deduplica delle richieste concorrenti al token endpoint

### Modificato
- **Request token Coopfi in formato `x-www-form-urlencoded`** — autenticazione aggiornata a `URLSearchParams` con header `Content-Type: application/x-www-form-urlencoded`, coerente con i requisiti dell'endpoint `/oauth/azure-ad/token`
- **Refresh token Coopfi su `401`** — se la chiamata utenti AD fallisce con token scaduto/non valido, la cache viene invalidata e viene effettuato un retry singolo con token rigenerato

### Corretto
- **Fix Sequelize associazione ruolo GDO** — in `server/core/services/MenuCacheService.ts` il recupero ruolo utente GDO non usa più `include` dipendente da alias, ma due query robuste (`utenti_gdo` -> `ruolo_utente_gdo`), risolvendo l'errore `'ruolo_utente_gdo is not associated to utenti_gdo!'`
- **Cambio utente Hub senza dati stale** — su login/logout vengono cancellate le query React Query della dashboard (`hubUserInfo`, `hubServices`, `hubNews`) mantenendo `useNavigate`, così il contenuto si aggiorna subito con il nuovo utente

## [2.11.001] - 2026-03-26

### Aggiunto
- **~55 nuovi ErrorCodes domain-specific** in `ErrorCodes.ts` — codici per promozioni (`PRM_*`), WhatsApp (`WA_*`), design/runtime kit (`KIT_*`, `RTK_*`), file (`FIL_*`), ordini stampa (`ORD_*`), referenze (`REF_*`), config (`CFG_*`), token effimeri (`EPH_*`), CSRF (`SEC_*`), OIDC (`OIDC_*`), GPT (`AI_*`), GDO, email, formato, naming convention, tipo export, WebPliant, punto vendita, area/canale, tracciato, webhook, contratto, raccoglitore, attivita, menu
- **`sendAppError()` utility** in `errorUtils.ts` — helper per middleware che devono rispondere direttamente con errori strutturati senza passare per `next(err)`
- **Hook `useErrorHandler`** (`src/hooks/useErrorHandler.ts`) — hook React per gestione errori consistente nelle mutazioni, usa `CustomError.getUserMessage()` e mostra notifiche appropriate in base al tipo di errore
- **Mapping completo codici errore nel client** — aggiornato `errorMapping` e `errorCodeMap` in `server_call.ts` con tutti i nuovi codici per classificazione precisa degli errori lato client

### Modificato
- **Refactoring completo errori backend** — sostituiti tutti i `throw new Error(...)` con classi strutturate (`NotFoundError`, `BusinessError`, `ValidationError`, `BadRequestError`, `UnauthorizedError`, `ForbiddenError`, `ExternalApiError`, `DatabaseError`) in: WhatsAppService, KitRuntimeService, EphemeralTokenService, OidcService, PuntoVenditaService, MenuCacheService, WhatsappQueueService, ExternalApiService, OrdiniStampaService, TracciatoService, LogService, e tutti gli altri servizi con errori raw
- **Refactoring errori middleware** — tutti gli 8 middleware con risposte JSON ad-hoc ora usano errori strutturati: `csrfProtection` (SEC_* codes via `next(err)`), `originWhitelistMiddleware`, `browserSecurityMiddleware`, `ephemeralTokenAuthMiddleware`, `ephemeralRateLimitMiddleware` (via `sendAppError`), `rateLimiter` (con `limitType` e `retryAfter`), `userRoleGuard`, `permissionGuard` (via `next(err)`)
- **Refactoring errori controller** — eliminati `throw new Error(...)` in ContrattoTipografiaController (porta FTP), DesignKitController (area/canale), UserController (export dati)
- **Refactoring errori WhatsappQueueWorker** — sostituiti errori raw con `NotFoundError`, `ValidationError`, `ExternalApiError`, `BusinessError`
- **Fix `errorHandler.ts`** — errori non-AppError ora wrappati con `wrapExternalError` prima della serializzazione, garantendo che ogni risposta includa il campo `source` (discriminante usato da `server_call.ts`)
- **Fix `BaseController.handleError()` path 3** — errori sconosciuti (non-Error) ora wrappati con `wrapExternalError` anziché rispondere con JSON senza `source`
- **Fix errore CORS in `cors.ts`** — `callback(new Error(...))` sostituito con `ForbiddenError` strutturato
- **Fix handler 404 in `middlewares.ts`** — risposta ad-hoc sostituita con `NotFoundError` serializzato
- **Rimosso error swallowing in React Query** — eliminati 50 blocchi `try/catch` dai `queryFn` in `query.tsx` che inghiottivano errori restituendo `[]`/`null`/`{}`. Gli errori ora propagano correttamente a React Query (`isError`, `error`, retry automatico)
- **Unificazione notifiche dashboard** — sostituito `react-toastify` con `NotificationContext` in `useDashboardLayout` e `useDashboardPlugins`, rimosso `ToastContainer` da `main.tsx`
- **Foto profilo utente** — aggiunto limite massimo di `2MB` validato sia lato client che lato server; la rimozione foto ora persiste correttamente eliminando il campo `meta.photo`

## [2.10.007] - 2026-03-25

### Aggiunto
- **Sistema AgenziaLib per logiche custom per cliente** — introdotto il pattern `agenzia_lib` che permette di caricare moduli con logica diversa per ogni cliente (es. `coopfi`, `conadcno`) in base alla variabile d'ambiente `CLIENT_ID`. Il modulo viene caricato dinamicamente all'avvio e registrato nel container Inversify
- **`parseUtenteOIDC` in AgenziaLib** — estratta la logica di risoluzione utente OIDC (lookup email, determinazione tipo utente e id_gdo) dal `HubController` nell'implementazione `DefaultAgenziaLib`, pronta per essere sovrascritta per cliente
- **Variabile d'ambiente `CLIENT_ID`** — aggiunta allo schema Zod di configurazione con default `"default"`

### Modificato
- **`HubController.oidcCallback`** — refactoring per delegare il parsing utente OIDC ad `AgenziaLib.parseUtenteOIDC` invece di gestirlo inline
- **`initializeContainer` ora asincrono** — necessario per supportare il dynamic import del modulo AgenziaLib al bootstrap. Aggiornati di conseguenza `createControllers`, `createHttpApp` e `applyRoutes`

## [2.10.006] - 2026-03-25

### Modificato
- **Sfondo Hub con carattere** — sostituito lo sfondo piatto bianco con fascia gradient tema in alto, glow radiali intensi (`theme-1`/`theme-2` al 10-12% opacity), e dot grid decorativa a puntini tema. Lo sfondo ora ha profondità e personalità pur mantenendo la leggibilità dei contenuti
- **Footer Hub rinnovato** — il footer ora include un divider gradient, il mini-logo Singular Lab con gradiente tema, testo di branding più leggibile e la riga copyright con anno dinamico

## [2.10.005] - 2026-03-25

### Aggiunto
- **Rimozione foto profilo** — aggiunto pulsante X sull'avatar nella pagina Impostazioni Utente per consentire la rimozione della foto profilo, visibile solo quando una foto è impostata

## [2.10.004] - 2026-03-25

### Modificato
- **Icone auth provider flessibili** — il campo `icona` degli auth provider ora supporta sia nomi icona Lucide che stringhe base64 (`data:image/...`) o URL immagine. La colonna DB è stata cambiata da `VARCHAR(50)` a `TEXT`. Il `ProviderCard` rileva automaticamente il tipo e renderizza un `<img>` per base64/URL o il componente `Lucide` per i nomi icona

## [2.10.003] - 2026-03-25

### Modificato
- **Log di produzione semplificati** — in produzione i log mostrano solo il messaggio con colori ANSI, senza timestamp, livello, pid, hostname e oggetti JSON aggiuntivi. In development il formato resta invariato

## [2.10.002] - 2026-03-25

### Corretto
- **Fix warning "component suspended while responding to synchronous input"** — wrappato `navigate()` con `startTransition()` nelle pagine `AuthAD`, `Auth` e nel tema `Echo` per evitare che la navigazione verso route lazy-loaded (es. `/hub`) sostituisca la UI con un loading indicator

## [2.10.001] - 2026-03-24

### Aggiunto
- **Supporto autenticazione OIDC (Microsoft Entra ID)** — nuovo `OidcService` con flusso Authorization Code + PKCE (S256), validazione JWT tramite JWKS, cache chiavi pubbliche, protezione CSRF via `state` e replay protection via `nonce`
- **Endpoint `GET /api/auth/oidc/authorize/:codice`** — genera l'authorize URL completo con parametri PKCE, state e nonce salvati in sessione. Il frontend chiama questo endpoint e fa redirect all'URL ricevuto
- **Endpoint `GET /api/auth/oidc/callback`** — callback OIDC che riceve il code dal provider, scambia per token, valida l'id_token, cerca l'utente per email nel database, crea la sessione e redirige a `/hub`
- **Interfaccia `IOidcService`** — contratto per il servizio OIDC con metodi `generateAuthorizeParams`, `exchangeCodeForTokens`, `validateIdToken`
- **Provider Entra ID nel seed** — template pre-configurato in `seedHubData.ts` (disattivato di default, configurabile via variabili d'ambiente `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET`)
- **Campi sessione OIDC** — aggiunti `oidc_state`, `oidc_nonce`, `oidc_code_verifier`, `oidc_provider_code` in `SessionData`
- **Banner errore OIDC** — `SessionExpiredBanner` gestisce il reason `oidc_error` con messaggio dal provider
- **Loading state OIDC** — `ProviderCard` mostra spinner e "Connessione in corso..." durante la preparazione dell'authorize URL
- **Dipendenza `jose`** — libreria per validazione JWT e JWKS (zero dipendenze, standard IETF)
- **Documentazione** — `docs/AuthProvider-EntraID.md` con guida completa: architettura, schema DB, flusso OIDC, configurazione Azure Portal, checklist attivazione

### Modificato
- **`HubController`** — accetta ora `OidcService` e `AuthProviderRepository` opzionali nel costruttore per gestire il flusso OIDC
- **`HubLogin` frontend** — i provider OIDC ora chiamano il backend per generare l'authorize URL sicuro (con PKCE) invece di fare redirect diretto a `config_client.authorize_url`

## [2.9.007] - 2026-03-24

### Corretto
- **Fix servizi Hub non visibili per utenti GDO con ruolo** — rimosso constraint `unique: true` sulla colonna `codice` del modello `hub_services` che impediva l'inserimento di più record per lo stesso servizio con diversi `tipo_utente`/`ruolo_gdo`. L'unicità è correttamente garantita dall'indice composito `idx_hub_service_codice_tipo_ruolo`

## [2.9.006] - 2026-03-24

### Modificato
- **Gestione servizi Hub per tipo utente e ruolo GDO** — la tabella `hub_services` ora ha record singoli per ogni combinazione `tipo_utente` + `ruolo_gdo` invece di un unico record con `ruoli_ammessi` JSONB. Ogni tipo utente (Superadmin, Agenzia, GDO, PuntoVendita, Guest, Category) e ruolo GDO (AMMINISTRATORE_DELEGATO, DEVELOPER) ha il proprio record con configurazione indipendente (attivo, descrizione, in_evidenza, ordine, ecc.)
- **Nuovo indice composito** — `idx_hub_service_codice_tipo_ruolo` su `(codice, tipo_utente, ruolo_gdo)` sostituisce il precedente indice unico su `codice`
- **Query ottimizzata per ruolo** — il filtro servizi avviene a livello DB con `WHERE tipo_utente = ?` invece che in-memoria con `matchesHubRoles()`. Per utenti GDO, il record con `ruolo_gdo` specifico ha priorità su quello generico (NULL)

### Aggiunto
- **Creazione bulk servizi** — nuovo endpoint `POST /api/hub-services/bulk` per creare un servizio per più tipi utente in una sola richiesta
- **Vista admin raggruppata** — nuovo endpoint `GET /api/hub-services/admin` che restituisce tutti i servizi raggruppati per codice
- **Eliminazione per codice** — nuovo endpoint `DELETE /api/hub-services/by-code/:codice` per eliminare tutti i record di un servizio

### Rimosso
- **Campi `ruoli_ammessi` e `descrizioni_per_ruolo`** dalla tabella `hub_services` — sostituiti dal sistema per-record con `tipo_utente` e `ruolo_gdo`

## [2.9.005] - 2026-03-24

### Aggiunto
- **Sezione News nell'Hub** — nuova tabella `hub_news` con modello Sequelize, repository, service e controller (`GET/POST/PUT/DELETE /api/hub-news`). Le news supportano filtro per ruolo, date di pubblicazione/scadenza, priorità (in_evidenza) e categorie visive (info, warning, success, update)
- **Servizi In Evidenza** — nuovo campo `in_evidenza` nella tabella `hub_services` per visualizzare servizi featured con card graduate a larghezza piena nella sezione dedicata
- **Descrizioni per ruolo** — nuovo campo `descrizioni_per_ruolo` (JSONB) nella tabella `hub_services`. Il server risolve la descrizione corretta in base al tipo utente, con fallback sulla descrizione di default
- **FeaturedServiceCard** — nuovo componente card grande con gradient, icona prominente e CTA per servizi in evidenza
- **NewsCard** — nuovo componente card news con bordo laterale colorato per categoria, badge "Importante", data e link "Leggi di più"
- **Seed news di benvenuto** — il seed automatico crea una news di benvenuto al primo avvio

### Modificato
- **Icone base64 per servizi e news** — il campo `icona` di `hub_services` è stato ampliato da `STRING(50)` a `TEXT` per supportare data URI base64 (`data:image/...;base64,...`). Backward compatible: i nomi Lucide esistenti continuano a funzionare
- **Redesign completo della Dashboard Hub** — layout rinnovato con sezione "In evidenza", sezione "Novità e aggiornamenti", grid servizi migliorata con bordo colorato laterale e badge status. Welcome banner con saluto basato sull'ora, data in italiano, conteggio servizi
- **ServiceCard migliorata** — bordo laterale colorato per tema, badge status riposizionato, CTA contestuale (Accedi/Apri), icone dual-mode (Lucide o base64)
- **UserWelcome migliorato** — saluto contestuale (Buongiorno/Buon pomeriggio/Buonasera), data formattata in italiano, conteggio servizi, elementi decorativi glassmorphism

## [2.9.004] - 2026-03-24

### Modificato
- **Pagina Recupero Password intelligente** — la pagina `/recupero-password` ora verifica i provider di autenticazione attivi. Se esiste un provider `internal` mostra il form email per il recupero classico; se ci sono solo provider esterni (OIDC, SAML, custom) mostra le card dei provider con link al rispettivo servizio di reset password. Se misti, mostra entrambi separati da un divisore "oppure"
- **Stile glassmorphism per Recupero Password** — la pagina adotta lo stesso design della nuova pagina di login hub (background gradient animato, card con backdrop-blur, bordi arrotondati)
- **Campo `password_reset_url` nel tipo `AuthProviderDTO`** — aggiunto campo opzionale `config_client.password_reset_url` per consentire ai provider esterni di specificare l'URL di reset password

## [2.9.003] - 2026-03-24

### Modificato
- **Flusso login hub-first** — dopo il login tutti gli utenti vengono reindirizzati a `/hub` invece che alla start_page specifica. La risoluzione della start_page avviene solo dalla dashboard hub quando l'utente clicca sul servizio Fidelity Promotion

### Corretto
- **Errore SQL 22P02 nella risoluzione menu** — corretto passaggio chiavi ENUM maiuscole (`'SUPERADMIN'`) alla colonna `tipo_utente` del DB che accetta valori PascalCase (`'Superadmin'`). Rimossa risoluzione menu dal login e corretta in `HubController.resolveStartPage()`
- **Doppio prefisso `GDO_GDO_` nella risoluzione start_page hub** — `resolveGdoRuoloKey()` restituiva già `'GDO_ADMIN'`, ma `resolveStartPage()` aggiungeva un secondo prefisso `'GDO_'`. Corretto per usare il valore già prefissato

## [2.9.002] - 2026-03-24

### Modificato
- **Redirect login basato su `start_page` del menu per tutti i tipi utente** — il metodo `checkLoginForMultipleUsers` ora cerca la `start_page` dal menu anche per Superadmin, Agenzia e PuntoVendita (prima solo GDO lo faceva). Ogni tipo utente viene rediretto alla propria pagina iniziale configurata nel menu
- **Hub Services: URL dinamico per FP** — l'endpoint `GET /api/hub-services` ora risolve l'URL del servizio Fidelity Promotion in base al menu e `start_page` dell'utente loggato, invece di usare un URL statico
- **Fallback login frontend migliorato** — il fallback da `/hub` sostituito con `getDefaultLandingByType()` che restituisce la pagina corretta per tipo utente (es. `/superadmin/dashboard` per Superadmin)

## [2.9.001] - 2026-03-24

### Aggiunto
- **Hub Login con provider dinamici** — nuova pagina di login standalone (`/login`) con design glassmorphism, background gradient animato e lista dinamica di provider di autenticazione caricati dal backend. Supporta provider interni (email/password) e futuri provider esterni (OIDC, SAML, custom). Form email/password si espande inline con animazione
- **Dashboard Servizi post-login** — nuova pagina standalone (`/hub`) che mostra i servizi/applicazioni disponibili per il ruolo dell'utente in una griglia responsive con card animate. Include welcome banner con info utente e logout, status attivo/manutenzione per servizio, redirect interno o esterno
- **Backend Auth Providers** — nuovo modello Sequelize `auth_providers` con CRUD completo, repository, service, controller (`GET/POST/PUT/DELETE /api/auth-providers`). Provider configurabili con icona, tipo, ordine, filtro per ruolo. Campo `config_server` per segreti mai esposti al client
- **Backend Hub Services** — nuovo modello Sequelize `hub_services` con CRUD completo, repository, service, controller (`GET/POST/PUT/DELETE /api/hub-services`). Servizi configurabili con icona, colore, URL, tipo redirect, stato manutenzione, filtro per ruolo
- **Seed automatico** — al boot del server vengono creati provider e servizi di default (Email e Password + Fidelity Promotion) se non esistono
- **Endpoint `GET /api/hub-user-info`** — restituisce le informazioni base della sessione utente per la dashboard hub standalone

## [2.8.009] - 2026-03-23

### Corretto
- **Crash React nel pannello notifiche attività import tracciato** — risolto errore `Objects are not valid as a React child` quando `meta.context` arrivava come oggetto/array (es. campi `valore`, `nome_field`, `titolo_field`): aggiunta normalizzazione render-safe dei valori meta in `NotificationsPanel`

### Modificato
- **Action panel kit con errori (lavorazione automatica)** — il pulsante primario "Carica i file e manda in revisione" viene sostituito da un messaggio operativo che indica di riesportare il file da InDesign e ricaricarlo

## [2.8.008] - 2026-03-23

### Modificato
- **Messa in sicurezza transazionale del workflow `RuntimeKit`** — introdotte transaction atomiche su `avvioRevisioneKitManuale`, `avvioRevisioneKitAutomatico`, `riportaInLavorazione`, `riportaInLavorazioneConErroriAutomatico` e `pubblicaKitRuntime` per garantire rollback completo in caso di errore su update stato kit e log file
- **`creaLogPubblicazioneFiles` transaction-aware** — il metodo helper ora accetta una transazione opzionale e partecipa alla stessa unità atomica della pubblicazione kit

## [2.8.007] - 2026-03-23

### Corretto
- **Fix `SequelizeValidationError` su update parziali di `RuntimeKit`** — `riportaInLavorazioneConErroriAutomatico`, `riportaInLavorazione` e `pubblicaKitRuntime` fallivano perché `RuntimeKit.update()` eseguiva il validatore model-level `validazioneCoerenza` su un'istanza parziale (senza `titolo`); aggiunto `validate: false` a tutti gli update che modificano solo `stato_lavorazione`
- **Transaction atomica in `riportaInLavorazioneConErroriAutomatico`** — tutte le operazioni (log file rifiutati/accettati, update stato kit) sono ora racchiuse in `sequelize.transaction()` per garantire rollback completo in caso di errore, evitando log orfani nel database

## [2.8.006] - 2026-03-23

### Corretto
- **Fix validazione `FilesRuntimeLog` durante avvio revisione** — il validatore `isValidLogs` rifiutava `data_notifica` in formato ISO string (proveniente da JSONB PostgreSQL) perché controllava solo `instanceof Date`; ora accetta anche stringhe data valide. Il validatore model-level `validazioneCoerenza` falliva su update parziali (es. solo `logs` + `stato`) perché `nome_file`, `versione` e `data_registrazione` risultavano `undefined`; ora i check vengono saltati per campi non presenti nell'update

## [2.8.005] - 2026-03-23

### Modificato
- **User-Agent nel pannello dettagli Audit reso leggibile** — parser integrato che estrae browser (Chrome, Firefox, Edge, Safari, Opera, ecc.) con versione, sistema operativo (Windows, macOS, Android, iOS, Linux) con versione, e tipo dispositivo (Desktop, Mobile, Tablet, Bot); visualizzazione a chip colorati con icone specifiche; stringa raw accessibile tramite `<details>` "Mostra stringa completa" su sfondo scuro monospaziato

## [2.8.004] - 2026-03-23

### Modificato
- **Restyling completo tabella Audit Log per leggibilità intelligente** — stripe colorata a sinistra di ogni riga in base alla severità (rosso critico, ambra alto, blu medio, grigio basso) per scansione visiva istantanea; sfondo riga tinteggiato per eventi CRITICAL/HIGH; colonna "Quando" con tempo relativo come informazione primaria e data assoluta secondaria; colonna evento con icona in box dedicato e sotto-etichetta di categoria (Autenticazione, Sicurezza, Utente, Sistema, Dati); badge severità in pill con dot animato per i critici; colonna utente con badge ruolo colorato per tipo (Superadmin, Agenzia, GDO, ecc.); indicatore "Sistema" con icona per eventi senza utente; header sticky con backdrop-blur; pannello dettagli espanso con card per entità target e user-agent, evidenziazione rossa per campi errore/motivo, JSON formattato su sfondo scuro per migliore leggibilità; paginazione migliorata con ellissi e link diretto a prima/ultima pagina
- **Summary cards Dashboard Audit ridisegnate** — bordi arrotondati xl, icone in box dedicate con tono colore specifico, numeri formattati con locale italiano, pulsazione animata sul contatore critici quando > 0, spinner di caricamento custom al posto dell'icona rotante
- **Esito colonna rinominata da "Risultato" a "Esito"** — per coerenza terminologica e compattezza nell'header tabella

## [2.8.003] - 2026-03-23

### Modificato
- **Audit Log arricchito con anagrafica utente** — `AuditLogService.getAuditLogsPaginated` ora risolve `user_id` sulla tabella `utenti` e restituisce anche `user_name` e `user_surname` nei record paginati
- **Colonna Utente del Registro Audit resa sempre cliccabile** — la card utente ora apre `gestione-utenti` (con `userId` in query string), mantiene il badge ruolo e mostra in evidenza nome+cognome; l’ID resta visibile in formato compatto sotto al nome
- **Tipizzazione frontend aggiornata** — `AuditLogRecord` include i nuovi campi opzionali `user_name` e `user_surname`

## [2.8.002] - 2026-03-23

### Modificato
- **Interfaccia eventi Audit Log completamente ridisegnata** — badge evento con icone specifiche per categoria (auth, sicurezza, utente, sistema, dati) e colori distinti; indicatore severità con dot animato per eventi critici; badge risultato con icone (check/x/alert); timestamp con data relativa ("2 ore fa"); utente con badge ruolo colorato per tipo; pannello dettagli espanso con card strutturate chiave-valore anziché JSON grezzo; riga cliccabile per espandere; empty state migliorato
- **Spaziatura righe tabella Audit Log migliorata** — layout `border-separate` con righe card-like (bordi arrotondati, sfondo bianco, gap verticale tra le righe); padding celle uniformato; header con stile uppercase tracking; pannello dettagli espanso connesso visivamente alla riga padre

## [2.8.001] - 2026-03-23

### Aggiunto
- **Sistema audit persistente su PostgreSQL** — nuova tabella `audit_log` con 16 colonne (UUID PK, event_type, severity, user_id, ip_address, resource, action, result, details JSONB, target_entity_id/type, ecc.) e 7 indici BTREE per query performanti
- **Repository `AuditLogRepository`** con metodi per query paginate/filtrate, riepilogo aggregato, retention bulk delete e bulk insert non-bloccante
- **5 endpoint REST `/api/audit-log`** protetti da SUPERADMIN: lista paginata con filtri, riepilogo statistiche, export CSV (BOM+semicoloni per Excel), lista tipi evento con etichette italiane, lista severita con etichette italiane
- **Etichette italiane condivise** (`lib/auditTypes.ts`) per i 20 tipi di evento audit e 4 livelli di severita, utilizzabili sia dal server che dal frontend
- **Tab "Registro Audit" nella Dashboard Superadmin** — terzo tab con: 4 stat cards (totale eventi, eventi oggi, critici, alti), barra filtri (ricerca con debounce, tipo evento, severita, risultato, range date), tabella paginata e ordinabile con riga espandibile per i dettagli JSON, paginazione, bottone Export CSV
- **Cron job pulizia audit log** — esecuzione giornaliera alle 2:30 AM (Europe/Rome) con retention di 90 giorni, registrato in `ChronService`
- **DTO e validazione Zod** (`AuditLogDTO.ts`) per i parametri di query dell'API audit log
- **React Query hooks** per audit: `useFetchAuditLogs`, `useFetchAuditSummary`, `useFetchAuditEventTypes`, `useFetchAuditSeverities`

### Modificato
- **`AuditLogService` ora persiste su DB** — il buffer in memoria (flush ogni 30s) ora scrive anche su PostgreSQL via `bulkInsert` fire-and-forget, oltre al logging Winston esistente
- **Convenience methods aggiunti** in `AuditLogService`: `sessionExpired`, `configurationChanged`, `securityViolation`, `bulkOperation`, `sensitiveDataAccess`, `systemError`, `dataExport`
- **Container DI aggiornato** con binding per `AuditLogRepository` e `AuditLogService` (iniezione repository nel singleton)
- **Modello `AuditLog` registrato** in `models/index.ts` per la sincronizzazione automatica

### Sicurezza
- **Wiring audit in 7 middleware** — `authMiddleware` (sessione scaduta), `csrfProtection` (token invalido), `rateLimiter` (3 limiter), `permissionGuard` (accesso negato), `userRoleGuard` (ruolo non autorizzato), `errorHandler` (errori 500), `browserSecurityMiddleware` (violazioni sicurezza)
- **Wiring audit in 6 controller** — `UserController` (CRUD utenti + accesso dati sensibili), `PromoController` (CRUD promozioni), `OrdiniDiStampaController` (ordini + FTP + export), `WhatsAppController` (broadcast + campagne + template), `WebhookController` (CRUD webhook), `ConfigController` (configurazioni + manutenzione)
- **Accesso audit log tracciato** — la visualizzazione e l'export del registro audit generano a loro volta eventi `SENSITIVE_DATA_ACCESS` e `DATA_EXPORT`

## [2.7.004] - 2026-03-23

### Sicurezza
- **Audit logging nei controller principali** — aggiunte chiamate `AuditLogService` dopo le operazioni riuscite in 6 controller: `UserController` (creazione, modifica, eliminazione utenti), `PromoController` (creazione, aggiornamento, eliminazione promozioni), `OrdiniDiStampaController` (creazione ordine, avvio FTP, export report Excel), `WhatsAppController` (broadcast, avvio/annullamento campagna, sync template), `WebhookController` (creazione, aggiornamento, eliminazione webhook), `ConfigController` (salvataggio config, attivazione/rimozione avviso manutenzione)

## [2.7.003] - 2026-03-23

### Sicurezza
- **Audit logging nei middleware di sicurezza** — aggiunte chiamate `AuditLogService` nei punti critici di fallimento/blocco di 7 middleware: `authMiddleware` (sessione scaduta), `csrfProtection` (token mancante/mismatch/scaduto), `rateLimiter` (API/registrazione/reset password), `permissionGuard` (permesso negato), `userRoleGuard` (ruolo non autorizzato), `errorHandler` (errori 500), `browserSecurityMiddleware` (User-Agent sospetto, versione plugin obsoleta)

## [2.7.002] - 2026-03-20

### Corretto
- **Migrazione automatica vincolo legacy `permessi_ruolo`** — risolto `SequelizeUniqueConstraintError` causato dal vecchio vincolo univoco a 2 colonne (`tipo_utente`, `id_permesso`). Il sistema ora rileva e migra automaticamente al vincolo a 3 colonne che include `id_ruolo_utente_gdo`, con pulizia dei duplicati e indice funzionale COALESCE per gestire correttamente i NULL

## [2.7.001] - 2026-03-20

### Aggiunto
- **Sistema completo di permessi frontend** — rollout dei permessi RBAC su tutto il frontend, con strategia hide/disable coerente
- **Costanti permessi frontend** (`src/constants/permissions.ts`) — mappa TypeScript di tutti i 105+ codici permesso organizzati per dominio con type-safety e autocomplete IDE
- **Hook `useActionPermission`** (`src/hooks/useActionPermission.ts`) — utility hook per controllo permessi inline con tooltip automatico
- **Modalità `disable` in `PermissionGate`** — nuovo prop `mode` che supporta `'hide'` (default) e `'disable'` (opacità ridotta, pointer-events none, tooltip "Non hai i permessi")

### Modificato
- **Protezione rotta con `withSessionCheck` su 30+ pagine** — tutte le pagine sensibili ora verificano la sessione e i permessi di accesso prima del rendering, incluse: GestionePermessi, GestioneUtenti, Promozioni, Api/*, GestioneGDOAI/*, WhatsApp/*, ImpostazioniDiProduzione, CreazioneWebPliant, PuntiVendita, AreeCanali, ecc.
- **Permessi azioni su Promozioni** — bottoni "Segna come valida" protetti con `promo.modifica` (disable)
- **Permessi azioni su GestioneUtenti** — "Aggiungi utente" (`utenti.crea`, disable), "Esporta" (`utenti.esporta`, disable), "Elimina" (`utenti.elimina`, hide)
- **Permessi azioni su Kit ActionPanel** — "Sottoponi a revisione" (`kit_runtime.revisione`, disable), "Pubblica" (`kit_runtime.pubblica`, disable), "Riporta in lavorazione" (`kit_runtime.riporta_in_lavorazione`, disable), "Elimina" (`kit_runtime.elimina`, hide), "Scarica ZIP" (`file.download`, disable)
- **Permessi azioni su AreeCanali** — creazione area/canale (`gdo.gestisci_aree_canali`, disable), eliminazione (`gdo.gestisci_aree_canali`, hide)
- **Permessi azioni su PuntiVendita** — creazione (`gdo.gestisci_punti_vendita`, disable), eliminazione (`gdo.gestisci_punti_vendita`, hide)
- **Permessi azioni su GestioneWebhook** — "Nuovo Webhook" (`webhook.gestisci`, disable), eliminazione (`webhook.gestisci`, hide)
- **Permessi azioni su OrdiniDiStampa** — creazione ordine (`ordini_stampa.crea`, hide)
- **Permessi azioni su ImpostazioniDiProduzione** — gestione formati, tipo export, naming convention (rispettivi permessi `impostazioni.*`, disable)
- **Permessi azioni su WhatsApp** — invio campagna (`whatsapp.invia_campagna`, disable), gestione templates (`whatsapp.gestisci_templates`, disable/hide), gestione presets (`whatsapp.gestisci_presets`, disable/hide)
- **Permessi azioni su CreazioneWebPliant** — salvataggio workspace (`webpliant.configura`, disable)
- **Permessi azioni su GestionePermessi** — rigenera catalogo, reset override, salva modifiche (`permessi.gestisci`, disable)
- **Permessi azioni su GestioneRicette** — genera ricette (`ai.gestisci_ricette`, disable), eliminazione (`ai.gestisci_ricette`, hide)
- **Permessi azioni su GestioneApprofondimentoVini** — generazione massiva (`ai.gestisci_vini`, disable), eliminazione massiva (`ai.gestisci_vini`, hide)
- **Permessi azioni su Api/Keys** — genera nuova API key (`api.gestisci_chiavi`, disable)
- **Permessi su componenti condivisi FileList e FileUploader** — download file (`file.download`, disable), elimina file (`kit_runtime.elimina_file`, hide), upload file (`file.upload_materiale`, disable)

### Sicurezza
- **Protezione completa frontend RBAC** — tutti i bottoni e azioni sensibili sono ora controllati dal sistema permessi, con azioni distruttive nascoste e azioni operative disabilitate con tooltip per utenti non autorizzati

## [2.6.002] - 2026-03-20

### Modificato
- **Aggiunto HOC `withSessionCheck` a 10 pagine** — ImpostazioniUtente, GestioneGDOAI, Documentazione, WebpliantLayout, GestionePuntoVendita, GestionePermessi, GestioneUtenti, Promozioni, StoricoVolantini e ContenutiDigitali ora verificano la sessione utente prima del rendering

## [2.6.001] - 2026-03-20

### Aggiunto
- **Nuova dashboard superadmin** a `/superadmin/dashboard` con metriche di sistema: stato database PostgreSQL, audit di sicurezza (login falliti, attività sospette, eventi per severità), utenti online (sessioni attive e connessioni WebSocket), ultimi errori critici
- **Grafici Chart.js nella dashboard superadmin**: grafico doughnut per utilizzo pool connessioni, grafico a barre per breakdown connessioni (attive/idle/in attesa/totali vs media), grafico lineare storico per connessioni attive e utilizzo pool nel tempo
- **Controller backend `SuperadminDashboardController`** con endpoint `GET /api/superadmin-dashboard/overview` protetto da `authMiddleware` + `userRoleGuard([SUPERADMIN])`, include metriche ConnectionMonitor (health, pool metrics, medie, storico)
- **Componente `RoleGuard`** per protezione route lato frontend basata sul ruolo utente
- **Voce menu "Dashboard Superadmin"** con icona Shield nella sezione SISTEMA del menu superadmin

### Modificato
- Dashboard GDO (volantini) spostata da `/dashboard` a `/gdo/dashboard`
- Redirect retrocompatibile da `/dashboard` → `/gdo/dashboard` per preservare bookmark e link esistenti
- Aggiornati tutti i riferimenti al vecchio path `/dashboard` in: router, breadcrumb, pagina 404, login, menu.json, UserService (`page_to_land`), MenuService e UserService (mappe permessi pathname)

## [2.5.001] - 2026-03-20

### Aggiunto

- **Notifica attività per eliminazione utente** (`ELIMINAZIONE_UTENTE`) — `UserController.deleteUser()` ora crea un'attività con nome ed email dell'utente eliminato, recuperati prima della cancellazione
- **Notifica attività per creazione kit manuale** (`CREAZIONE_RUNTIME_KIT_MANUALE`) — `KitRuntimeController` nel ramo `bulkCreateRuntime` ora logga l'attività con id promo, quantità e nome kit
- **Notifica attività per modifica workspace WebPliant** (`MODIFICA_WORKSPACE_WEBPLIANT`) — `WebPliantController.salvaWorkspaceWebpliant()` ora emette notifica con nome e id workspace
- **Notifica attività per creazione design kit** (`CREAZIONE_DESIGN_KIT`) — `DesignKitController.creaCombinazioniDesign()` ora logga l'attività con titolo, tipo e quantità combinazioni
- **Notifica attività per creazione lavorazione** (`CREAZIONE_LAVORAZIONE`) — `PromoController.inizioNuovaLavorazione()` ora emette notifica con nome promo e id

### Modificato

- **Colori categorie NotificationsPanel sostituiti con token semantici di progetto** — da colori Tailwind hardcoded (`text-blue-600`, `bg-orange-50`, ecc.) a token semantici (`text-primary`, `bg-pending/10`, `text-success`, `text-info`, `text-warning`) che si adattano al tema attivo
- **Toast con differenziazione visiva per variante** — aggiunto bordo sinistro colorato e tint di sfondo (success → verde, error → rosso, warning → giallo, info → ciano) usando i colori semantici del progetto
- **Notifiche socket mostrano titolo e messaggio** — il toast real-time ora visualizza `titolo` (grassetto) e `messaggio` separatamente, con icona e colore specifici per variante (CheckCircle/success, AlertCircle/danger, AlertTriangle/warning, Bell/info)
- **Indicatore notifiche non lette** — sfondo da `bg-blue-50/40` (Tailwind) a `bg-primary/5` (semantico, adattivo al tema)
- **Dettagli meta nel pannello notifiche completamente riscrittti** — ogni tipo di attività (escluso Correggo) ora mostra i dati meta reali con etichette strutturate (label: valore), badge colorati per tipo/quantità/stato, e gestione corretta dei nomi campi dal backend (es. `titolo` per kit automatici, `nomeWorkspace` per workspace, `stato_ordinistampa` per ordini di stampa)

## [2.4.5] - 2026-03-19

### Sicurezza

- **Aggiunto `permissionGuard('plugin_analytics.visualizza')` agli endpoint admin di Plugin Analytics** (`/stats`, `/events`, `/monitor`) — in precedenza erano protetti solo da `authMiddleware`, permettendo a qualsiasi utente autenticato (inclusi Guest e PuntoVendita) di accedere a dati sensibili (IP, user agent, sessioni). Ora richiedono il permesso dedicato, in linea con il pattern usato in `ExternalApiController`

## [2.4.4] - 2026-03-18

### Aggiunto

- **Ripresa sessione analytics nel plugin (`session:resume`)** — alla connessione WebSocket il plugin invia il `sessionId` corrente al server per recuperare l'ultima sequenza. Se l'ultimo evento è più vecchio di 1 giorno la sessione viene considerata scaduta e ne viene creata una nuova; altrimenti il contatore di sequenza riparte dall'ultimo valore salvato, garantendo continuità nel replay degli eventi
- **Nuovo tipo messaggio `session:resume` / `session:resumed`** nel protocollo WebSocket plugin-server (`pluginAnalyticsTypes.ts`)
- **Handler `handleSessionResume` in `PluginAnalyticsGatewayService`** — query aggregata su `MAX(sequence)` e `MAX(timestamp_event)` per sessionId con risposta sincrona al client
- **Assegnazione sequenza al flush-time** — `sessionId` e `sequence` degli eventi vengono assegnati al momento del flush (non alla creazione), tramite callback `getCurrentSessionId()` e `getNextSequence()` sull'istanza FP proprietaria. Il buffer del `PluginAnalyticsManager` tiene un riferimento all'istanza FP per ogni evento. Il flush è bloccato (`pendingResume`) finché `session:resumed` non arriva, garantendo che le sequenze siano sempre corrette anche quando eventi vengono bufferizzati prima della risposta del server

### Modificato

- **Plugin suddiviso in moduli** — il monolite `src/index.ts` (~3000 righe) è stato separato in file dedicati: `types.ts` (interfacce pubbliche), `defaults.ts` (stili di default), `logger.ts` (FPLogger), `analytics/types.ts` (tipi analytics) e `analytics/manager.ts` (PluginAnalyticsManager). tsup bundla tutto in un singolo file per formato (ESM, CJS, IIFE) — nessun cambiamento nell'output di build

## [2.4.3] - 2026-03-18

### Corretto

- **Rimossa opzione `preTransformRequests`** dal server Vite — non è un'opzione valida e causava errore di tipo
- **Rimossa opzione `treeshake`** da `rollupOptions` — non valida a quel livello, Rollup gestisce il tree-shaking automaticamente
- **Corretta logica `assetFileNames`** — la regex testava l'estensione senza il punto (es. `"png"` vs `\.png`), impedendo il match. Ora il test viene eseguito sul nome completo del file
- **Risolti errori TypeScript in `vite.config.ts`** — convertito `tsconfig.json` in setup solution-style con project references, creato `tsconfig.node.json` dedicato (`composite: true`) per i file di configurazione (vite, vitest), aggiunto `composite: true` a `src/tsconfig.json`, sostituito `/// <reference types="vite/client" />` con `/// <reference types="node" />`, e annotati i tipi espliciti sui parametri callback (`path`, `assetInfo`, `id`)

### Modificato

- **Offuscamento nomi chunk e asset nel build** — i chunk vendor usano ora identificatori opachi (`c0`–`cD`) e tutti i file di output (entry, chunk, asset) espongono solo l'hash nel nome, senza rivelare la natura del contenuto

## [2.4.2] - 2026-03-18

### Ripristinato

- **Ripristinato componente Lucide all'import completo `{ icons }` da `lucide-react`** — rimosso il registro statico `iconRegistry.ts` introdotto in 2.4.0, tornando al funzionamento originale con tutte le icone disponibili

## [2.4.1] - 2026-03-18

### Sicurezza

- **Riattivata logica di autorizzazione nel `permissionGuard`** — tutto il codice di verifica permessi era commentato, rendendo il middleware un no-op che chiamava `next()` senza alcun controllo. Ripristinati: check autenticazione, bypass Superadmin, cache permessi in sessione e rifiuto 403 per permessi mancanti
- **Aggiunta validazione ruolo nell'endpoint `PUT /updateUser`** — il campo `tipo` (ruolo utente) e `stato` venivano accettati dal body senza restrizioni, permettendo a qualsiasi utente autenticato di auto-promuoversi a Superadmin o modificare lo stato di altri utenti. Ora solo Superadmin può modificare questi campi, con validazione del valore di `tipo` contro l'enum `TIPO_UTENTI`
- **Aggiunta allowlist campi nell'endpoint `PUT /update_profile`** — il body della richiesta veniva passato integralmente al servizio senza filtro, permettendo a qualsiasi utente autenticato di modificare il proprio `tipo` (ruolo), `stato`, `password` e `privatekey`. Ora solo i campi consentiti per l'auto-modifica del profilo vengono accettati (nome, cognome, email, telefono, sesso, residenza, data di nascita)

## [2.4.0] - 2026-03-17

### Modificato

- **Ottimizzazione bundle main.js (-36%, da 2.128 KB a 1.355 KB)**:
  - Sostituito import globale `{ icons }` da `lucide-react` (~3500 icone) con registro statico delle sole ~370 icone utilizzate, abilitando il tree-shaking
  - Lazy-loading di `@lottiefiles/dotlottie-react` in `LoadingOverlay`, `AppErrorFallback` e `SessionChecker` tramite `React.lazy()` — la libreria viene scaricata on-demand
  - Rimosso `framer-motion` dai contesti root (`NotificationContext`, `LoadingOverlay`) e sostituito con transizioni e animazioni CSS native

### Aggiunto

- Registro icone Lucide (`src/components/Base/Lucide/iconRegistry.ts`) per controllo esplicito delle icone incluse nel bundle
- Stili CSS per LoadingOverlay (`loading-overlay-backdrop`, `loading-overlay-spinner`, animazioni `@keyframes`) in `app.css`

## [2.3.1] - 2026-03-17

### Corretto

- **ReferenzeInVolantinoBox non visibile dopo migrazione PG** — il componente riceveva i nomi visualizzazione degli export (`exportTypes`) invece dei codici di sistema (`exportCodes`), quindi il check `includes("VOL")` falliva sempre. Corretto in `KitOverviewLayout` per passare `exportCodes`
- **Query VOL files su colonna errata in VolantinoService** — le query `FilesRuntime` filtravano su `tipo_export` (che contiene il GUID) invece di `tipo_export_codice` (che contiene il codice "VOL"). Corretto in `prendiIVolantiniCaricatiDaDB` e `getFlyerInsights`
- **Foto di gruppo mancanti negli insights volantino** — il campo `fotoGruppo` non esisteva nel modello PG `Referenze` e veniva sempre risolto a stringa vuota. Aggiunta risoluzione dalla tabella `ReferenzeGruppo` tramite `codice_referenza`

## [2.3.0] - 2026-03-17

### Aggiunto

- **Plugin Analytics: registrazione professionale per replay** — ogni evento ora include `sequence` (numero progressivo per sessione) e `viewport` (viewportWidth, viewportHeight, scrollX, scrollY, documentWidth, documentHeight) per ricostruzione completa della sessione utente
- **Plugin Analytics: `item:click` arricchito** — ora registra coordinate mouse (clientX/Y, pageX/Y), bounding rect dell'item (x, y, absoluteX, absoluteY, width, height), DOM path, tipo elemento e `codiceRef` sempre presente (mai null)
- **Plugin Analytics: `item:impression` con codiceRef** — le impression degli item ora includono sempre il codice referenza per correlazione con i click
- **Plugin Analytics: tipi tipizzati per i payload** — aggiunte interfacce `ItemClickPayload`, `ItemImpressionPayload`, `GlobalClickPayload`, `GlobalScrollPayload`, `RenderCompletePayload`, `PluginElementRect`, `PluginAnalyticsViewport` in `lib/pluginAnalyticsTypes.ts`
- **Enum `GLOBAL_CLICK` e `GLOBAL_SCROLL`** — aggiunti all'enum server-side `PluginEventType` (prima erano solo nel plugin)
- **Colonne DB `sequence` e `viewport`** — nuove colonne nella tabella `plugin_analytics_events` con indice `idx_pae_session_sequence` per query di replay ordinate per sessione

### Corretto

- **Overlap click analytics nel plugin** — risolto il conflitto tra `item:click` e `global:click`: il global handler ora usa la bubble phase (prima era capture) così il handler degli item si attiva per primo e marca l'evento con `_fpItemHandled`, impedendo la doppia registrazione. Mantenuto il check `composedPath()` come safety net

## [2.2.3] - 2026-03-17

### Aggiunto

- **Plugin Analytics: global tracking** — tracking click globali su tutta la pagina con posizione elemento (clientX/Y, pageX/Y, absoluteX/Y, width/height), tipo elemento rilevato (link, button, image, input, carousel, generic), contesto carousel (swiper, slick, splide, glide, slider), DOM path (max 5 livelli), text snippet sicuro (max 50 char)
- **Plugin Analytics: scroll depth tracking** — tracking profondità di scroll con soglie discrete (10%, 25%, 50%, 75%, 90%, 100%), throttling via `requestAnimationFrame`, eventi emessi una sola volta per soglia raggiunta
- **Plugin Analytics: dati posizione nelle impressioni** — arricchite le impression degli item con coordinate (x, y, absoluteX, absoluteY), dimensioni (width, height) e tipo elemento
- **Plugin Analytics: helper methods** — aggiunti metodi interni `getElementRectData`, `detectElementType`, `detectCarouselContext`, `buildDomPath`, `getSafeTextSnippet`, `getScrollDepthBucket` per estrazione dati leggera e sicura
- **Plugin Analytics: nuovi event types** — `global:click` e `global:scroll` aggiunti a `PluginEventType`
- **Plugin Analytics: Shadow DOM compatibility** — uso di `event.composedPath()` per risolvere correttamente il target anche attraverso Shadow DOM
- **Attributo `codice-ref` sulle referenze HTML** — `ReferenzeHtmlService` inietta `codice-ref` sul primo tag dell'HTML renderizzato; il plugin lo propaga sul wrapper `fp-ref-item` in tutte le modalità (list, grid, carousel)

### Corretto

- **Overlap click analytics** — `global:click` ora viene ignorato se il target è all'interno di un item FP (`[data-fp-item-id]`), evitando eventi duplicati con `item:click`

## [2.2.2] - 2026-03-17

### Corretto

- **Modale modifica utente**: corretto il form che non permetteva il salvataggio perché condivideva lo schema di validazione con il form di creazione (campo `password` obbligatorio bloccava la sottomissione)
- **Endpoint `PUT /updateUser` mancante**: aggiunta la route e il controller handler per l'aggiornamento utente, con supporto per aggiornamento associazioni GDO, ruolo GDO e Punto Vendita
- **Campi mancanti nel modale modifica**: aggiunti i campi `Stato Utente` e `Sesso` che non erano presenti nel dialog di modifica
- **Valore errato nel select Punto Vendita**: corretto il valore dell'opzione nel modale di modifica da `punto.id_gdo` a `punto.id` (il modale di creazione era già corretto)
- **Campi GDO e Ruolo non precompilati nel modale modifica**: i campi `gdoScelta`, `ruolo_gdo` e `idPuntoVendita` non venivano popolati perché il frontend accedeva con nomi camelCase (`ruoloGDO`, `puntoVenditaCollegato`) mentre la Materialized View restituisce snake_case (`ruolo_gdo`, `punto_vendita_collegato`). Inoltre `id_gdo` non era presente nei dati della MV.

### Aggiunto

- Recupero dell'`id_gdo` dalla tabella `utenti_gdo` in `get_all_utenti_paginated` per arricchire i dati della Materialized View con l'associazione GDO dell'utente
- Metodi `updateUserGdoAssociation`, `updateUserPuntoVenditaAssociation` e `refreshMaterializedView` in `UserService` per gestire le associazioni utente durante la modifica
- Schema di validazione separato `userEditSchema` per il form di modifica utente (senza campo password)

## [2.2.1] - 2026-03-17

### Corretto

- Rimossa l'opzione `v7_partialHydration: true` dal router, non necessaria poiché l'app usa `createRoot` e non `hydrateRoot`, eliminando il warning "No HydrateFallback element provided"

## [2.2.0] - 2026-03-16

### Aggiunto

- **Sistema completo di Plugin Analytics Event Tracking** per raccogliere e analizzare le interazioni utente con il plugin FP su siti terzi
  - Tipi condivisi plugin/server in `lib/pluginAnalyticsTypes.ts` con enum `PluginEventType` e protocollo wire WebSocket
  - Modello Sequelize `PluginAnalyticsEvent` con tabella `plugin_analytics_events` (UUID PK, JSONB event_data, 6 indici)
  - `PluginAnalyticsGatewayService` (singleton, processo master): gestione connessioni WebSocket raw, buffer in-memory (500 eventi, flush ogni 10s), rate limiting (100 eventi/batch, 10 batch/min), heartbeat 30s
  - WebSocket raw (`ws.WebSocketServer`) su path `/ws/plugin-events` coesistente con Socket.IO sulla stessa porta 3400, con validazione ephemeral token all'upgrade
  - `PluginAnalyticsController` con endpoint REST: `POST /beacon` (fallback sendBeacon), `GET /stats`, `GET /events`, `GET /monitor`
  - `PluginAnalyticsRepository` con aggregazione raw SQL e pulizia dati per retention
  - DTO Zod per validazione (`BeaconPayloadSchema`, `PluginAnalyticsFiltersSchema`) e interfaccia DI `IPluginAnalyticsService`
  - Cron job cleanup eventi analytics (ogni giorno alle 4:30 AM Europe/Rome, retention 90 giorni configurabile via env `PLUGIN_ANALYTICS_RETENTION_DAYS`)
  - Bridge IPC worker-master per metriche real-time del gateway analytics
- **Plugin-side analytics tracker** (`plugin/src/index.ts`):
  - `PluginAnalyticsManager` singleton statico condiviso tra tutte le istanze FP sulla stessa pagina (1 solo WebSocket, 1 buffer, 1 flush timer)
  - Reference counting: WS creato alla prima `enableTracking()`, distrutto all'ultima `disableTracking()`
  - Buffer client-side (50 eventi, flush ogni 10s) con reconnessione automatica (backoff esponenziale + jitter, max 10 tentativi)
  - Fallback `sendBeacon` su `visibilitychange` per eventi non inviati alla chiusura pagina
  - Tracking per-istanza: `IntersectionObserver` per impression (>=50% visibilita per >=1s), click delegation via `data-fp-item-id`, eventi carousel (nav, slide, goTo)
  - Tracking automatico `RENDER_START`/`RENDER_COMPLETE` con durata in ms
  - Auto-abilitazione tracking in `init()` se `options.tracking.enabled = true`
  - Opzione `FPTrackingOptions` nell'interfaccia `FPOptions`
  - Attributo `data-fp-item-id` su tutti gli elementi renderizzati (grid, list, carousel, file cards/slides)

## [2.1.0] - 2026-03-16

### Sicurezza
- Applicato `permissionGuard` granulare a tutti gli endpoint protetti del sistema (243 rotte su 26 controller)

### Aggiunto
- Middleware `permissionGuard` applicato a tutti i controller per il controllo granulare dei permessi sulle rotte protette:
  - **PromoController**: `promo.visualizza`, `promo.crea`, `promo.modifica`, `promo.elimina` su tutte le rotte protette
  - **KitRuntimeController**: `kit_runtime.visualizza`, `kit_runtime.elimina`, `kit_runtime.elimina_file`, `kit_runtime.revisione`, `kit_runtime.riporta_in_lavorazione`, `kit_runtime.pubblica`, `kit_runtime.cambia_stato` su tutte le 19 rotte
  - **FileManagementController**: `file.upload_materiale`, `file.upload_tracciato`, `file.upload_kit_manuali`, `file.sostituisci`, `file.upload_olympus`, `file.aggiorna_immagine_referenza`, `file.download`, `file.merge` su tutte le 19 rotte protette (escluso downloadPDFVolantino pubblico)
  - **UserController**: `utenti.crea`, `utenti.visualizza`, `utenti.elimina`, `utenti.esporta` sulle rotte di gestione utenti
  - **DesignKitController**: `design_kit.visualizza`, `design_kit.crea`, `design_kit.modifica` su tutte le rotte
  - **RaccoglitoreKitController**: `raccoglitore_kit.visualizza`, `raccoglitore_kit.elimina`, `raccoglitore_kit.modifica`, `raccoglitore_kit.gestisci_filtri`, `raccoglitore_kit.gestisci_declinazioni` su tutte le rotte
  - **FormatoController**: `impostazioni.gestisci_formati` su tutte le rotte
  - **TipoExportController**: `impostazioni.gestisci_tipo_export` su tutte le rotte
  - **NamingConventionController**: `impostazioni.gestisci_naming_convention` su tutte le rotte
  - **ContrattoTipografiaController**: `impostazioni.gestisci_contratti_tipografia` su tutte le rotte
  - **ConfigController**: `impostazioni.modifica_generali` su saveConfig, caricaStiliInConfig e saveWebpliantConfig; `api.gestisci_plugin` su getPluginRegistry
  - **OrdiniDiStampaController**: `ordini_stampa.visualizza`, `ordini_stampa.crea`, `ordini_stampa.avvia_ftp`, `ordini_stampa.download_report`, `ordini_stampa.raggruppa_file` su tutte le 17 rotte
  - **WebPliantController**: `webpliant.visualizza`, `webpliant.crea_workspace`, `webpliant.elimina_workspace`, `webpliant.configura` sulle 10 rotte protette (escluse prendiWorkspaceDaID e getReferenzeWebPliant pubbliche)
  - **ReferenzeController**: `referenze.visualizza`, `referenze.crea_contenuti_aggiuntivi`, `referenze.modifica`, `referenze.importa` sulle 13 rotte protette (escluse ricercaReferenzePromo e get_filtered_referenze pubbliche)
  - **VolantinoController**: `kit_runtime.visualizza` su entrambe le rotte
  - **GdoController**: `impostazioni.gestisci_pagine_singular` su saveGestionePagineSingular; `gdo.gestisci_aree_canali` su get_all_aree_canali_combinazioni e get_all_combinazioni_canale_area; `gdo.upload_icona` su POST gdo/icona
  - **AreaController**: `gdo.gestisci_aree_canali` su tutte le 4 rotte
  - **CanaleController**: `gdo.gestisci_aree_canali` su tutte le 4 rotte
  - **CombinazioneAreeCanaliController**: `gdo.gestisci_aree_canali` su tutte le 3 rotte
  - **PuntoVenditaController**: `gdo.gestisci_punti_vendita` su tutte le 15 rotte protette (escluso dispositivi/heartbeat M2M)
  - **WhatsAppController**: `whatsapp.visualizza_campagne` su rotte di visualizzazione campagne, `whatsapp.invia_campagna` su invio/retry, `whatsapp.gestisci_templates` su templates, `whatsapp.gestisci_presets` su presets, `whatsapp.annulla_campagna` su cancellazione campagna
  - **GPTController**: `ai.gestisci_ricette` su tutte le rotte ricette (generazione, foto, stato, eliminazione), `ai.gestisci_vini` su tutte le rotte vini (abbinamento, approfondimento)
  - **WebhookController**: `webhook.visualizza` su GET list/detail/statistiche, `webhook.gestisci` su POST/PUT/DELETE/test/scatena-evento (escluse rotte pubbliche eventi/disponibili e ricevi)
  - **ExternalApiController**: `api.gestisci_chiavi` su generate/get API key, `api.visualizza_statistiche` su statistiche, `api.test` su rotte test, `api.gestisci_plugin` su sync_foto_plugin e CRUD filter templates (escluse rotte ephemeral)
  - **PermessiController**: `permessi.gestisci` su tutte le rotte admin (GET/PUT ruolo, DELETE override GDO, seed, reseed) escluse catalogo e permessi effettivi
  - **MenuController**: `permessi.gestisci` su tutte le rotte admin (GET all, GET/PUT per tipo utente, seed) esclusa GET /me

### Corretto
- **PermessiRepository**: corretto `bulkUpsertPermessiRuoloGdo` e `bulkUpsertPermessiRuolo` che fallivano con `SequelizeUniqueConstraintError` su PostgreSQL — `bulkCreate` con `updateOnDuplicate` usava la primary key (UUID) per `ON CONFLICT`, causando violazione del vincolo univoco. Sostituito con approccio delete + insert in transazione
- **PermessiRepository**: corretto `upsertPermessoRuolo` e `upsertPermessoRuoloGdo` con approccio findOne + update/create per evitare lo stesso problema
- Rimosso `permissionGuard` dalle rotte `invioMaterialeAdFP` e `getKitByPromo` (chiamate esterne che devono passare sempre)

### Modificato
- **PromoController**: sostituito `userRoleGuard` con `permissionGuard('promo.crea')` su POST /promo e `permissionGuard('promo.modifica')` su PUT /promo/:id; rimosso import `userRoleGuard`
- **ConfigController**: sostituito `userRoleGuard([SUPERADMIN, AGENZIA])` con `permissionGuard('impostazioni.modifica_generali')` sulla rotta `POST /saveWebpliantConfig` per allinearsi al nuovo sistema di permessi granulari
- **ExternalApiController**: sostituito `userRoleGuard([SUPERADMIN, GDO])` con `permissionGuard('api.gestisci_plugin')` su tutte le rotte filter templates; rimossi import `userRoleGuard` e `TIPO_UTENTI` non più utilizzati
- **PermessiController**: sostituito `userRoleGuard([SUPERADMIN])` con `permissionGuard('permessi.gestisci')` su tutte le rotte admin; rimosso import `userRoleGuard`
- **MenuController**: sostituito `userRoleGuard([SUPERADMIN])` con `permissionGuard('permessi.gestisci')` su tutte le rotte admin; rimosso import `userRoleGuard`

## [2.0.0] - 2026-03-11

### Aggiunto
- Documento di sicurezza `docs/SECURITY_EXTERNAL_API.md` che descrive in dettaglio il funzionamento e le garanzie di sicurezza del sistema di autenticazione delle API esterne (token effimero challenge-response, API Key AES-256-CBC e Browser Hash fingerprint)
- Nuovo tipo utente `Category` (`TIPO_UTENTI.CATEGORY = "Category"`) aggiunto all'enum `TIPO_UTENTI` in `lib/enums.ts`; il modello Sequelize lo recepisce automaticamente tramite `DataTypes.ENUM(...Object.values(TIPO_UTENTI))`
- Timeout di sessione per gli utenti `Category` impostato a 2 ore in `server/core/session.ts` (stesso livello di `Agenzia` e `GDO`)

### Modificato
- **Refactoring RESTful `PromoController`**: tutte le rotte convertite a convenzioni REST sotto il prefisso `/api/promo`
  - `GET /get_all_promo` → `GET /promo`
  - `GET /get_all_promo_filtered` → `GET /promo/filtered`
  - `GET /get_all_promo_in_corso` → `GET /promo/in-corso`
  - `GET /get_all_promo_timeline` → `GET /promo/timeline`
  - `GET /getAllLavorazioniStorico` → `GET /promo/storico`
  - `GET /get_lavorazione/:idPromo` → `GET /promo/:idPromo`
  - `PUT /updateLavorazione` → `PUT /promo/:id` (id ora nel path)
  - `DELETE /deleteLavorazione/:id` → `DELETE /promo/:id`
  - `DELETE /deleteLavorazione/:id/:stato` → `DELETE /promo/:id/stato/:stato`
  - `PUT /inizioNuovaLavorazione` → `POST /promo` (metodo corretto per creazione)
  - `GET /getContestoPerNuovaLavorazione` → `GET /promo/contesto`
  - `GET /get_contesto_per_importazione` → `GET /promo/contesto-importazione`
  - `GET /getPromozioniInCorsoPerDashboard` → `GET /promo/dashboard`
  - `GET /test-notifica` → `GET /promo/test-notifica`
- Ottimizzato `getAllPromosInCorso`: ora delega al service (`getAllPromoInCorso`) invece di caricare tutte le promo e filtrare nel controller
- Aggiornate tutte le chiamate client in `query.tsx`, `loaderFunctions.ts`, `usePromoName.tsx`, `LavorazioniInCorso`, `DettagliLavorazioneInCorso`, `NuovaLavorazione`
- Corretto query key stale `get_all_promo_in_corso` → `lavorazioniInCorso` in `DettagliLavorazioneInCorso`

### Rimosso
- Rotta `GET /getAllPromoInCorso` (ridondante con `/promo/in-corso`, mai usata dal client)
- Rotta `GET /prendiPromoDaDB/:idPromo` e relativo handler (dead code, mai usata dal client)
