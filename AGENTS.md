# Protocollo aziendale per la suite Istanta4

Questo repository è governato dal **Company Control Plane**.

**ID progetto:** `istanta4`

Le regole seguenti sono obbligatorie per ogni richiesta che possa comportare modifiche al repository. Gli `AGENTS.md` presenti nelle cartelle dei componenti aggiungono regole tecniche locali e non sostituiscono questo protocollo.

Le richieste di analisi di una riunione registrata (una trascrizione `TRJ-…` o una riunione `MTG-…`) non modificano il repository e seguono il §15, non il protocollo dei task.

## 1. Verifica del Company Control Plane

Prima di esaminare o modificare qualsiasi file:

1. Verifica che sia disponibile il server MCP `SingularAiFactory`.
2. Verifica esplicitamente che esponga `company_prepare_task`, anche se gli strumenti MCP non compaiono nell'elenco sintetico iniziale.
3. Se lo strumento non è disponibile o la chiamata fallisce, non esaminare il codice, non modificare file e comunica il blocco all'utente.

## 2. Avvio e continuità del task

1. Chiama `company_prepare_task` con:
   - `projectId`: `istanta4`;
   - `prompt`: la richiesta completa originale dell'utente;
   - `sourceBranch`: **solo** nel caso descritto al punto 6, altrimenti lascialo vuoto.
2. Conserva il `taskId` restituito e consulta tutte le specifiche fornite.
3. Non inventare o generare autonomamente un `taskId`.
4. Riutilizza lo stesso `taskId` per tutte le operazioni relative alla medesima richiesta.
5. Se un task `Blocked` può riprendere, usa `company_update_task_status` con stato `Resume` prima di continuare.
6. Se apri un task di tua iniziativa per proseguire un lavoro già in corso — per esempio
   perché l'utente, dopo il debug, chiede altre modifiche e queste finiranno sul branch
   di un task precedente — **devi** passare quel branch in `sourceBranch`. Non è
   facoltativo: senza, il task resta senza branch e senza pull request, nessuna
   propagazione del merge lo raggiungerà mai, e resterà completato per sempre senza
   alcun riferimento in Git. Il branch deve essere quello già governato dal task
   precedente, non un nome nuovo.

## 3. La issue Jira e i suoi allegati

Se il prompt riferisce una issue Jira, leggila con `company_get_jira_issue` prima di
analizzare il codice. La risposta contiene anche l'elenco degli **allegati**: per
ciascuno trovi identificativo, nome, tipo e dimensione.

1. Esamina quell'elenco. Spesso la parte decisiva della richiesta non è nel testo della
   issue ma in uno screenshot, in un tracciato d'esempio o in un export: ignorarli
   significa lavorare su metà del contesto.
2. Decidi tu quali servono, in base a nome e tipo, e recuperali uno per uno con
   `company_get_jira_attachment` passando `taskId` e l'identificativo dell'allegato.
   Non recuperarli tutti per abitudine: il contenuto entra nella conversazione e occupa
   spazio che serve al lavoro.
3. Le immagini ti arrivano come immagini, i file di testo come testo, gli altri — PDF
   compresi — nella loro forma originale. Un allegato oltre il limite non viene
   scaricato: ricevi la sua descrizione, e in quel caso chiedi all'utente di guardarlo
   e riferirti cosa contiene.
4. Quando ciò che vedi in un allegato contraddice il testo della issue o le specifiche,
   segnala la divergenza invece di scegliere da solo quale delle due seguire.

## 4. Analisi della suite

Solo dopo il completamento di `company_prepare_task`:

1. Individua le specifiche e i componenti coinvolti prima di proporre modifiche.
2. Esamina soltanto i file pertinenti, comprese le interfacce e i consumatori dei contratti modificati.
3. Cerca i test esistenti collegati al comportamento richiesto.
4. Consulta l'`AGENTS.md` di ogni componente interessato.
5. Per un flusso trasversale, considera l'intera catena descritta dalle specifiche, non soltanto il primo servizio nominato nel prompt.
6. Se richiesta e specifiche divergono, segnala il divario e non correggere silenziosamente le specifiche.

## 5. Matrice minima d'impatto

Usa questa matrice come punto di partenza, integrandola con le dipendenze effettivamente rilevate:

| Percorso modificato | Verifiche minime |
| --- | --- |
| `Istanta/**` | Istanta |
| `IstantaLib/**` | IstantaLib, Istanta e AgenziaLib |
| `AgenziaLib/**` | AgenziaLib e il caricamento del relativo artefatto da parte di Istanta |
| `fidelity/**` | Fidelity |
| `olimpo/**` | Olimpo |
| `correggo4/**` | Correggo4 |
| contratti o flussi condivisi | tutti i produttori e consumatori coinvolti |
| `.github/**`, Dockerfile o file di distribuzione | build o validazione di tutti gli artefatti interessati |

