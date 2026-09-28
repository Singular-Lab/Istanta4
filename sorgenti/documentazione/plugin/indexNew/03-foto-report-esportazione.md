# indexNew — foto, report ed esportazione

Tre famiglie che hanno in comune una cosa: **appartengono a concetti che vivono altrove**, e questa
pagina serve soprattutto a dire quali pezzi sono qui.

Panoramica del file: [README.md](README.md).

---

## Le foto — 10 funzioni, ~1.000 righe

Ci sono **tre livelli**, e la distinzione è quella che il progetto usa già altrove.

### 1. Le operazioni concrete

Toccano il disco o il server:

- `fotoPresenteNeiLinks(nomeFoto)` → **non si limita a guardare se il file c'è**: un file troncato
  o vuoto vale come **assente**, perché non è impaginabile.
- `getInfoFotoDalServer(guidId)` → il record della foto dal server.
- `scaricaFotoSingolaNeiLinks(...)`, `scriviFileInCartella(bytes, cartella, nomeFile)`.

### 2. Il ponte verso il modulo puro

`assicuraFotoNeiLinks(nomeFoto, guidId)` — **sedici righe**:

```javascript
var esito = await fotoAutoSync.assicuraFotoNeiLinks(nomeFoto, guidId, {
    fotoPresente: async function (nome) { return fotoPresenteNeiLinks(nome); },
    infoFoto: getInfoFotoDalServer,
    scarica: scaricaFotoSingolaNeiLinks
});
```

Inietta le tre operazioni concrete dentro [fotoAutoSync](../fotoAutoSync.md) e **gli lascia la
decisione**. È il pattern del progetto fatto bene: la decisione sta dove si può provare, le
operazioni concrete dove devono stare. È anche il motivo per cui `fotoAutoSync` ha i test e queste
no.

### 3. Le operazioni grosse

- `avviaSyncPacchettoFoto(mode, callback, codici)` → **348 righe**: lo scaricamento massivo, con
  barra di avanzamento e interruzione.
- `ricollegaFotoMassivo(...)` → **445 righe**: riaggancia in blocco le foto dei box impaginati. Gli
  esiti si leggono con [ricollegaEsiti](../ricollegaEsiti.md), che è verificabile.
- `getFotoData`, `apriSchermataSyncPacchettoFoto`, `abortSyncPacchettoFotoFunction`,
  `impaginaFotoAppenaDisponibile`.

---

## Il report — 3 funzioni, 547 righe

- `avviaReportIntegrita(idKit)` → **131 righe**: guarda se ce n'è uno aperto, decide con le soglie
  di [reportIntegritaAvvio](../reportIntegritaAvvio.md) se riusarlo o rifarlo, compone l'intervallo
  di pagine. **Le decisioni stanno nel modulo puro, qui resta la sequenza.**
- `applicaConfronto(mappa)` → **359 righe**: applica il confronto alla mappa dell'impaginato,
  appoggiandosi a [reportConfronti](../reportConfronti.md).
- `datiPrimarioPerConfronto(...)` → 57 righe.

---

## L'esportazione — 3 funzioni

- `esportaMateriale(sender)` → **37 righe, è un involucro**: controlla il kit, legge il tipo di
  export scelto e chiama `ficoProcess.esportaMateriale`, dove sta il lavoro vero.
- `esportaLibro()` (199) e `apriModalEsportaLibro()` (88).

---

## Cosa va dove

Queste funzioni sono l'ultimo pezzo mancante di **due inventari** che ora sono completi, e i due
task sono stati scritti.

### Report Integrità — otto file

| file | pezzi |
|---|---|
| i quattro `report*.js` | 1.279 righe, con i test: sono il modello |
| `confronti.js` | 57 membri, più i 200 pannelli |
| **`indexNew.js`** | queste 3 funzioni, 547 righe |
| `schedaRef.js` | 5 membri |
| `events.js` | `controllaChiusuraReportIntegrita` |

### Procurarsi la foto — sette file

| file | pezzi |
|---|---|
| `schedaRef.js` | 28 membri, ~2.500 righe |
| **`indexNew.js`** | queste 10 funzioni, ~1.000 righe, su tre livelli |
| `cmd.js` | `downloadImages`, `md5ArrayBuffer` |
| `utility.js` | `FotoPlacer`, `getLinkHash`, i bolli |
| `fotoAutoSync`, `cacheHashFoto`, `dataCaricamentoFoto` | i moduli puri, già pronti |

**Non va confuso con il `fixFoto` di [CssFramework](../cssFramework/03-sistemazione-foto.md)**, che
decide *dove* la foto sta dentro il box: sono due concetti e due task distinti.

Nel codice i pezzi sono marcati con **`REPORT INTEGRITA'`** e **`PROCURARSI LA FOTO`**: un grep su
quelle parole li elenca tutti.
