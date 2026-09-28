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
3. ha alzato la spunta dentro `Utility.confirmRimozioneRef`.

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
