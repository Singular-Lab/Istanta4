# indexNew — l'impaginazione

**A cosa serve questo gruppo:** prendere le referenze scelte dai filtri e metterle nei box del
documento InDesign. È l'operazione per cui esiste il Plugin.

**21 funzioni, circa 4.180 righe: più di un terzo di `indexNew`.**

Panoramica del file: [README.md](README.md).

---

## Il flusso principale

```
conteggia()  impagina()          i due pulsanti
        ↓
conteggiaImpagina()              cattura il contesto
        ↓
_conteggiaImpaginaConContesto()  1.798 righe: chiede a Istanta cosa va dove
        ↓
impaginaBox()                    751 righe: costruisce il singolo box
```

Con `impagina = false` si conta soltanto: quante referenze ci starebbero, senza toccare il
documento.

## Il contesto catturato, che è la cosa da capire

`conteggiaImpagina` non impagina niente. Fa questo:

```javascript
const documentoImpaginazione = docInLavorazione;
const pathImpaginazione      = pathLavorazione;
const idKitImpaginazione     = idKitLavorazione;
```

e passa i tre valori a `_conteggiaImpaginaConContesto`, che li riceve **con gli stessi nomi delle
globali**:

```javascript
async function _conteggiaImpaginaConContesto(docInLavorazione, pathLavorazione, idKitLavorazione, ...)
```

**I parametri ombreggiano le globali di proposito.** Dentro le 1.798 righe quei nomi sono il
contesto fissato all'avvio, non le variabili di modulo.

Il motivo è pratico: **l'impaginazione dura minuti**, e se nel frattempo l'operatore cambia
documento o kit, le globali cambiano sotto i piedi dell'operazione in corso. Così il codice interno
— scritto quando le globali si usavano direttamente — lavora su un contesto stabile senza essere
stato riscritto.

È una scelta giusta e per niente ovvia: chi leggesse solo la funzione interna penserebbe di star
usando le globali.

---

## Le altre famiglie

### Il libro

`initLibroInLavorazione` (129), `impaginaLibro` (77), `impaginaLibroTask` (133), `esportaLibro`
(199), `apriModalEsportaLibro` (88).

`leggiStatoLavorazioneLibro` e `registraStatoLavorazioneLibro` **permettono di riprendere un libro
interrotto**: lo stato sta su file, non in memoria, e `jobImpaginazioneLibro`
— `{queue, index, stato}` — ne tiene la coda.

### Il singolo box

`impaginaSingolo` (87) e `impaginazioneSingoloIndd` (141), per quando l'operatore impagina una
referenza sola.

### Disfare

`rimuoviRefImpaginata` (226) — vedi sotto — e `svuotaMenabo` (129), che svuota l'intero menabò.

**Svuota pagina** (`selectionModalSvuota`, `svuotaPaginaByPageName`), rivisto in I20-1040:

1. **Pre-analisi** delle sole pagine da svuotare (`ReportIntegrita.preAnalisiMismatchNumeriPagina`).
   Se fallisce, la domanda «vuoi comunque procedere?» ora si **aspetta** (`await Modali.confirm`):
   prima la condizione era una promessa, sempre vera, e lo svuotamento partiva senza risposta.
   Il messaggio IDX-130 legge gli errori da `errors`, come li manda il server.
