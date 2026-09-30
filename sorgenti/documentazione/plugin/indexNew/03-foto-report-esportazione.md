# indexNew — foto, report ed esportazione

Tre famiglie che hanno in comune una cosa: **appartengono a concetti che vivono altrove**, e questa
pagina serve soprattutto a dire quali pezzi sono qui.

Panoramica del file: [README.md](README.md).

---

## Le foto — uscite in I20-1015

Le dieci funzioni foto — più `impaginaFotoAppenaDisponibile`, undici in tutto — sono diventate
membri di `ReperimentoFoto`, in [reperimentoFoto/](../reperimentoFoto/README.md). Si chiamano con gli
stessi nomi: `ReperimentoFoto.avviaSyncPacchettoFoto(...)`. I tre livelli — operazioni concrete, il
ponte `assicuraFotoNeiLinks`, operazioni grosse — sono descritti in
[reperimentoFoto/operazioni.md](../reperimentoFoto/operazioni.md).

Qui restano le due globali che quelle funzioni e la scheda usano: `ReperimentoFoto` e
`scaricamentoFoto`, lo scaricamento che si chiamava `cmd`.

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

### Procurarsi la foto — fatto in I20-1015

I sette file sono diventati una cartella: [reperimentoFoto/](../reperimentoFoto/README.md).

**Non va confuso con il `fixFoto` di [sistemazioneFoto](../sistemazioneFoto/02-sistemazione-foto.md)**, che
decide *dove* la foto sta dentro il box: sono due concetti e due task distinti.

I marcatori **`REPORT INTEGRITA'`** e **`PROCURARSI LA FOTO`** che I20-1002 aveva messo nel codice
sono serviti a ritrovare i pezzi, e con i due concetti raccolti nelle loro cartelle sono stati tolti.
Resta `REPORT INTEGRITA'` in `schedaRef.js`, sui membri dell'aggancio al report, che stanno lì di
proposito.
