# vistaAffiancata.js

*Nasce con I20-1121. La usano la schermata delle [segnalazioni](segnalazioni/README.md) e il
[Report Integrità](reportIntegrita/flusso.md); `indexNew.js` e `events.js` ne leggono la larghezza
del pannello.*

**Cosa è:** la disposizione del pannello quando è largo. Da **924 px** in su una schermata non copre
più tutto il Plugin: si apre come **colonna fissa a destra**, non modale, e a sinistra il Plugin resta
com'è, largo 524 px (il minimo del manifest), usabile insieme alla colonna.

## Perché un file suo

Le regole sono nate in `segnalazioni/schermata.js` con I20-1116, per le sole segnalazioni, con la
soglia al doppio della larghezza minima (1048 px). Con I20-1121 vale anche per il Report Integrità:
soglia, misure, confinamento e guscio della colonna sono diventati della disposizione del pannello, e
tenerli in una delle due schermate avrebbe voluto dire copiarli nell'altra. Ogni schermata decide da
sé **che cosa** mettere nella colonna; qui si decide **dove** e **quando**.

La soglia l'ha misurata l'operatore in console (`document.documentElement.clientWidth`): il pannello
di tutti i giorni è a 524, e lo vuole affiancato quando lo allarga di circa 400, non al doppio.

## Variabili globali

| nome | valore | perché |
|---|---|---|
| `LARGHEZZA_SINISTRA` | `524` | la larghezza minima del pannello: quella con cui il Plugin resta a sinistra |
| `SOGLIA` | `924` | da qui in su si affianca (prima, I20-1116: 1048) |
| `MARGINE_CORPO` | `8` | il margine del corpo della pagina: gli elementi fissi senza `left` partono da lì |
| `_confinati` | `null` | gli elementi fissi confinati a sinistra, con la larghezza da rimettere |
| `_colonne` | `[]` | gli id delle colonne create, per sapere se ne resta aperta qualcuna |

## Funzioni

- `larghezzaPannello()` → la larghezza del pannello, non quella di `#wrapper`, che nella vista
  affiancata resta ferma a sinistra. **In UXP `window.innerWidth` è `undefined`**: vale la prima
  misura positiva fra `window.innerWidth`, `document.documentElement.clientWidth` e
  `document.body.clientWidth`; 0 se nessuna.
- `forma(larghezza)` → `"colonna"` da `SOGLIA` in su, altrimenti `"popup"`. Senza misura (0) resta il
  popup.
- `inizioColonna()` → 532: dove comincia la colonna, dopo il Plugin di sinistra e il margine.
- `confinamenti(larghezzaSinistra)` → gli elementi fissi sempre a schermo (`#wrapper`, `#header`,
  `#footerRef`, `#footer`, `#messaggiUtente`) e la larghezza che prendono a sinistra.
- `_confina(confina)` → li confina, o rimette la larghezza di prima. Tocca **solo** `width`: il resto
  dello stile può cambiare intanto, e deve restare.
- `colonnaAperta(id)` → se la colonna con quell'id c'è; senza id, se ce n'è una qualsiasi. Si guarda
  se l'id è nel documento: in UXP `closest` su un id appena creato non trovava la colonna.
- `altraColonnaAperta(id)` → se è aperta una colonna diversa: **una colonna alla volta**.
- `creaColonna({ id, titolo, accantoAlTitolo, azioni, alChiudi, scorre })` → il guscio: fissa a
  destra (`right: 0`, da `inizioColonna()` al bordo), sotto le finestre modali e sopra il resto del
  pannello; testata con titolo, quello che sta accanto al titolo (il conteggio delle segnalazioni),
  le azioni e la X, che chiama `alChiudi`; il corpo, che scorre da sé o, con `scorre: false`, lascia
  scorrere il contenuto. Confina gli elementi fissi e restituisce `{ colonna, testata, corpo }`
  (jQuery).
- `togliColonna(id)` → toglie la colonna. Il Plugin torna a tutta larghezza **solo quando non resta
  nessuna colonna aperta**.

## Cose imparate in UXP

- `window.innerWidth` non esiste: la larghezza è quella del documento.
- `right: 0` aggancia al bordo del pannello; le posizioni orizzontali calcolate con
  `getBoundingClientRect` no (il segnalino finiva tagliato, I20-1116).
- `gap` nei flex è ignorato: fra titolo e conteggio c'è un margine vero.

## Chi decide la forma

| schermata | regola |
|---|---|
| Report Integrità | `forma(larghezzaPannello())`: ha la precedenza, e aprendosi a colonna chiude quella delle segnalazioni |
| segnalazioni | come il report, ma è popup se è aperta un'altra colonna (`SchermataSegnalazioni.formaSchermata`) |

Quando il pannello cambia larghezza `events.js` chiama `onresizeWindow`, che adatta **prima il
report e poi le segnalazioni**: così le segnalazioni sanno già se il report occupa la colonna.

**Test:** `node --test tests/plugin/vistaAffiancata.test.js`
