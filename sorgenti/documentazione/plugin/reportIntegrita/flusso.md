# reportIntegrita.js — il flusso del report

**Cosa è:** tutto quello che il Report Integrità fa, tranne disegnarsi. 144 membri, 3.964 righe:
quasi tutto viene da `confronti.js`, più le cinque funzioni che stavano in `indexNew.js` e la regola
di chiusura che stava in `events.js`. L'interfaccia è in [pannelli.md](pannelli.md), mescolata nello
stesso oggetto. Panoramica: [README.md](README.md).

---

## Dall'avvio alla chiusura

1. **`avviaReportIntegrita(idKit)`** — la sequenza di avvio, arrivata da `indexNew.js`. Guarda se
   c'è un report salvato e decide con le soglie di [avvio](avvio.md) se riusarlo o rifarlo
   (`richiediAzioneReportIntegritaEsistente` è il dialogo con l'operatore). Mappa l'impaginato e,
   se serve, riscarica la lista: **in parallelo, e attesi entrambi**. Poi preanalisi e sync dei
   numeri di pagina col server, e il confronto box per box.
2. **`preAnalisiMismatchNumeriPagina(rangePagine, mappa)`** e **`syncImpaginatoConServer(...)`** —
   le referenze finite su una pagina diversa da quella prevista, e l'allineamento col server. Usano
   la mappa del motore (`confronti.mappaturaImpaginato`, `confronti.semplificazioneMappaImpaginato`).
   Una richiesta annullata non li lascia appesi (I20-1004). Dal I20-1040 `syncImpaginatoConServer`
   restituisce **«Fallita»** se il server rifiuta o la risposta non si legge (prima aspettava il
   timeout e diceva comunque «Completed», o restava appeso dopo un'eccezione): il Report controlla
   solo `null` e prosegue come prima, lo svuotamento di pagina si ferma.
   Usati anche da **Svuota pagina** (I20-1040), con **`classificaPerSvuotamento`**, che dalla
   pre-analisi e dalla mappa di tutto il documento separa le referenze spostate in un'altra pagina
   da quelle non registrate sul server e da quelle registrate su un'altra pagina (`_codiciConId`,
   `_stessaReferenza`), e con **`preAnalisiSenza`**, che toglie dalla sync le referenze mantenute: vedi
   [indexNew, 02](../indexNew/02-impaginazione.md).
3. **`applicaConfronto(mappa)`** — il confronto box per box, arrivato da `indexNew.js`: per ogni
   elemento della mappa trova il box (`boxDellElementoMappa`), lo confronta coi record
   (`preAnalisiBoxMappato`, che passa da `confronti.confrontoBoxCompiledFieldPreAnalisi`), raccoglie
   le differenze sui campi osservati con [sezioneConfronti](sezioneConfronti.md), compone il report,
   lo salva e scarica il csv.
4. **`compilaReportConfronto(report, options)`** — apre il pannello con il report compilato.
5. **Le azioni** — `_onConfrontoAction` ed `_eseguiAzioneConfronto` smistano trova, risolvi,
   whitelist, elimina e fix; `_resolveSegnalazione`, `_mandaInWhitelist`, `_ripristinaDaWhitelist`,
   `_deleteElemento`, `_fixElemento` le eseguono, e il report e la whitelist si risalvano.
6. **La chiusura** — `chiudiReportIntegrita(motivo)` a mano o, quando il documento non è più quello
   del report, **`chiudiSeNonValePiu(documentoAttuale)`**, che `events.js` chiama a intervalli.

## Il file del report e la whitelist

Il report vive in un file JSON nella cartella di lavorazione, e la whitelist accanto:
`leggiReportIntegritaLocale`, `salvaReportIntegritaLocale`, `eliminaReportIntegritaLocale`, e gli
stessi tre per la whitelist.

**`percorsoFileReport(idKit)` è l'unico punto che sa come si chiama il file del report.** Fino a
I20-1014 era il privato `_getReportIntegritaFilePath` di `confronti.js`, e `applicaConfronto`, che
stava in `indexNew.js`, lo chiamava così:

```javascript
var reportFilePath = confronti._getReportIntegritaFilePath
    ? confronti._getReportIntegritaFilePath(idKitLavorazione)
    : pathLavorazione + "/reportIntegrita_" + idKitLavorazione + ".json";
```

Una copia difensiva, a mano, del nome del file, nel caso il metodo privato di un altro modulo non ci
fosse. Ora `applicaConfronto` è un membro del report e chiama `ReportIntegrita.percorsoFileReport`.
Un test controlla che il nome del file sia scritto una volta sola in tutto il Plugin.

## La scheda aperta dal report

L'operatore può aprire la scheda di una referenza dal report e tornarci. `_apriSchedaDalReport`
imposta i membri di aggancio di `schedaRef` (`apertaDalReport` e gli altri, vedi
[README.md](README.md)), `_vigilaSchedaDalReport` controlla ogni `INTERVALLO_VIGILANZA_SCHEDA`
millisecondi se la scheda è stata chiusa, e alla chiusura
**`_ricontrollaReferenzaDopoScheda(stato)`** rifà il confronto **solo su quella referenza**,
rileggendo la scheda dal server, invece di rifare tutto. Le regole di cosa resta da segnalare stanno
in [avvio](avvio.md). Ogni passo lascia una riga in `logs/schedaDalReport.log` (`_tracciaScheda`).

## Il report affiancato (I20-1121)

Con il pannello largo almeno 924 px ([vistaAffiancata](../vistaAffiancata.md)) il report non è una
finestra che copre il Plugin: `compilaReportConfronto` lo mette in una **colonna a destra**
(`_apriColonnaReport`), e a sinistra il Plugin resta com'è, **con gli eventi accesi**. Sotto la soglia
resta la finestra di sempre, che li ferma finché è aperta. La forma la decide la larghezza
(`reportAffiancato()` dice quale c'è); allargando o stringendo il pannello con il report aperto,
**`adattaVista()`** lo ridisegna nell'altra forma (lo chiama `onresizeWindow`, prima delle
segnalazioni).

- **Una colonna alla volta, e il report ha la precedenza**: aprendosi a colonna chiude quella delle
  segnalazioni, che mentre il report è affiancato si aprono come popup.
- **«Trova» non apre la vista controllata.** Seleziona il box e centra la vista
  (`_seguiBoxDalReport`): la scheda si apre a sinistra come per qualunque box selezionato, con tutti i
  suoi menu, e il report resta aperto. Il box è **seguito** (`_boxSeguito`): ogni
  `INTERVALLO_VIGILANZA_SCHEDA` `_vigilaBoxSeguito` guarda se l'operatore è ancora sul box o dentro
  (`selezioneSulBox` di [avvio](avvio.md)).
- **La riga si ricontrolla** (`_ricontrollaBoxSeguito`, con lo stesso
  `_ricontrollaReferenzaDopoScheda` della scheda dal report, e `_applicaPianoRicontrollo`) quando:
  l'operatore **lascia il box** per due vigilanze di fila (`contoAbbandono`); preme **Trova su
  un'altra riga**; preme **«Ricontrolla box»** in testata (compare solo con un box seguito); il
  pannello si **stringe sotto la soglia** (prima di tornare popup). Il report non si riapre: si
  aggiorna la riga.
- Lasciato il box, `EVENT_NO_REF_SELECTED` invalida la scheda del pannello: la rilettura passa a
  `getSchedaRef` `ignoraInvalidazione = true`, altrimenti risponderebbe «scheda non più valida».
- **Le azioni che lavorano sul documento fermano gli eventi finché lavorano** (`_conEventiFermi`):
  quelle delle righe (`_onConfrontoAction`), «Elimina tutti», l'impaginazione dei nuovi. Se intanto
  il pannello ha cambiato forma, il report si adatta alla fine (`_adattaDopoAzione`).
- La **X** della colonna fa la stessa domanda di quella del popup. `chiudiReportIntegrita` toglie la
  colonna invece della finestra, non tocca gli eventi e smette di seguire il box **senza**
  ricontrollarlo. Un report nuovo avviato dal menu chiude prima quello affiancato.
- Nella colonna la testata ha **id suoi** (`pulsantiTestataConfrontoColonna`,
  `scaricaReportConfrontoCsvColonna`, `cartellaReportConfrontoCsvColonna`, corpo
  `bodyConfrontoReportColonna`): le copie della testata del popup restano nel documento anche a
  finestra chiusa, e `getElementById` troverebbe quelle.

**`ATTESA_MASSIMA_RILETTURA_SCHEDA` esiste per una ragione precisa:** la rilettura passa da
`schedaRef.getSchedaRef`, che non offre modo di essere fermata, quindi la risposta tardiva si lascia
cadere, ma l'operatore non deve restare fermo ad aspettarla.

## Il csv

`scaricaReportConfrontoCsv`, `cartellaCsvReport`, `scegliCartellaCsvReport`: dove si scrive e
quando. **Il csv si scrive quando nasce un report, non quando se ne riapre uno.** Le regole del
contenuto stanno in [csv](csv.md); qui resta ciò che tocca il disco.

## Le liste da confrontare e i nuovi

La sezione Confronti può mettere a fianco un'altra lista della stessa promo
(`_lavorazioniDellaPromo`, `_scaricaListaConfrontoScelta`, `_impostaListaConfronto`); le regole
sono di [sezioneConfronti](sezioneConfronti.md). I nuovi — le referenze che il server ha e il
documento no — si impaginano uno alla volta (`_impaginaNuovoSingolo`) o tutti in coda
(`_impaginaTuttiNuoviInCoda`), scegliendo la griglia dalla libreria.

## Le costanti

| nome | valore | cos'è |
|---|---|---|
| `ATTESA_MASSIMA_RILETTURA_SCHEDA` | 20000 | oltre questa attesa si smette di aspettare la rilettura della scheda |
| `FILE_TRACCIATO_SCHEDA` | `/logs/schedaDalReport.log` | |
| `INTERVALLO_VIGILANZA_SCHEDA` | 600 | ogni quanto si controlla se la scheda aperta dal report è stata chiusa, o (I20-1121) se l'operatore ha lasciato il box seguito |
| `ID_COLONNA` | `colonnaReportIntegrita` | la colonna del report affiancato (I20-1121) |
| `ID_CORPO_COLONNA`, `ID_AZIONI_COLONNA`, `ID_RICONTROLLA_BOX` | | il corpo, la testata e «Ricontrolla box» della colonna |

Quelle dell'interfaccia — `COLORI_STATO`, `PASSO_SCORRIMENTO`, `PROPRIETA_COLORE_DA_ATTENUARE`,
`ATTESA_RIDISEGNO_MS` — sono in [pannelli.md](pannelli.md).
