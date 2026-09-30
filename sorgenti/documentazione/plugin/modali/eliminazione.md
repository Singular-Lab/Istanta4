# eliminazione.js — le conferme prima di eliminare

**Cosa è:** sei membri che `modali.js` mescola in `Modali`: da fuori si chiamano `Modali.X`. Uscito
da `utility.js` in I20-1012. Panoramica: [README.md](README.md).

**È l'unica strada del Plugin che cancella un dato sul server**, e per questo ha due conferme.

## Le funzioni

- `confirmRimozioneRef(codiciGruppo)` → la conferma della rimozione di una o più referenze
  impaginate. Restituisce `{ confermato, eliminaDaTracciato, codici }`. Con la spunta
  «Eliminare dal tracciato l'elemento» alzata passa dalla seconda conferma; senza, si toglie solo
  dall'impaginato.
- `confirmParolaEliminazione(codici)` → **la seconda conferma** (I20-1013), come quella di Jira
  quando si cancella un task: si scrive a mano `ELIMINA`. Restituisce `true` solo se la parola è
  esatta e confermata; `false` in ogni altro caso, errori compresi. Non chiama il server: si prova
  da sola dalla console, con `await Modali.confirmParolaEliminazione(["CODICE"])`.
- `confirmRimozioneRefNonTrovata(datiRef)` → per un elemento che il server ha ma che l'impaginato
  non trova: mostra codice, id record e pagina attesa. **Mantieni** dà `false`, **Rimuovi dal
  server** `true`.

## Le parti pure

- `PAROLA_ELIMINAZIONE` → `"ELIMINA"`. Esatta e in maiuscolo: la fatica di scriverla è parte della
  difesa.
- `parolaEliminazioneCorretta(testo)` → se il testo è la parola. Si tolgono solo gli spazi ai
  bordi; le minuscole non valgono.
- `riepilogoEliminazione(codici)` → i testi della seconda conferma: quanti codici, quali, e che si
  cancella il dato sul server, non solo l'impaginato.

**Test:** `confermaEliminazione.test.js`. Le parti pure si chiamano da `Modali`, che si carica
sotto Node; dei dialoghi si controlla il sorgente nei punti in cui si decide se eliminare.

## Perché modali()

Qui dentro il nome `Modali` non c'è: è `modali.js` a caricare questo file mentre si carica. Le
chiamate passano da `modali()`, che chiede il modulo al momento, e valgono anche nelle callback,
dove `this` non è l'oggetto.
