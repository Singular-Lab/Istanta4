# variantiDescrizione.js

**Cosa è:** quale variante di descrizione si mostra, quale si può modificare, e su quale si scende
chiudendo una schermata. Nasce con I20-993.

L'elenco delle varianti arriva dal server nella chiave `varianti_descrizione`, già ordinato dalla
meno alla più specifica: nazionale, canale, area, area con canale. Quale si applichi però dipende
dall'area e dal canale della lavorazione aperta, che **il server non conosce e il Plugin sì**. La
decisione sta qui, fuori da `schedaRef.js`.

## Variabili globali

Nessuna. Lo stato — quale variante è aperta — vive in `schedaRef.js`.

## Funzioni

- `specificita(variante)` → 0 nazionale, 1 canale, 2 area, 3 area con canale. Stessa scala del
  server (`Istanta/Utility/SpecificitaDescrizione.cs`), **ricalcolata** invece di fidarsi del campo
  ricevuto: una variante costruita a mano dal Plugin non ce l'ha.
- `siApplica(variante, area, canale)` → una variante vale se non contraddice area e canale. La
  nazionale vale sempre: non dice niente, quindi non può contraddire nulla.
- `variantiApplicabili(varianti, area, canale)` → quelle che valgono, dalla meno alla più
  specifica.
- `varianteApplicabile(varianti, area, canale)` → la più specifica fra quelle che valgono. **È
  l'unica modificabile**, tutte le altre si mostrano in sola lettura.
- `eModificabile(variante, varianti, area, canale)` → si confronta per area e canale, non per
  identità: l'oggetto che arriva dal server e quello mostrato non sono per forza lo stesso.
- `varianteDopoChiusura(varianti, chiusa, area, canale)` → chiudendo si scende di un gradino. Sotto
  la nazionale non si scende, e chiudendo la nazionale non resta niente: chi chiama decide se è un
  caso da impedire.
- `siPuoChiudere(variante)` → la nazionale mai: è il fondo della scala, e senza di lei il gruppo
  resterebbe senza niente su cui ricadere. Stessa regola del server, che la fa comunque rispettare
  anche se da qui ci si distraesse.
- `variantiCreabili(...)` → quelle che varrebbero per questa lavorazione e ancora non esistono.
- `etichetta(...)` → come si chiama una variante nell'interfaccia.

**Test:** `node --test tests/plugin/variantiDescrizione.test.js`
