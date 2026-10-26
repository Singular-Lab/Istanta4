# garbageCollector.js

**Cosa è:** rimuove elementi InDesign **in differita** invece che subito.

Chi vuole cancellare un elemento lo accoda con `Add`; un timer ogni 100 ms svuota la coda a ondate
e si ferma da solo quando non resta niente. Prima di rimuovere un elemento risale ai genitori oltre
i gruppi, e se il genitore è un `Rectangle` gli rimette il `contentType` a «non assegnato».

`indexNew.js:244` ne crea **una sola istanza**, `gC`, e la espone con tre funzioni:
`addToGarbageCollector`, `requireKeyForGarbage` e `activateKeyForGarbage`.

## Il meccanismo delle chiavi

Serve a **trattenere** la rimozione. Chi sta per fare un'operazione lunga chiede una chiave con
`requireKeyForGarbage()`, la passa agli elementi che accoda, e finché non chiama
`activateKeyForGarbage()` quegli elementi vengono **rimessi in coda invece che cancellati**. Lo usa
`CssFramework.js` alle righe 3571 e 3715.

## Variabili globali

Stato dell'istanza:

| nome | cos'è |
|---|---|
| `elements` | la coda di quello che va rimosso, come `{key, element}` |
| `processingElements` | l'ondata in lavorazione, staccata dalla coda a ogni giro |
| `interval` | il timer, `null` quando è fermo. È anche la sentinella che impedisce di avviarne due |
| `waitingKeys` | le chiavi ancora attive |

**Due globali usate e non importate:** `ContentType` e `$`. Il file non contiene nessun `require`.

## Funzioni

- `startInterval(callback)` → avvia il timer, se non è già in moto.
- `Add(element, key)` → accoda un elemento, con la chiave che ne trattiene la rimozione. Se il
  timer era fermo lo riavvia.
- `generateKey()` → una chiave nuova, che da questo momento trattiene gli elementi che la portano.
- `activateKey(key)` → toglie la chiave dalle attive: da ora quegli elementi possono essere rimossi.
- `stop()` → ferma il timer. **Non svuota la coda**: quello che resta accodato verrà rimosso al
  prossimo `Add`, che fa ripartire il timer.

## Quattro difetti noti, non corretti

Sono descritti in un task a sé e vanno **confermati a runtime** prima di intervenire.

1. **La guardia contro le esecuzioni sovrapposte non funziona.** `inProcess` è dichiarato `false` e
   non viene mai messo a `true`: il `if (inProcess) return` non scatta in nessun caso. Se un'ondata
   dura più di 100 ms, la successiva parte comunque.
2. **`ContentType` è usato senza essere importato.** L'errore finisce in un `catch (e2) {}` vuoto:
   con ogni probabilità il reset del `contentType` non avviene mai, in silenzio. È il più grave dei
   quattro, perché riguarda lo stato del documento.
3. **`$.writeln` è un residuo di ExtendScript.** Nel ramo in cui l'elemento non ha un metodo
   `remove`, quella riga darebbe un errore invece del messaggio diagnostico che vorrebbe dare.
4. **Il `callback` di `startInterval` si perde.** `Add` riavvia il timer senza argomenti: chi aveva
   passato un callback non lo vede più eseguito dopo il primo svuotamento.