Una modifica a `IstantaLib` invalida sia Istanta sia AgenziaLib. Una modifica alla sola AgenziaLib non richiede di ricostruire l'immagine Istanta, ma deve verificare la compatibilità del file `AgenziaLib.dll` con il caricamento runtime previsto.

## 6. Test obbligatori

L'agent deve creare o aggiornare test automatici quando la richiesta introduce o modifica un comportamento osservabile, corregge un difetto riproducibile oppure cambia un contratto tra componenti.

Per ricavare i test:

1. Trasforma Purpose, regole e vincoli delle specifiche in condizioni osservabili.
2. Prevedi almeno un caso positivo e, quando pertinente, un caso limite o negativo.
3. Colloca il test nel progetto responsabile seguendone convenzioni e framework esistenti.
4. Per un contratto condiviso, verifica sia il produttore sia almeno il consumatore interessato.
5. Mantieni i test nel repository insieme al codice che verificano.

Non creare test per modifiche esclusivamente documentali o refactoring senza cambiamenti osservabili, ma motiva la scelta nel pre-flight. Non cancellare, disabilitare, saltare o indebolire test esistenti per ottenere un esito positivo.

## 7. Rapporto pre-flight e approvazione

Prima di modificare file produci un **RAPPORTO PRE-FLIGHT** contenente:

- ID del task e specifiche consultate;
- componenti, file e test pertinenti;
- criteri di accettazione e matrice d'impatto del task;
- test da creare, aggiornare ed eseguire;
- vincoli, rischi e divergenze;
- file che verrebbero modificati e implementazione proposta.

Dichiara esplicitamente: **Nessun file del progetto è stato modificato.**

Registra il completamento del pre-flight tramite `company_update_task_status`, se disponibile, quindi fermati e attendi l'approvazione esplicita dell'utente. La richiesta iniziale non vale come approvazione all'implementazione.

L'approvazione del pre-flight autorizza soltanto la creazione del branch e la modifica dei file. Non autorizza test, commit, push né pull request: questi passi richiedono la conferma separata della revisione descritta al §10.

## 8. Branch Git obbligatorio

Dopo l'approvazione e prima di modificare file:

1. Se è presente una issue Jira, usa `company_transition_jira_issue` con stato `InProgress`.
2. Chiama `company_create_task_branch` con il `taskId` corrente.
3. Usa esclusivamente il branch restituito dal Control Plane.
4. Recupera il branch remoto, esegui il checkout e verifica il tracking.

Non lavorare sul branch base e non eseguire force-push. Se il branch non può essere creato o recuperato, riporta Jira a `ToDo`, registra il task come `Blocked` e non modificare file.

## 9. Implementazione

Sul branch governato:

1. Applica soltanto le modifiche approvate.
2. Crea o aggiorna i test individuati nel pre-flight.
3. Non eseguire test, commit né push: le modifiche restano nel workspace locale, sul branch del task.

## 10. Revisione delle modifiche

Terminate le modifiche:

1. Registra il task come `WaitingReview` tramite `company_update_task_status`.
2. Presenta all'utente l'elenco dei file modificati e una sintesi di ogni modifica, in modo che possa rivederle sul branch.
3. Fermati e attendi la conferma esplicita dell'utente. L'approvazione del pre-flight non vale come conferma della revisione.

Se l'utente accetta le modifiche, registra il task come `ReviewApproved` tramite `company_update_task_status` e prosegui con il §11.

Se l'utente non è soddisfatto, registra il task come `PreflightReady` tramite `company_update_task_status` e prepara un nuovo rapporto pre-flight sullo stesso `taskId`, a partire dalle modifiche già presenti sul branch e dalle indicazioni dell'utente. Il ciclo riprende dal §7: nuova approvazione, nuove modifiche sullo stesso branch, nuova revisione. `company_create_task_branch` restituisce il branch già collegato al task, e il lavoro prosegue lì senza scartare le modifiche precedenti, salvo indicazione esplicita dell'utente.

Il Control Plane rifiuta verifica, pull request e completamento di un task dell'agent che non sia `ReviewApproved`.

## 11. Verifica e pubblicazione

Solo dopo la conferma della revisione:

1. Esegui prima i test mirati, poi le verifiche richieste dagli `AGENTS.md` dei componenti coinvolti.
2. Per modifiche trasversali, esegui i test di tutti i componenti impattati dalla matrice.
3. Registra i comandi realmente eseguiti e i relativi risultati; non dichiarare verifiche mai lanciate.
4. Se i controlli falliscono, non effettuare il push, riporta Jira a `ToDo` e registra il task come `Blocked` con il dettaglio dell'errore.
5. Se i controlli pertinenti passano, crea un commit limitato ai file approvati e pubblica il branch remoto. Nei cicli successivi al primo aggiungi un nuovo commit sullo stesso branch, senza riscrivere quelli già pubblicati.

Non inserire credenziali, token, configurazioni cliente o dati reali nei file, nei commit, nei log o nell'output del task. I test con database, code, filesystem o servizi esterni devono usare ambienti e dati isolati e non distruttivi.

