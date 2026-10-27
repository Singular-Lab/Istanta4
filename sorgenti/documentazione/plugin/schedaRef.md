# schedaRef.js

**Cosa è:** la scheda della referenza — quello che l'operatore vede e modifica quando seleziona un
box nel documento.

**145 membri propri in 6.207 righe**, più i 36 della [parte foto](reperimentoFoto/schedaFoto.md)
mescolati dal I20-1015, tutti sullo stesso piano: qui non c'è la distinzione fra pubblico e
privato che c'è nel [Report Integrità](reportIntegrita/README.md).

## Le famiglie

| famiglia | membri |
|---|---|
| clonazione | 26 |
| foto | 28 |
| schermate e pannelli | 9 |
| salvataggio | 6 |
| report | 5 |
| descrizione | 5 |
| ricollegamento | 2 |
| resto | 101 |

## Due funzioni enormi, il 23% del file

- **`attivaSchermateReferenza(meccanica, box, page)` — 1.194 righe.** L'apertura della scheda: legge
  il DNA del box, costruisce tutte le schermate, aggancia i controlli.
- **`openModalCambiaFoto(codice)` — 1.066 righe.** Il cambio foto: l'elenco delle disponibili,
  l'anteprima, la scelta, lo scaricamento.

Seguono `EditFotoPrimarieSecondarie` (565), `linkLogoBollo` (220), `updateImmagine` (211),
`ricollegaBoxImpaginato` (209), `salvaModifiche` (171), `FotoExtraPanel` (167).

## Lo stato: ventidue variabili

È il file con più stato del Plugin, e si capisce: la scheda è una schermata viva.

`refSelected` è **la variabile più letta del Plugin** — quasi ogni file che vuole sapere «su cosa
sta lavorando l'operatore» guarda lì. Con lei: `multiSelection`, `schedeRefDati`,
`elementiNoRenderDelBox`, `statoFotoAllApertura`, `multiSchedeRef`, `editRefFieldController`,
`idRecordLavorazione`, `isBusy`, `isInvalidated`, `segnalazioniDelBox`,
`refConSegnalazioniSilenziate`, `selezioneClonazioneCorrente`.

## Alcune funzioni che vale la pena conoscere

- `salvaModifiche(...)` → manda al server quello che l'operatore ha cambiato. **Cosa sia cambiato
  davvero lo dice [InputEditController](InputEditController.md)**, che tiene da parte i valori di
  partenza: senza quel confronto si riscriverebbe tutto a ogni conferma. Dopo un salvataggio
  registrato da Istanta, senza cambio strutturale, `allineaBoxDopoSalvataggioScheda` riscarica la
  scheda e la confronta col box come dopo le primarie e secondarie (`allineaBoxDopoSalvataggioPS`):
  tipo di box cambiato, si reimpagina; dati non più allineati, per esempio un logo che la descrizione
  nuova fa entrare o uscire, si chiede "Aggiorno il box?" (I20-1140). Se il box viene rifatto
  (`applicaReimpaginazione` lo ricorda in `boxReimpaginato`) la scheda lo segue con
  `seguiBoxRicostruito` e si ricarica su quello.
- `ricollegaBoxImpaginato(box, externalCall, codiceGruppo)` → riaggancia un box alla sua referenza.
  Gli esiti che il server manda indietro si leggono con [ricollegaEsiti](ricollegaEsiti.md), che è
  verificabile.
- `scegliCandidatoFoto`, `motivoPropostaFoto`, `fotoDaProporreDallaCartella` → la proposta
  automatica di una foto trovata nella cartella.
- `getRiscontriFotoConNome`, `buildMessaggioRiscontriFoto` → cosa dire quando più foto hanno lo
  stesso nome.
- `azioniStrutturaliAggiunte`, `opzioneAzioniStrutturali`, `aggiornaTendinaOpzioniStrutturali` →
  le azioni sul box già aggiunte, l'opzione gruppo/primario con cui salvarle, e quando mostrare la
  tendina della scelta. La tendina si vede solo per un gruppo con almeno un'azione e più di
  un'opzione valida; con una sola opzione si usa quella. Lo stato è in `azioniStrutturaliDisponibili`
  e `azioniDiGruppo`. La regola sulle opzioni è in [cambiStrutturali](cambiStrutturali.md)
  (I20-1049).
