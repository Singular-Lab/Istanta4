# fotoPlacer.js — collocare il file nel riquadro

**Cosa è:** l'oggetto `FotoPlacer`, tre membri, 233 righe. Stava in `utility.js` come oggetto a sé;
in I20-1015 è entrato in `reperimentoFoto/`. Panoramica: [README.md](README.md).

## Funzioni

- `placeFoto(nomeFoto, fotoRectangle, callback)` → mette il file della foto nel riquadro.
- `updateFoto(nomeFoto, box, fotoRectangle, codice, statoSelezione, noRender)` → sostituisce la foto
  di un riquadro già impaginato, e ne restituisce l'esito. È quello che usano
  `impaginaFotoAppenaDisponibile` e il cambio foto dalla scheda.
- `applicaNoRender(fotoRectangle, noRender)` → nasconde o mostra la foto secondo il noRender.
- `piazzaFotoExtraAuto(extra, box, paginaDelBox, doc)` → mette nel box un logo automatico (I20-1026),
  per l'impaginazione e per il fix. **Dal I20-1140 un logo il cui file non si apre non ferma gli
  altri:** il riquadro vuoto si toglie, `avvisaLogoSenzaFile` avvisa l'operatore con FPL-01 e il nome
  del file, e la funzione restituisce `null`, che `impaginaBox` e `CssFramework` scartano. Prima
  l'eccezione usciva dal giro dei loghi e quelli dopo non venivano messi (IDX-55).

## Da dove si prende

**Da `utility.js`, come prima.** `utility.js` lo importa e lo riesporta con lo stesso nome:

```javascript
const FotoPlacer = require('./reperimentoFoto/fotoPlacer');
...
module.exports.FotoPlacer = FotoPlacer;
```

Il core (`indexNew.js`) e le agenzie Coopfi e Famila fanno `const { FotoPlacer, Utility } =
require('./utility')`: nessuno ha dovuto cambiare. Un test controlla che il riesporto resti.

## Le globali

Usa come globali quelle di `indexNew.js` — `pluginMiddleware`, `customAgenzia`, `docInLavorazione`,
`pathLavorazione`, `percorsoLinks`, `percorsoLoghi` — come faceva dentro `utility.js`. Non importa
`utility.js`: è `utility.js` a importare questo file, e un `require` al contrario creerebbe un ciclo.
Da `indesign` importa `FitOptions` e `LocationOptions`.
