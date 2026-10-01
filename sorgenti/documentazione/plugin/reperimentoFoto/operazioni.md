# reperimentoFoto.js — le operazioni

**Cosa è:** l'oggetto `ReperimentoFoto`, 15 membri, 1.208 righe. Undici erano funzioni globali di
`indexNew.js`, quattro erano membri di `Utility`. `indexNew.js` lo dichiara come globale; lo usano
`index.html`, la scheda, `confronti.js` e `indexNew.js` stesso. Panoramica:
[README.md](README.md).

---

## 1. Le operazioni concrete

Toccano il disco o il server:

- `fotoPresenteNeiLinks(nomeFoto)` → **non si limita a guardare se il file c'è**: un file troncato
  o vuoto vale come **assente**, perché non è impaginabile.
- `getInfoFotoDalServer(guidId)` → il record della foto dal server.
- `scaricaFotoSingolaNeiLinks(recordFoto)` → una foto sola, attraverso
  `scaricamentoFoto.downloadImages`, cioè la stessa strada del pacchetto completo.
- `scriviFileInCartella(bytes, cartella, nomeFile)` → scrive un file ricevuto (lo usa il caricamento
  dalla scheda).
- `getLinkHash(rectangle)` → l'md5 dell'immagine collegata, per sapere se è ancora quella del
  server. Passa da [cacheHash](cacheHash.md), perché il calcolo su centinaia di file è il costo
  dominante del Report Integrità. Era `Utility.getLinkHash`.
- `getBolloNOFOTO`, `getBolloFOTONOFOUND`, `getNomeFotoLogoBolloBySigla` → i bolli dell'agenzia,
  chiesti al server a ogni accesso: vedi [README.md](README.md). Erano membri di `Utility`.

## 2. Il ponte

`assicuraFotoNeiLinks(nomeFoto, guidId)`:

```javascript
var esito = await fotoAutoSync.assicuraFotoNeiLinks(nomeFoto, guidId, {
    fotoPresente: async function (nome) { return ReperimentoFoto.fotoPresenteNeiLinks(nome); },
    infoFoto: ReperimentoFoto.getInfoFotoDalServer,
    scarica: ReperimentoFoto.scaricaFotoSingolaNeiLinks
});
```

Inietta le operazioni concrete dentro [autoSync](autoSync.md) e **gli lascia la decisione**. È il
motivo per cui `autoSync` ha i test e queste no.

## 3. Le operazioni grosse

- `avviaSyncPacchettoFoto(mode, callback, codici)` → **347 righe**: lo scaricamento massivo, con
  barra di avanzamento e interruzione. Lo lanciano i pulsanti di `index.html` («Avvia sync
  completo», «Avvia sync loghi») e la scheda; `apriSchermataSyncPacchettoFoto` apre la finestra,
  `abortSyncPacchettoFotoFunction` la ferma. Il sync completo è in due fasi: finite le foto (modo
  0) parte da solo il modo 1, loghi e bolli.
- `mostraFineScaricamento(modo, esito)` → la fine di una fase scritta nella finestra (I20-1027): il
  messaggio e, alla fine vera o su un errore, il pulsante **Fine**. La decisione sta in
  [fineScaricamento](fineScaricamento.md); qui si applica, sempre dentro
  `#overlayModalDownloadFoto` e mai sul modello della finestra in `index.html`.
- `ricollegaFotoMassivo(...)` → **444 righe**: riaggancia in blocco le foto dei box impaginati. Gli
  esiti si leggono con [ricollegaEsiti](../ricollegaEsiti.md), che è verificabile.
- `getFotoData(codice, callback)` → le foto di una referenza, per la scheda.
- `impaginaFotoAppenaDisponibile(...)` → mette la foto nel riquadro appena il file c'è, con
  [FotoPlacer](fotoPlacer.md).

## Le globali

Usa quelle di `indexNew.js`, come quando ci stava: `scaricamentoFoto`, `Utility`, `pathLavorazione`,
`percorsoLinks`, `percorsoLoghi`, `fs`, `uxp`, `messaggioUtente`, `showLoading`, `hideLoading` e gli
altri. Importa `XMLHttpRequestClient`, `autoSync`, `cacheHash` e `fotoPlacer`.

**Un membro si chiama sempre con `ReperimentoFoto.` davanti** — le undici funzioni arrivate da
`indexNew.js` si chiamavano fra loro per nome, da globali. Un test lo controlla.
