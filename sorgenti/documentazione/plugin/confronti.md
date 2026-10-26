# confronti.js

**Cosa è:** il motore di confronto — quello che c'è nel documento InDesign messo a fianco di
quello che dice il dato. Cinque membri, 1.035 righe.

**Fino a I20-1014 questo file era anche il Report Integrità**, con tutta la sua interfaccia: 7.443
righe, 233 membri. Il report è uscito in [reportIntegrita/](reportIntegrita/README.md), e qui è
rimasto il motore, che **non usa niente del report** e lo usano in tanti.

---

## Chi lo usa

| chi | cosa |
|---|---|
| il cambio strutturale (`schedaRef.salvaCambioStrutturaleDo`) | `confrontoBox` |
| la reimpaginazione di una referenza (`impaginazioneSingoloIndd` in `indexNew.js`) | `confrontoBox`, `confrontoBoxCompiledFieldPreAnalisi` |
| la scheda (`differenzeDescrizioneDelBox`, `differenzeDatiNelBox`) | `confrontoBoxCompiledFieldPreAnalisi`, i suoi `blocchi` per il giallo della descrizione |
| il ricalcolo del conteggio della griglia (`griglia.ricalcaConteggio`) | `mappaturaImpaginato` |
| il ricollegamento delle foto (`ricollegaFotoMassivo`) | `mappaturaImpaginato` |
| il Report Integrità | `mappaturaImpaginato`, `semplificazioneMappaImpaginato`, `confrontoBoxCompiledFieldPreAnalisi` |

`indexNew.js` lo dichiara come `confronti` e gli altri lo usano da lì.

## Funzioni

### Confrontare

- `confrontoBox(box1, box2, forzaReimpaginazione)` → **308 righe.** Due box a confronto: quando un
  box viene rifatto, porta nel nuovo quello che l'operatore aveva cambiato a mano nel vecchio.
  Con la stessa meccanica tiene una **copia del box vecchio** e ci riporta dal nuovo testi, stili di
  paragrafo e immagini cambiate; se ci sono differenze il vecchio resta come **clone** sul livello
  `cloneVecchioImpaginato`, spostato di 10, altrimenti si cancella. Dal I20-1046 per gli elementi
  **decisi dalle regole** — la base e i campi `base*`, i loghi e gli sfondi automatici
  (`foto_extra$…`, `sfondo$…`; `elementoDecisoDalleRegole`, fuori dall'oggetto) — riporta anche
  **visibilità e stile oggetto**, e contano come differenze. Prima una forzatura che cambiava solo
  quelli (Artisti della Qualità di Edro21: base ADQ, logo e sfondo del Buono del Paese nascosti)
  spariva con il box nuovo, senza clone.
- `confrontoBoxCompiledFieldPreAnalisi(...)` → **389 righe.** Un box e i suoi record: cosa non
  corrisponde più. È il confronto fatto sui campi già compilati, senza rileggere il box: la via
  veloce. **`checkMD5` a `false` salta il confronto degli hash delle foto**, che è la parte cara.
  Dal I20-1140 un logo idms extra auto che il plugin di agenzia dichiara in `loghiConTesto`
  (`pluginMiddleware.getLoghiConTesto`) si confronta anche sul testo: `differenzaTestoLogo` legge il
  primo riquadro di testo del logo e lo confronta col campo del dato (`<br>` è un a capo, maiuscole e
  spazi in più non contano). Per Edro21 è il logo attributo italiano, testo in `logo_attributo_it`.
  Dal I20-1143 la differenza "contenuto" di un campo a stili di carattere, come la descrizione,
  porta anche `blocchi` (`blocchiDescrizioneDiversi`): quali blocchi del box non tornano col server.
  La scheda li segna in giallo, con lo stesso verdetto che accende "Applica descrizione da server".
- `blocchiDescrizioneDiversi(trattiBox, contenutoServer, nomeDelloStile)` → (I20-1143) il confronto
  blocco per blocco della preanalisi: stessi stili senza gruppo, testi senza spazi, a capo, `<br>` e
  `°`. `{ diversi, mancanti, ordineDiverso }`. `blocchiDelContenuto` scompone il contenuto del
  server nei suoi blocchi, senza i tratti `_$Hidden`.
- `testiDelleFondamentali(contenuto, fondamentaleDi, normalizza)` → (I20-1143) il testo con cui il
  server compone ciascuna descrizione fondamentale, spazi e a capo compresi: il salvataggio della
  scheda lo usa per accorgersi di uno spazio o un a capo cambiato.
- `fondamentaliAlterateDaEsportazione(contenuto, archivio, fondamentaleDi, normalizza)` → (I20-1143)
  le fondamentali che l'export ha alterato rispetto all'archivio: testo cambiato, nascosto o tolto.
  Spazi, a capo e `<br>` non contano, così i separatori di Coop (spazio davanti) ed Edro21 (a capo
  in coda) non bastano. Senza blocchi riconosciuti non giudica.
- `decodeSpecialCharacters(text)` → i caratteri speciali del testo InDesign, per confrontare il
  testo come lo legge l'operatore.

### Mappare l'impaginato

- `mappaturaImpaginato(pag, infoDescrizione, simplified)` → **236 righe.** Quali referenze stanno in
  quali box, a quale pagina.
- `semplificazioneMappaImpaginato(mappa)` → la stessa mappa ridotta a quello che chiede il server:
  per ogni pagina, i codici gruppo.

## Variabili globali

Nessuna propria. Usa le globali di `indexNew.js` — `docInLavorazione`, `pathLavorazione`, `Utility`,
`messaggioUtente`, `addToGarbageCollector` — e importa solo `ricollegaEsiti`, `noRenderElementi` e `fs`.

**Non fa più `require('indesign')`:** dopo l'uscita del report non gli serviva, e il file si carica
sotto Node. Le funzioni però lavorano su oggetti InDesign che arrivano dal documento, quindi
provarle vuol dire fornire un documento finto.

## Cosa è stato rimosso

- **In I20-1014:** `testMappaturaImpaginato` e `ripristinaCacheConfronto`, senza chiamanti, su
  decisione dell'operatore; e i `require` di `InputEditController`, `GarbageCollector`, `path` e
  `process`, che non usava nessuno.
- **In I20-1002:** `_crPageSection`, `_setConfrontoVisibilityFilter`, `_toggleHiddenElemento`, 62
  righe senza chiamanti. Erano pannelli del report.
