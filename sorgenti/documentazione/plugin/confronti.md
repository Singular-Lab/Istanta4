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
| la scheda (`descrizioneDisallineata`, `differenzeDatiNelBox`) | `confrontoBoxCompiledFieldPreAnalisi` |
| il ricalcolo del conteggio della griglia (`griglia.ricalcaConteggio`) | `mappaturaImpaginato` |
| il ricollegamento delle foto (`ricollegaFotoMassivo`) | `mappaturaImpaginato` |
| il Report Integrità | `mappaturaImpaginato`, `semplificazioneMappaImpaginato`, `confrontoBoxCompiledFieldPreAnalisi` |

`indexNew.js` lo dichiara come `confronti` e gli altri lo usano da lì.

## Funzioni

### Confrontare

- `confrontoBox(box1, box2, forzaReimpaginazione)` → **308 righe.** Due box a confronto: quando un
  box viene rifatto, porta nel nuovo quello che l'operatore aveva cambiato a mano nel vecchio.
- `confrontoBoxCompiledFieldPreAnalisi(...)` → **389 righe.** Un box e i suoi record: cosa non
  corrisponde più. È il confronto fatto sui campi già compilati, senza rileggere il box: la via
  veloce. **`checkMD5` a `false` salta il confronto degli hash delle foto**, che è la parte cara.
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
