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

## Il report — uscito in I20-1014

`avviaReportIntegrita` e `applicaConfronto`, con le tre funzioni che usavano solo loro —
`preAnalisiBoxMappato`, `boxDellElementoMappa`, `nomiPagineDelDocumento` — sono diventati membri di
`ReportIntegrita`, in [reportIntegrita/](../reportIntegrita/README.md). Si chiamano con gli stessi
nomi: `ReportIntegrita.avviaReportIntegrita(idKit)`. Sono descritti in
[reportIntegrita/flusso.md](../reportIntegrita/flusso.md).

Qui resta `datiPrimarioPerConfronto(...)` (57 righe), perché la usa anche la reimpaginazione di una
referenza, che non è report.

---

## L'esportazione — 3 funzioni

- `esportaMateriale(sender)` → **37 righe, è un involucro**: controlla il kit, legge il tipo di
  export scelto e chiama `ficoProcess.esportaMateriale`, dove sta il lavoro vero.
- `esportaLibro()` (199) e `apriModalEsportaLibro()` (88).

---

## Cosa va dove

Queste funzioni sono l'ultimo pezzo mancante di **due inventari** che ora sono completi, e i due
task sono stati scritti.

### Report Integrità — fatto in I20-1014

Gli otto file sono diventati una cartella: [reportIntegrita/](../reportIntegrita/README.md). Il
README del report dice cosa è entrato e cosa è rimasto fuori, e perché.

### Procurarsi la foto — sette file

| file | pezzi |
|---|---|
| `schedaRef.js` | 28 membri, ~2.500 righe |
| **`indexNew.js`** | queste 10 funzioni, ~1.000 righe, su tre livelli |
| `cmd.js` | `downloadImages`, `md5ArrayBuffer` |
| `utility.js` | `FotoPlacer`, `getLinkHash`, i bolli |
| `fotoAutoSync`, `cacheHashFoto`, `dataCaricamentoFoto` | i moduli puri, già pronti |

**Non va confuso con il `fixFoto` di [sistemazioneFoto](../sistemazioneFoto/02-sistemazione-foto.md)**, che
decide *dove* la foto sta dentro il box: sono due concetti e due task distinti.

Nel codice i pezzi sono marcati con **`REPORT INTEGRITA'`** e **`PROCURARSI LA FOTO`**: un grep su
quelle parole li elenca tutti.
