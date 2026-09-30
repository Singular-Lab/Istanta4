# schedaFoto.js — la parte foto della scheda

**Cosa è:** quello che la scheda della referenza fa con le foto — 36 membri, 3.489 righe, usciti da
`schedaRef.js` in I20-1015. **Non è un modulo a sé:** `schedaRef.js` lo mescola nel proprio oggetto
con `Object.assign`, e ogni `this` qui dentro è `schedaRef`. Da fuori si chiamano ancora
`schedaRef.X`. Panoramica: [README.md](README.md).

---

## Perché un oggetto solo

Le foto e il resto della scheda si usano a vicenda. La parte foto legge diciassette membri della
scheda — `schedeRefDati` diciannove volte, `refSelected` undici, poi `ricaricaDatiScheda`,
`allineaBoxDopoSalvataggioPS`, `escapeHtml`… — e la scheda chiama nove membri foto
(`selectSchedaRef` apre `EditFotoPrimarieSecondarie` e `FotoExtraPanel`, `resetRefInterface` chiama
i due reset, `salvaNoRender` chiama `proponiFixFotoSeServe`…). Separarli in due oggetti vorrebbe
dire passarsi lo stato avanti e indietro: invece si divide il file, e lo stato resta uno.

## Le famiglie

| famiglia | membri |
|---|---|
| **cambio foto** | `openModalCambiaFoto` (1.066 righe), `updateImmagine`, `updateImmagineEsistente`, `richiediMetodoUploadDaRiscontri`, `getRiscontriFotoConNome`, `buildMessaggioRiscontriFoto` |
| **la proposta dalla cartella** | `fotoDaProporreDallaCartella`, `scegliCandidatoFoto`, `candidatiPerReferenza`, `motivoPropostaFoto`, `riquadroPropostaFoto`, `percorsoDiPartenzaPerFoto`, `stessoNomeFoto`, `urlDiPercorso` |
| **le anteprime** | `mostraAnteprimaCaricamento`, `tipoAnteprimaDi`, `anteprimaDaPsd`, `testoAnteprimaNonDisponibile`, `partiDelNomeFile` |
| **primarie e secondarie** | `EditFotoPrimarieSecondarie` (565 righe), `resetFotoPS`, `eliminaMetaFoto`, `eliminaFotoNelBox`, `guidFotoDiRef` |
| **extra ed extra auto** | `FotoExtraPanel`, `impaginaFotoExtra`, `attivaDisattivaFotoExtra`, `escludiIncludiFotoExtraAuto`, `resetFotoExtra`, `eliminaFotoExtra`, `tipiFotoExtra` |
| **loghi e bolli** | `linkLogoBollo` |
| **contesto e fix** | `fotoInContestoLavorazione`, `getContestoFotoText`, `proponiFixFotoSeServe`, `statoFotoAllApertura` |

I 28 membri della issue più otto aiutanti che la issue non elencava — le anteprime, i candidati, le
parti del nome del file, l'upload dai riscontri — e che usano solo loro.

## Cosa usa da fuori

- Le operazioni di [ReperimentoFoto](operazioni.md): `avviaSyncPacchettoFoto`, `getFotoData`,
  `assicuraFotoNeiLinks`, `impaginaFotoAppenaDisponibile`, `scriviFileInCartella`, `getLinkHash`.
- La globale `scaricamentoFoto` per l'md5 di una foto locale, e la globale `FotoPlacer` per
  mettere la foto nel riquadro, entrambe dichiarate da `indexNew.js` come quando stava in
  `schedaRef.js`.
- [DataCaricamentoFoto](dataCaricamento.md) per il badge con la data, `NoRenderElementi`,
  `XMLHttpRequestClient`.

## Una trappola del trasloco

In `schedaRef.js` il nome `schedaRef` era la costante del file. In `schedaFoto.js` non c'è. Dove il
codice chiamava la scheda per nome — `schedaRef.partiDelNomeFile(...)` dentro una callback, dove
`this` non è la scheda — ora si salva `this` prima (`var me = this`). In UXP avrebbe funzionato per
caso, grazie alla globale di `indexNew`; sotto Node no, e i test l'hanno visto. Le variabili locali
che si chiamano `schedaRef` — l'elenco dei record della referenza, in sette membri — sono un'altra
cosa e restano com'erano.