2. **Le decisioni dell'operatore** (`decisioniPrimaDelloSvuotamento`), classificate da
   `ReportIntegrita.classificaPerSvuotamento`:
   - **referenze spostate**: il server le ha in una pagina da svuotare, ma nel documento stanno in
     un'altra. Per vederle serve la mappa di **tutto** il documento, letta solo se la pre-analisi
     ha referenze «presenti solo sul server». Prima la mappa copriva solo le pagine da svuotare:
     la referenza restava «solo sul server», la sync (con `applicaImpaginazioni` falso) la
     ignorava, e `Menabo/SvuotaPagina` ne cancellava il record senza dire niente. Finestra:
     «Aggiorna la pagina e svuota» (il record passa alla pagina dove sta, via
     `syncImpaginatoConServer` nel caso «impaginate a pagina differente», `preAnalisiPerSpostate`),
     «Svuota comunque» (come prima), Annulla. Se il server non conferma l'aggiornamento lo
     svuotamento si ferma (IDX-172);
   - **referenze non registrate sul server** ma presenti nella pagina: prima si toglievano senza
     chiedere. Finestra: «Rimuovi insieme alla pagina», «Mantieni nel documento», Annulla. Quelle
     mantenute `svuotaPaginaByPageName` le salta (secondo argomento, `daMantenere`);
   - **referenze registrate su un'altra pagina** ma portate dall'operatore in una pagina da
     svuotare (le «impaginate a pagina differente» della pre-analisi): prima la sync le portava a
     quella pagina e lo svuotamento le cancellava, dal documento e dal server. Finestra:
     «Rimuovi insieme alla pagina» (come prima), «Mantieni nel documento», Annulla. La pagina dove
     il server le registra si legge da `Utility.getListaCodiciImpaginati`. Quelle mantenute escono
     dalla sync di prima (`ReportIntegrita.preAnalisiSenza`) e passano alla loro pagina **dopo** lo
     svuotamento di quella pagina, che si svuota per prima: altrimenti `Menabo/SvuotaPagina` ne
     cancellerebbe il record (IDX-174 se il server non conferma);
   - le referenze che il server ha ma che nel documento non ci sono più da nessuna parte sono state
     tolte a mano: il record si cancella senza chiedere, come prima.

   Annulla in una qualunque delle finestre ferma tutto (IDX-171), prima di toccare server e documento.
3. **Lo svuotamento, una pagina alla volta**: `svuotaPaginaByPageName` ora aspetta la risposta del
   server (al più un minuto, IDX-173), e «Svuotamento completato» arriva alla fine. Prima le
   richieste partivano tutte insieme e il messaggio arrivava subito.

Lato server, `PreAnalisiMismatch` lascia l'esito falso se una pagina va in errore: prima la pagina
successiva lo rimetteva a vero, e l'errore si perdeva.

### Rimediare

`fixRefImpaginata` (256), che sistema una referenza impaginata male senza rifare tutto il box.

### Il contorno

`getPaginaImpaginazioneCorrente`, `appendRigaRiepilogoImpaginazione`,
`confermaImpaginazioneDaTracciato`, `impaginaFotoAppenaDisponibile`.

---

## `rimuoviRefImpaginata` e l'eliminazione dal tracciato

È l'operazione più delicata del Plugin, e merita di essere letta per intero.

### Due modi di chiamarla

| chiamata | da dove | conferma | elimina dal tracciato? |
|---|---|---|---|
| **senza lista** | il pulsante in `index.html:590` | sì | **può** |
| **con lista** | due punti di `indexNew`, per ripulire ciò che ha fallito l'impaginazione | nessuna | **mai** |

Il secondo modo serve a rimettere d'accordo server e impaginato quando qualcosa non è riuscito: per
questo non chiede niente e non tocca il tracciato.

### Quando si elimina dal tracciato

`eliminaDaTracciato` diventa vero **solo se si verificano tre cose insieme**:

1. la chiamata viene dal pulsante;
2. l'utente è `superAdmin`;
3. ha alzato la spunta dentro `Modali.confirmRimozioneRef`.

Poi il flag va al server:

```
Menabo/rimuoviRefImpaginata/{idKit}/{eliminaDaTracciato}
```

**Questo cancella il record dal tracciato, ed è voluto.**

### Due cose che ne discendono

**La specifica va aggiornata.** `flusso-impaginazione-indesign` elenca questo comportamento fra i
rischi osservati con scritto «va confermato se debba alterare anche il dato server». La risposta
adesso c'è — è voluto — e quel punto non è più una domanda aperta.

**È aperto un task per una seconda conferma**, nello stile di Jira: una finestra in cui scrivere la
parola `ELIMINA` prima di procedere. Scatterebbe **solo** quando `eliminaDaTracciato` sarebbe vero,
mostrando i codici gruppo coinvolti e dicendo esplicitamente che si agisce sul tracciato del server,
non solo sull'impaginato.

---

## Ricollocazione proposta

**L'intero gruppo è un concetto**, ed è il più grande di `indexNew`: 4.180 righe su 11.316.
L'impaginazione non ha niente da spartire con la gestione della sessione, i messaggi all'operatore o
il tracciato, che stanno nello stesso file.
