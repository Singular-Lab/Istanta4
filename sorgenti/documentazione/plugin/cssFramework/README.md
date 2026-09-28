# CssFramework.js — il motore che sistema il contenuto di un box

**Cosa è:** ridimensiona, sposta, allinea, ancora un elemento a un altro, mette a posto le foto,
risolve le sovrapposizioni e segnala quello che non si è potuto risolvere. È il file più grande del
Plugin — **9.306 righe, circa 110 membri** — ed è l'unico del motore CSS che **tocca davvero
InDesign**.

Attorno a lui girano cinque moduli che non lo toccano affatto:
[cssComposizioneBox](../cssComposizioneBox.md), [cssSequenzaOperazioni](../cssSequenzaOperazioni.md),
[cssSpazioFoto](../cssSpazioFoto.md), [cssRegoleConflitti](../cssRegoleConflitti.md) e
[noRenderElementi](../noRenderElementi.md). Sono stati estratti uno alla volta, e la divisione è
sempre la stessa: **loro calcolano il piano, `CssFramework` lo esegue sul documento.** È il motivo
per cui quei cinque hanno dei test e questo no.

**Le regole non stanno nel codice.** Arrivano dal `SourceFrameworkCss.json` del cliente, scaricate
da `FrameworkCssController/scaricaAllineamenti`. Il codice qui è l'interprete, non la regola.

---

## Come si legge questo file

Non dall'inizio alla fine. I membri stanno in ordine sparso, e il modo utile di guardarli è per
gruppi:

| gruppo | righe | pagina |
|---|---|---|
| infrastruttura, contesto, mappa del box, enum | 57–204, 1967–2236, 9051–9148 | [01-infrastruttura-e-mappa.md](01-infrastruttura-e-mappa.md) |
| spazio di impaginazione e rettangoli candidati | 204–682 | da scrivere (3c) |
| sistemazione delle foto | 917–1967, più i modelli in coda | da scrivere (3d) |
| ridimensionamento, overflow, collisioni, reflow | 2236–5320 | da scrivere (3e) |
| allineamenti, ancoraggi, condizioni, conflitti, composizione | 5523–8973 | da scrivere (3f) |

---

## Lo stato del modulo

Su circa 110 membri **solo 22 sono dati**: il resto sono funzioni. `CssFramework` è un oggetto solo
— un singleton — e quei 22 membri sono **stato mutabile condiviso da tutte le sue funzioni**.

| gruppo | membri | dove si spiegano |
|---|---|---|
| infrastruttura e contesto | `semaforoDownloadFramework`, `contestoCss` | [01-infrastruttura-e-mappa.md](01-infrastruttura-e-mappa.md) |
| segnalazioni | `etichetteSegnalate`, `segnalazioniConflittiPendenti`, `sospendiControlloSegnalazioniConflitti` | 3f |
| sistemazione foto | `calcoloDistanziamentoFoto`, `confini`, `offsetScale`, i sei `modello*`, `img1-3`, `inddItemImg1-3`, `cacheBoundaries`, `modelloDiFix` | 3d |

**La conseguenza che conta:** `CssFramework` lavora su **un box alla volta e non è rientrante**. Due
box in parallelo si sovrascriverebbero il contesto a vicenda. Chi un domani volesse parallelizzare
l'impaginazione deve partire da qui, non dalle funzioni.

## I quattro che sembrano globali e non lo sono

`DBallineamenti`, `DBDefault`, `mappaBoxOriginale` e `prefissiDerivati` compaiono nella firma di
decine di funzioni. **Non sono globali:** sono parametri, e viaggiano in parallelo al `contestoCss`
che contiene gli stessi valori. In alcune funzioni si usa il parametro, in altre il contesto, ed è
il genere di duplicazione che fa passare un'ora a chiedersi quale dei due comandi.

## Le globali esterne, nessuna importata

| globale | usi | a cosa serve |
|---|---|---|
| `Utility` | 120 | soprattutto `parseLabel` |
| `messaggioUtente` | 75 | tutte le segnalazioni all'operatore |
| `pathLavorazione` | 5 | la cartella di lavoro, per `allineamenti.json` |
| `readFile` | 4 | rilettura delle regole quando lo scaricamento fallisce |
| `fs`, `XMLHttpRequestClient`, `activateKeyForGarbage` | 1–2 | scrittura del file, chiamata al server, sblocco delle rimozioni differite |

Il file importa da `indesign` e dai quattro moduli `css*`, ma **queste sette arrivano dal contesto
globale del Plugin**. È il motivo per cui `CssFramework.js` non si carica sotto Node, e quindi il
motivo per cui esistono i cinque moduli puri.
