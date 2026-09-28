# XMLHttpRequestClient.js

**Cosa è:** il modo in cui tutto il Plugin parla con il server. Ogni chiamata a Istanta passa da
qui.

## Cosa aggiunge all'`XMLHttpRequest` nudo

- prova a leggere la risposta come JSON, e se non ci riesce la passa come testo;
- intercetta la sessione scaduta (`no_login`, `utente_non_trovato`) e chiama `noLoginCallback()`,
  così il chiamante non tratta un login scaduto come un errore qualunque;
- mostra da sé il messaggio all'operatore quando la chiamata fallisce, col codice `HRC-01`.

## Variabili globali

**Campi dell'istanza** — non globali, ma stato condiviso fra i metodi:

| campo | cos'è |
|---|---|
| `this.xhr` | creato nel costruttore. Non invia mai niente: vedi il difetto di `abort` |
| `readyState`, `status` | copiati dalla richiesta in corso a ogni cambio di stato, perché chi chiama li legga da fuori |
| `timeout` | `0`, cioè nessuna scadenza, finché il chiamante non lo imposta |

**Globali esterne da cui dipende** — il modulo non è autosufficiente:

| globale | dove nasce | a cosa serve qui |
|---|---|---|
| `istantaIp` | `indexNew.js:132` | la base di ogni URL quando non passi `externalIp` |
| `noLoginCallback` | il Plugin | chiamata su `no_login` o `utente_non_trovato` |
| `messaggioUtente` | `indexNew.js:7609` | il messaggio `HRC-01` all'operatore |
| `$` (jQuery) | `index.html` | solo dentro `sendFiles` |

## Funzioni

- `constructor()` → crea `this.xhr`. **Questo oggetto non invia mai niente.**
- `send(url, parameter, method, type, externalIp)` → la chiamata vera. Compone l'URL su `istantaIp`
  salvo `externalIp`, imposta il timeout, invia. Alla risposta: se lo stato è 200 prova
  `JSON.parse` e chiama `onload(oggetto, true)`, se non è JSON chiama `onload(testo, false)`; se la
  risposta segnala `no_login` o `utente_non_trovato` — e l'URL non è `getSession` — chiama
  `noLoginCallback()` invece di `onload`. Se lo stato non è 200 mostra da sé il messaggio `HRC-01`
  all'operatore e chiama `onerror`.
- `sendFiles(url, formData)` → l'invio di file, **via `$.ajax`** e non via `XMLHttpRequest`. Stessa
  logica di `no_login`, ma **non** mostra il messaggio `HRC-01`: in caso di errore chiama solo
  `onNoConnection`.
- `abort()` → chiama `this.xhr.abort()`. **Non ferma la richiesta in volo**, vedi sotto.
- `onload`, `onerror`, `onreadystatechange`, `onNoConnection` → nascono vuoti, li sovrascrive chi
  istanzia. `onreadystatechange` ricopia `readyState` e `status` sull'istanza prima di chiamare il
  gestore.

### Due asimmetrie fra `send` e `sendFiles`

| | `send` | `sendFiles` |
|---|---|---|
| avvisa l'operatore da sé | sì, `HRC-01` | **no** |
| in assenza di rete | `onerror` **e** `onNoConnection` | solo `onNoConnection` |

## `abort()` non interrompe la richiesta in volo

Il costruttore crea `this.xhr`, ma `send` ne crea **un altro**, locale (`_xhr`), ed è quello che
parte davvero. `abort()` e il gestore di `ontimeout` agiscono su `this.xhr`, che non ha mai inviato
niente: la richiesta vera prosegue e la sua risposta arriva comunque.

Non è una scoperta recente: è già annotato in `confronti.js:2463` — «*XMLHttpRequestClient.abort()
non interrompe davvero: la richiesta tardiva la si lascia cadere, ma l'attesa non deve tenere fermo
l'operatore*». Chi deve smettere di aspettare mette una scadenza propria e ignora la risposta
tardiva; chiamare `abort()` non basta.

**Sono sei i punti che lo chiamano credendo di fermare qualcosa:** `indexNew.js` alle righe 303,
344, 1496, 2707 e 3865, e `schedaRef.js:3910`.

La correzione minima sarebbe assegnare `this.xhr = _xhr` dentro `send`, ma non è neutra: oggi quei
sei punti convivono con un `abort` che non fa nulla, e farlo funzionare cambia il loro
comportamento. È stato aperto un task a sé.
