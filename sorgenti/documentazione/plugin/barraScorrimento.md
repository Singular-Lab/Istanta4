# barraScorrimento.js

**Cosa è:** i conti di una barra di scorrimento disegnata dal Plugin. Nasce con I20-981.

In UXP la tabella dei nuovi non scorre in orizzontale: né con `overflow: auto`, né con `scroll`,
né dando alla tabella una larghezza vera in pixel. Invece di insistere, la tabella viene spostata a
mano e la barra la disegna il Plugin. Qui stanno solo i conti — la parte che si può sbagliare in
silenzio; il disegno e gli eventi stanno in `confronti.js`.

## Variabili globali

| nome | cos'è |
|---|---|
| `CURSORE_MINIMO` = `24` | sotto questa larghezza il cursore non si afferra più |

Nessuno stato: tutte le funzioni ricevono le misure e restituiscono un risultato. Lo spostamento
corrente lo tiene `confronti.js`. La costante è esportata perché chi disegna e chi calcola devono
usare lo stesso numero.

## Funzioni

- `scorrimentoMassimo(contenuto, visibile)` → quanto si può scorrere in tutto; zero se il contenuto
  ci sta già.
- `serveLaBarra(contenuto, visibile)` → se il contenuto ci sta, la barra si nasconde invece di
  restare lì a non fare nulla.
- `limitaSpostamento(spostamento, contenuto, visibile)` → lo spostamento riportato dentro i limiti.
- `geometriaCursore(spostamento, contenuto, visibile, traccia)` → larghezza e posizione del cursore.
  La larghezza segue la porzione visibile del contenuto, con il minimo per poterlo afferrare.
- `spostamentoDaClic(posizione, contenuto, visibile, traccia)` → il punto cliccato diventa il
  **centro** del cursore.
- `spostamentoDaTrascinamento(iniziale, pixel, contenuto, visibile, traccia)` → dove si arriva dopo
  aver trascinato il cursore.

**Test:** `node --test tests/plugin/barraScorrimento.test.js`
