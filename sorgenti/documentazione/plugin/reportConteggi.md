# reportConteggi.js

**Cosa è:** i conteggi che finiscono sulle linguette del Report Integrità. Nasce con I20-981
(Lotto 3).

Il numero deve dire **quanti record stai guardando adesso**, non quanti ne esistono: quando il
report è in vista whitelist le liste mostrate sono altre, e un conteggio che ignorasse la vista
mentirebbe. Per questo i conteggi si fanno sulle stesse liste che vengono disegnate.

Sta separato perché `confronti.js` non si carica sotto Node, e questa è la regola.

## Variabili globali

Nessuna. Tre funzioni pure e basta: è l'esempio più netto di cosa vuol dire «modulo puro» nel
Plugin.

## Funzioni

- `conteggio(elenco)` → quanti elementi ha una lista, senza inciampare su `null`.
- `conteggiVisibili(cambiati, usciti, nuovi)` → i tre conteggi delle linguette.
- `etichettaLinguetta(nome, numero)` → «Cambiati (12)». **Lo zero si scrive**, perché «nessuno» è
  un'informazione utile quanto le altre. Senza numero resta il nome soltanto.

**Test:** `node --test tests/plugin/reportConteggi.test.js`