- `differenzeDaAllineare`, `differenzeDescrizioneDelBox`, `gialloDellaDescrizione` → (I20-1143) il
  giallo delle caselle della descrizione e "Applica descrizione da server" nascono dalle stesse
  differenze della preanalisi: le caselle dei blocchi diversi si colorano, il resto (un blocco del
  server che nel box manca, l'ordine, lo stile di paragrafo) va in righe gialle sotto i campi
  (`mostraGialloDescrizione`). Una differenza di soli spazi o a capo non accende niente. Un campo
  descrizione vuoto si riempie prima di decidere (`riempiDescrizioneVuota`).
- `schemaDellaDescrizione`, `stileNelloSchema`, `postoNelloSchema`, `regoleDelloSchemaValide` →
  (TASK-5d3fea89) lo schema delle descrizioni dell'agenzia (`schemiDescrizioni`) applicato nella
  schermata di modifica: vale il primo le cui regole valgono (blocchi `{ regole }` valutati con
  `pluginMiddleware.valutaBloccoRegole`; prima non si valutavano e vinceva sempre il primo) e che
  contiene in ordine gli stili del box che gli schemi conoscono. Gli stili che nessuno schema prevede,
  come il campo offerta dei boxetti di Edro21, non lo impediscono più e restano caselle loro. Un tratto
  nascosto dall'esportazione (`_$Hidden`) compare in sola lettura al posto della casella vuota del suo
  elemento (`casellaDelTrattoNascosto`) e, riscrivendo il box dopo un salvataggio, resta nascosto.
  Le caselle degli elementi dello schema che il box non ha vanno prima dei blocchi in coda che nessuno
  schema prevede (`ultimoTrattoDelloSchema`, `completaLoSchema`). Le etichette mostrano il nome senza
  cartella e, per le caselle in sola lettura, il perché accanto su una riga sola
  (`etichettaDellaCasella`, `indicazioneSolaLettura`: "alterato da logiche agenzia", "nascosta da
  logiche agenzia" o "sola lettura"); quelle caselle hanno sfondo e bordo propri
  (`segnaCasellaDisattivata`), che il riquadro a riposo ricopia, a differenza dell'opacità. Sotto i
  campi la nota di una descrizione alterata non si ripete se ha una casella (`noteSottoICampi`);
  quelle dell'agenzia restano. L'etichetta troncata si legge intera al passaggio del mouse: il testo
  sta nel `title`, che disegna il [Tooltip](tooltip/README.md) del Plugin. Le caselle seguono la larghezza del
  pannello: ogni colonna è larga la sua parte di riga (`stileDellaColonna`) e la casella è al 100%;
  dalla configurazione dell'agenzia (`grandezzeBox`) contano solo caselle per riga, altezza e spazio
  (`misureDelleCaselle`), non più la larghezza in pixel. Gli avvisi sotto le caselle hanno il bordo
  sinistro del loro colore (`stileDellAvviso`) e la sezione «Azioni sul box» è separata da una linea.
- `descrizioniAlterateDaEsportazione`, `archivioDescrizioneDelPrimario`, `testiCompostiDelPrimario`
  → (I20-1143) le fondamentali che l'export ha alterato rispetto all'archivio della scheda vanno in
  sola lettura come quelle dell'agenzia (I20-1132), con la nota "DescrizioneN (Alterato da
  logiche agenzia)" sotto i campi quando non hanno casella, e partono non toccate. Col meta della
  descrizione non si giudica. I testi composti vanno al controller, perché il Salva veda anche uno
  spazio o un a capo cambiato. Girano mentre si costruisce la schermata: se non riescono la scheda
  si apre come prima, con l'avviso `SRF-133` (un'eccezione lì lasciava la scheda in caricamento).

---

## Tre concetti dentro un file

Il file non li distingue, ma ci sono, e l'operatore ha deciso di separarli. Nel codice ogni membro
che appartiene a uno di essi è **marcato**, così i task li ritrovano con un grep.

### 1. Procurarsi la foto — uscita in I20-1015

Quale foto va su questa referenza, chiederla al server, scaricarla, sostituirla, gestire extra ed
extra auto. **Dal I20-1015 sta in [reperimentoFoto/schedaFoto.js](reperimentoFoto/schedaFoto.md)**:
36 membri, 3.489 righe, mescolati in fondo a `schedaRef.js` con `Object.assign`, quindi ancora
membri della scheda. Il resto del concetto è in [reperimentoFoto/](reperimentoFoto/README.md).

**Non va confuso con il `fixFoto` di [sistemazioneFoto](sistemazioneFoto/02-sistemazione-foto.md)**, che
decide *dove* la foto sta dentro il box. Sono due concetti diversi e **due task distinti**:

| concetto | dove vive oggi | task |
|---|---|---|
| **procurarsi** la foto giusta | [`plugin/reperimentoFoto/`](reperimentoFoto/README.md), raccolta da `schedaRef`, `indexNew`, `cmd.js` e `utility` | I20-1015, fatto |
| **collocarla** nel box | [`plugin/sistemazioneFoto/`](sistemazioneFoto/README.md), uscita da `CssFramework` | I20-1009, fatto |

### 2. La clonazione — 26 membri

Duplicare una referenza su più box è un'altra cosa rispetto al modificarne i campi.

### 3. Il Report Integrità — 5 membri

`DAL_REPORT_VOCI_BARRA_NASCOSTE`, `DAL_REPORT_VOCI_SOTTOMENU_NASCOSTE`, `apertaDalReport`,
`refDalBoxPerReport`, `serveRiaggancioDalReport`: dicono come la scheda si comporta quando viene
aperta **dal report** invece che dal documento — la barra e i sottomenù si riducono, perché
l'operatore sta guardando una referenza segnalata, non navigando.

Dal I20-1014 il report ha una cartella sua, [reportIntegrita/](reportIntegrita/README.md), ma questi
membri **restano qui, di proposito**: sono stato della scheda, e il report li imposta da fuori. Il
perché è nel README del report.

## Cosa è stato rimosso in I20-1002

`ImpostaPSSottogruppi`, 84 righe: una sola occorrenza, la definizione.

`selezioneClonazioneCorrente` era segnalata nel preflight ma **è viva**: usata sei volte nel file.
Stesso falso positivo di [filtri.md](filtri.md) — il controllo non vedeva le chiamate sugli oggetti
con nome minuscolo.
