# XMLHttpRequestClient.js

**Cosa è:** il modo in cui tutto il Plugin parla con il server. Ogni chiamata a Istanta passa da
qui.

## Cosa aggiunge all'`XMLHttpRequest` nudo

- prova a leggere la risposta come JSON, e se non ci riesce la passa come testo;
- intercetta la sessione scaduta (`no_login`, `utente_non_trovato`) e chiama `noLoginCallback()`,
  così il chiamante non tratta un login scaduto come un errore qualunque;
- mostra da sé il messaggio all'operatore quando la chiamata fallisce, col codice `HRC-01`;
- quando una richiesta viene annullata, dice all'operatore cosa è stato annullato e perché, col
  codice `HRC-02`.

## Variabili globali

**Campi dell'istanza** — non globali, ma stato condiviso fra i metodi:

| campo | cos'è |
|---|---|
| `this.xhr` | la richiesta partita per ultima: `send` ce la mette appena la crea, ed è quella che `abort` ferma |
| `readyState`, `status` | copiati dalla richiesta in corso a ogni cambio di stato, perché chi chiama li legga da fuori |
| `timeout` | `0`, cioè nessuna scadenza, finché il chiamante non lo imposta |
| `descrizione` | che cosa fa la richiesta, detto all'operatore e **al maschile** («Scaricamento lista»). La usa `abort` nel messaggio `HRC-02`; senza, il messaggio mostra l'URL |
| `url` | l'ultimo URL passato a `send`, per il messaggio `HRC-02` quando manca la descrizione |

**Globali esterne da cui dipende** — il modulo non è autosufficiente:

| globale | dove nasce | a cosa serve qui |
|---|---|---|
| `istantaIp` | `indexNew.js:132` | la base di ogni URL quando non passi `externalIp` |
| `noLoginCallback` | il Plugin | chiamata su `no_login` o `utente_non_trovato` |
| `messaggioUtente` | `indexNew.js:7609` | il messaggio `HRC-01` all'operatore |
| `$` (jQuery) | `index.html` | solo dentro `sendFiles` |

## Funzioni

- `constructor()` → crea un `this.xhr` di partenza, che non invia niente: serve solo perché `abort`
  chiamato prima di qualsiasi `send` non trovi `null`.
- `send(url, parameter, method, type, externalIp)` → la chiamata vera. Compone l'URL su `istantaIp`
  salvo `externalIp`, mette la richiesta nuova in `this.xhr`, imposta il timeout, invia. Alla risposta: se lo stato è 200 prova
  `JSON.parse` e chiama `onload(oggetto, true)`, se non è JSON chiama `onload(testo, false)`; se la
  risposta segnala `no_login` o `utente_non_trovato` — e l'URL non è `getSession` — chiama
  `noLoginCallback()` invece di `onload`. Se lo stato non è 200 mostra da sé il messaggio `HRC-01`
  all'operatore e chiama `onerror`.
- `sendFiles(url, formData)` → l'invio di file, **via `$.ajax`** e non via `XMLHttpRequest`. Stessa
  logica di `no_login`, ma **non** mostra il messaggio `HRC-01`: in caso di errore chiama solo
  `onNoConnection`.
- `abort(motivo)` → ferma la richiesta in volo e avvisa l'operatore, vedi sotto.
- `onload`, `onerror`, `onreadystatechange`, `onNoConnection`, `onabort` → nascono vuoti, li
  sovrascrive chi istanzia. `onreadystatechange` ricopia `readyState` e `status` sull'istanza prima di chiamare il
  gestore.

### Due asimmetrie fra `send` e `sendFiles`

| | `send` | `sendFiles` |
|---|---|---|
| avvisa l'operatore da sé | sì, `HRC-01` | **no** |
| in assenza di rete | `onerror` **e** `onNoConnection` | solo `onNoConnection` |

## `abort(motivo)`: ferma la richiesta e dice perché

Ferma la richiesta partita per ultima e mostra all'operatore un avviso `HRC-02` nella forma
«*`descrizione` annullato a causa di: `motivo`*», per esempio «*Scaricamento lista annullato a causa
di: Cambio documento attivo*». Poi chiama `onabort(motivo)`.

Da quel momento la richiesta **tace**: la risposta, se arriva, non raggiunge `onload`, e non
arrivano neppure `onerror`, `onNoConnection` e il cambio di stato a 4 con status 0 che
l'annullamento stesso produce. Senza quest'ultimo accorgimento i gestori che controllano
`readyState == 4` scriverebbero «Errore durante la richiesta: 0».

Una richiesta **mai partita o già conclusa** non ha niente da fermare: nessun avviso, nessun
`onabort`. Lo stesso vale per un secondo `abort` sulla stessa richiesta.

**`onabort` è l'unico modo, per chi aspetta, di sapere che la risposta non arriverà.** Chi aspetta
una richiesta annullabile deve impostarlo, altrimenti resta appeso fino alla sua scadenza, o per
sempre se non ne ha una.

**Il caricamento a schermo lo spegne chi è stato annullato**, nel suo `onabort`. Il pannello di
`showLoading` è uno solo e senza contatore, e prima lo spegneva la risposta tardiva: chi annulla —
un cambio di documento, per esempio — spesso non ne ha acceso nessuno, e il pannello resterebbe
sopra tutto il Plugin. Per lo stesso motivo **chi annulla accende il proprio caricamento dopo
l'`abort`**, non prima, o se lo vedrebbe spegnere. `scaricaContenutoKit` fa entrambe le cose.
Conteggio e impaginazione accendono il loro prima di annullare, ma mentre uno scaricamento è in
corso il pannello copre i loro pulsanti. `setBusy` resta invece di chi ha annullato.

Annullare ferma la **risposta**, non il server: una richiesta già arrivata a Istanta viene eseguita
comunque. Per questo il salvataggio della scheda referenza (`Revisore/salvaRefFromIndd`) usa un
client suo e non diventa mai `xhrInProcess`: se lo si annullasse, il server salverebbe e il
documento non riceverebbe i cambi strutturali.

### Chi annulla, e con quale motivo

Tutti annullano `xhrInProcess`, la richiesta unica in volo di
[indexNew.js](indexNew/01-globali-e-ossatura.md).

| dove | motivo |
|---|---|
| `indexNew.js`, cambio di documento | Cambio documento attivo |
| `indexNew.js`, nessun documento aperto | Nessun documento aperto |
| `scaricaContenutoKit` | Nuovo scaricamento della lista |
| `conteggiaImpagina` | Nuovo conteggio avviato / Nuova impaginazione avviata |
| impaginazione del libro PoP | Nuova impaginazione del libro avviata |
| `schedaRef.js`, salvataggio della scheda | Salvataggio della scheda referenza |

Chi aspetta e imposta `onabort`: `scaricaContenutoKit`, che fa fallire `scaricaContenutoKitAsync`
col motivo (il Report Integrità lo riporta nel suo errore); `getListaCodiciImpaginati` in
`utility.js`; la preanalisi e la sincronizzazione del Report Integrità in `reportIntegrita/reportIntegrita.js`, che
smettono di aspettare invece di arrivare al loro timeout.

Il cambio di documento non scatta mentre `setBusy(true)` è attivo: conteggio, impaginazione e
Report Integrità non possono essere annullati da lì.

Fino a I20-1004 `abort` non fermava niente: agiva su `this.xhr` creato nel costruttore, mentre
`send` inviava da un altro oggetto, locale, e la risposta arrivava comunque.
