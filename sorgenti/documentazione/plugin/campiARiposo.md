# campiARiposo.js

*Nasce con I20-1123. Lo avvia `indexNew.js` all'apertura del Plugin, subito dopo i suggerimenti;
lo chiamano le modali, il caricamento, il calendario e il menu flottante, i suggerimenti, il
riquadro Info del report e la scheda ref.*

**Cosa è:** i campi di testo del Plugin **a riposo**. Quando l'operatore non ci sta scrivendo, al
posto di ogni campo c'è un riquadro HTML con le stesse misure, gli stessi colori e lo stesso testo.
Al passaggio del mouse il riquadro lascia il posto al campo vero, e il clic dell'operatore cade su di
lui; quando l'operatore ne esce, o qualcosa gli compare sopra, torna il riquadro col testo aggiornato.

## Perché serve

In UXP i campi di testo nativi (`textarea`, `input`, `sp-textfield`) stanno **sopra a qualunque
elemento HTML** del pannello, con qualunque `z-index`. È un limite dichiarato da Adobe fra i
[Known Issues di UXP](https://developer.adobe.com/indesign/uxp/uxp/known-issues/), e un campo di
testo HTML non c'è: UXP non supporta `contenteditable`. Suggerimenti, popup, domande, finestre e
menu finivano sotto le caselle (lo screenshot di I20-1123: il suggerimento delle segnalazioni
coperto dalla casella "al kg").

Fino a I20-1123 i campi si nascondevano a mano: ogni campo marcato `.hideble`, spento da
`Modali.nascondiHidebleElements` all'apertura di una finestra e riacceso da
`mostraHidebleElements` alla chiusura. Un campo senza la classe, o un "riaccendi" nel momento
sbagliato (`hideLoading` a popup aperto, I20-1029), tornava sopra. E i suggerimenti non c'erano
proprio: nascondere i campi a ogni suggerimento non è una soluzione.

Qui il problema si risolve **nei campi**, una volta sola: a riposo il campo è HTML, e tutto ci passa
sopra.

## Le prove in console (21/10/2026, con l'operatore)

| prova | esito |
|---|---|
| una regola CSS che spegne i campi (`body[data-…] textarea { visibility: hidden }`) | UXP la ignora sui campi nativi |
| il popover di UXP (`sp-overlay` + `sp-popover`) per suggerimenti e domande | sta sopra i campi, ma si chiude al primo clic fuori: non va bene per finestre e caricamento, e andava rifatto ogni riquadro del Plugin |
| il riquadro a riposo, campo vero al **clic** con `focus()` da codice | il campo riceve `focus` e `keydown` ma **nessun `input`**: non scrive e non mostra il cursore. Un campo nativo si attiva solo col clic vero del mouse |
| campo vero al passaggio del mouse, a riposo all'**uscita** del mouse | la casella nativa manda entrata e uscita a raffica anche col mouse fermo: oscilla, e uscendo può restare nativa. Il movimento del mouse (`mousemove`) non arriva al codice |
| **campo vero al passaggio del mouse, a riposo al clic altrove e quando qualcosa compare sopra** | un clic, cursore e scrittura; il suggerimento sta sopra |

L'aspetto del testo nativo si è misurato **al pixel**, su coppie di screenshot della stessa casella
a riposo e col campo vero, convertiti e confrontati riga per riga: stesso corpo e carattere
(10px `system-ui`), testo a **5 px** dal bordo sinistro, **interlinea 13 px** (quella "normale" del
riquadro era 11,7: la prima riga saltava di 2 px), bordo `#747474`. Nelle caselle col bordo giallo
(descrizione in mismatch, `border: 2px solid gold`) il campo nativo disegna **il bordo dello stile e
dentro il suo bordo grigio**: 2 px giallo, 1 px grigio, poi il testo a 5 px. Per questo il riquadro
è a due livelli (vedi sotto). La casella **Ordine** del Menabò (un campo di una riga) ha sfondo
`#444444`, sopra e sotto una riga chiara `#bcbcbc` fuori e una `#8e8e8e` dentro, ai lati il grigio,
angoli arrotondati; il testo sta **a sinistra** anche se lo stile dice `text-align: center` (il campo
nativo lo ignora), e il campo occupa **45 px** con uno stile da 40. Il campo nativo non dà misure
utili da codice (`scrollHeight` è sempre 0). Margine e interlinea si scrivono **alla nascita** del
riquadro: cambiati dopo, a schermo non si vedeva differenza.

## Come funziona

- **Il giro.** Ogni `INTERVALLO_MS` (250 ms) e, se UXP ha `MutationObserver`, appena la pagina
  cambia, `giro()`:
  - mette a riposo i campi nuovi che si vedono;
  - allinea i riquadri al campo (valore scritto da codice, larghezza, altezza, colori, bordo, se il
    campo è nascosto);
  - toglie i riquadri dei campi spariti e quelli copiati senza campo, cioè le schermate clonate da
    `cloneElementWithEvents`.
- **Il riquadro ha due livelli**, come il campo nativo: fuori le misure, lo sfondo e il bordo dello
  stile del campo (nessuno, se lo stile non ne ha; nei campi di una riga la riga chiara di sopra e di
  sotto); dentro il bordo grigio nativo (nei campi di una riga, sopra e sotto il `#8e8e8e`), il
  margine, l'interlinea e il testo, sempre a sinistra.
- **La larghezza** è quella che il campo ha quando nasce il riquadro, se lo stile la dà in pixel (non
  è quella vera: il campo nativo occupa qualche pixel in più); se lo stile la dà in percentuale, il
  riquadro tiene la percentuale e segue il pannello.
- **A riposo** il campo resta nella pagina, con `visibility: hidden` e `position: absolute`, e il
  riquadro sta subito prima di lui. Non si usa `display`: chi nasconde o mostra il campo con
  `display` (jQuery `hide`/`show`) non si scontra con il riposo, e il riquadro lo segue.
- **Il mouse entra nel riquadro** (o, se l'entrata non arriva, si preme il tasto): il riquadro
  sparisce e al suo posto c'è il campo vero, **senza** stato attivo dato da codice. Il clic
  dell'operatore cade sul campo: cursore dove ha cliccato, e chi ascolta il clic del campo lo riceve
  come sempre (il campo data di [menu.js](menu.md) apre il calendario).
- **Torna a riposo** quando:
  - l'operatore esce dal campo dopo averci scritto (`blur`);
  - l'operatore clicca altrove, se il campo era solo sfiorato (`_clicNellaPagina`, ascoltato sulla
    pagina da `avvia`);
  - il mouse passa su un altro campo: quelli solo sfiorati tornano a riposo, quello in cui si
    scrive resta;
  - qualcosa compare sopra il pannello: `tuttiARiposo()`. In questo caso esce dalla modifica anche
    il campo in cui si sta scrivendo.
- **Il resto del Plugin non cambia.** `.val()`, gli eventi `input` e `change`, il salvataggio della
  scheda lavorano sul campo vero, che c'è sempre.

## Variabili globali

| nome | valore | perché |
|---|---|---|
| `INTERVALLO_MS` | `250` | ogni quanto il giro allinea i riquadri: un valore scritto da codice non lo annuncia nessun evento |
| `ATTRIBUTO_SEMPRE_NATIVO` | `data-sempre-nativo` | un campo con questo attributo resta nativo |
| `TIPI_DI_TESTO` | `""`, `text`, `number`, `search`, `email`, `tel`, `url` | gli `input` da mettere a riposo. La password no: in un riquadro si leggerebbe in chiaro |
| `CORPO`, `CARATTERE` | `10px`, `system-ui` | il testo nativo di UXP |
| `RIEMPIMENTO` | `0px 5px` | misurato: niente sopra, 5 px ai lati (anche a destra, per andare a capo dove va a capo il campo) |
| `INTERLINEA` | `13px` | misurata, nelle caselle di più righe |
| `SFONDO_NATIVO`, `TESTO_NATIVO` | `#444444`, `#dddddd` | sfondo e testo del campo nativo quando lo stile del campo non dice niente (sfondo misurato sulla casella Ordine) |
| `BORDO_RIGA_FUORI`, `BORDO_RIGA_DENTRO`, `ANGOLI_RIGA` | `1px solid #bcbcbc`, `1px solid #8e8e8e`, `2px` | sopra e sotto dei campi di una riga, e i loro angoli |
| `BORDO_NATIVO`, `SPESSORE_BORDO_NATIVO` | `1px solid #747474`, `1` | il bordo grigio che il campo nativo disegna sempre, dentro quello dello stile: va nel livello interno del riquadro |
| `TESTO_SPENTO` | `#9a9a9a` | testo d'esempio e campi disattivati |
| `CLASSE_RIQUADRO` | `campoARiposo` | |
| `ATTRIBUTO_SPENTO` | `data-a-riposo` | il segno sul campo spento da noi: una schermata copiata ne copia anche lo stile, e col segno si sa che non è il suo |

## Funzioni

- `eCampoDiTesto(elemento)` → se è un campo da mettere a riposo: `textarea`, `sp-textfield` (non
  password), `input` dei `TIPI_DI_TESTO`; mai con `data-sempre-nativo`.
- `testoDaMostrare(valore, segnaposto)` → `{ testo, segnaposto }`: il valore o, se è vuoto, il
  testo d'esempio (che il riquadro mostra in grigio).
- `righe(testo)` → le righe, qualunque sia l'a capo.
- `unaRiga(campo)` → se è un campo di una riga: `input`, o `sp-textfield` senza etichetta.
- `interlinea(campo)` → `INTERLINEA` per le caselle (e i `sp-textfield` con l'etichetta); per i
  campi di una riga, l'altezza interna del campo, senza il bordo dello stile e senza il grigio
  nativo: il campo nativo mette il testo a metà altezza.
- `spessoreBordo(bordo)` → lo spessore scritto nello stile (`"2px solid gold"` → 2), 0 se non c'è.
- `avvia()` → il giro a intervalli, l'osservatore e l'ascolto del clic sulla pagina. Una volta sola.
- `giro()` → un giro. Lo chiama anche la scheda ref dopo aver ricostruito le caselle con la
  finestra delle differenze aperta: le caselle nuove vanno a riposo subito, non al giro dopo.
- `mostra(campo)` → dal riquadro al campo vero, al passaggio del mouse. Un campo disattivato resta a
  riposo.
- `aRiposo(campo)` → dal campo al riquadro, col testo di adesso.
- `tuttiARiposo(tranne)` → tutti i campi mostrati tornano a riposo, anche quello in cui si sta
  scrivendo. Lo chiamano tutti quelli che aprono qualcosa sopra il pannello: `Modali.confirm`,
  `confirmCustom`, `popup`, `apriModal`, `apriModalCustom`, le conferme di
  [eliminazione](modali/eliminazione.md) e del [report](reportIntegrita/pannelli.md), il riquadro
  Info del report, il calendario e il menu flottante di [menu.js](menu.md), `showLoading`, e il
  suggerimento ([tooltip](tooltip/tooltip.md)). `tranne` è l'elemento da cui parte il
  suggerimento: se è un campo (col suo `title`), resta com'è, altrimenti passandoci sopra
  comparirebbe e sparirebbe di continuo.

## Da sapere

- **Un campo nuovo è nativo finché il giro non lo trova:** al più un giro, quasi niente se UXP ha
  `MutationObserver`. Il riquadro prende le misure dal campo, quindi un campo si mette a riposo solo
  quando si vede.
- **Un campo sfiorato e lasciato resta nativo** finché non succede una delle cose sopra: se gli
  passa sopra un riquadro che non chiama `tuttiARiposo`, resta sopra. Chi aggiunge un riquadro
  sovrapposto al pannello deve chiamarlo.
- **Col Tab non si passa da un campo all'altro:** il riquadro non prende lo stato attivo, e lo stato
  attivo dato da codice non servirebbe a scrivere.
- **Le caselle delle descrizioni della scheda ref hanno due attributi `class`.** Vale il primo, che
  era `"hideble"`: il secondo (`textArea nonCancellareSeVuoto`, e `mismatchInImpaginato`, che
  `InputEditController` legge) non è mai valso. Il primo resta, vuoto: toglierlo avrebbe acceso il
  secondo e cambiato il salvataggio.
- **I picker** (`sp-picker`) e le caselle di spunta restano nativi: il limite di Adobe riguarda i
  campi di testo.

**Test:** `node --test tests/plugin/campiARiposo.test.js`