## 12. Pull request e CI

1. Apri la pull request tramite `company_open_pull_request` soltanto dopo commit, test e push. Se il task ha già una pull request aperta, lo strumento restituisce quella: il push l'ha già aggiornata e la CI riparte sui nuovi commit.
2. Inserisci nel titolo o nella descrizione task, eventuale issue Jira, componenti modificati e test eseguiti.
3. Chiama `company_get_pull_request_status` e rispetta i check richiesti dal progetto.
4. Se i check sono in corso, mantieni il task nello stato `ReviewApproved` e riutilizza lo stesso `taskId` al controllo successivo.
5. Se un check fallisce, riporta Jira a `ToDo` e il task a `Blocked` indicando il check fallito.
6. Quando i controlli richiesti passano, porta Jira a `Completed` e poi il task Control Plane a `Completed`.

L'agent non deve eseguire merge, pubblicazione di release o distribuzione. Squash/merge, stato `Merged`, release e stato `Distributed` restano azioni dell'operatore tramite Control Plane.

## 13. Revisione operatore dopo il completamento

1. Se, a task già `Completed`, l'operatore non è soddisfatto e chiede altri aggiustamenti, registra il task come `PreflightReady` tramite `company_update_task_status` e ripeti il pre-flight sulla nuova richiesta, con lo stesso `taskId`.
2. Il processo itera di nuovo dal §7, compresa la revisione delle modifiche del §10.

## 14. Confini del cambiamento

- Non includere modifiche locali preesistenti dell'utente nel commit.
- Non modificare file generati, binari, output di build o dati persistenti salvo esplicita richiesta approvata.
- Non modificare workflow, Dockerfile o configurazioni di distribuzione se non fanno parte del pre-flight approvato.
- Se emerge la necessità di cambiare altri componenti, aggiorna il pre-flight e ottieni una nuova approvazione prima di estendere il perimetro.

## 15. Analisi delle riunioni

Si applica quando l'utente chiede di analizzare, sintetizzare o classificare una riunione registrata, per esempio "Analizza e sintetizza la trascrizione TRJ-33987FE1CC38", o di trovare le riunioni di un progetto.

Non apre un task: niente `company_prepare_task`, niente branch, nessun file del repository modificato. Resta valida la verifica del server MCP del §1, con gli strumenti di questa sezione al posto di `company_prepare_task`.

1. Trova la riunione con `company_find_meetings`, passando ciò che l'utente ha indicato: una parte del titolo, la sessione del registratore (per esempio `T2026-09-29_001`) o un id `MTG-…` / `TRJ-…`. Per restringere al progetto indica `projectId` (`istanta4`); per "l'ultima riunione" usa `company_list_meetings`.
   - Se corrisponde una sola riunione, prosegui con il suo id.
   - Se ne corrispondono più d'una, elencale all'utente (titolo, progetto, sessione, data) e chiedigli quale intende. Non sceglierne una da solo, neanche la più recente.
   - Se non ne corrisponde nessuna, chiedi all'utente un altro titolo, la sessione o il progetto.
2. Leggi la trascrizione con `company_get_meeting_transcript`. Se il testo termina con l'indicazione di un `offset`, richiama lo strumento fino all'ultimo segmento: l'analisi si fa sulla riunione intera, mai su una parte.
3. Individua gli argomenti trattati e classifica ciascuno con un solo tipo:
   - `idea`: una proposta o una possibilità, non decisa;
   - `discussion`: un tema dibattuto senza conclusione;
   - `decision`: una scelta presa o concordata;
   - `requirement`: un vincolo o una funzionalità che il prodotto deve soddisfare;
   - `conflict`: posizioni divergenti, o una divergenza da ciò che è già deciso o scritto nelle specifiche.
4. Per ogni argomento indica titolo, obiettivo, confidenza (da 0 a 1) e le fonti: una per ogni parlante che vi ha contribuito, con gli id dei suoi segmenti e il punto saliente detto con parole tue. Non attribuire a una persona ciò che la trascrizione non le attribuisce; le "Voce N" del microfono d'ambiente restano tali.
5. Consegna sintesi e argomenti con `company_submit_meeting_analysis`, nella lingua della riunione. Se il Control Plane rifiuta la consegna, correggi tutti i problemi elencati e reinvia.
6. Riporta all'utente la sintesi, il numero di argomenti per tipo e il link alla revisione restituito dallo strumento. Se la trascrizione era una bozza non revisionata, dillo.

L'analisi resta in attesa della revisione umana nel Control Plane. Quando una riunione serve come fonte per specifiche o requisiti, leggila con `company_get_meeting_analysis` e `onlyApproved` impostato a `true`: solo gli argomenti approvati valgono come decisioni o requisiti; gli altri sono indizi da verificare con l'utente.

Se la stessa richiesta chiede anche di modificare il codice, l'analisi segue questa sezione e la modifica il protocollo dei task, dal §1.
