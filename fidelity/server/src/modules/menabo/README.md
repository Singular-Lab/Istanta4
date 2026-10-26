# Modulo: menabo

## Scopo
Integrazione con il sistema Menabò per la gestione delle insegne e dei punti vendita GDO.

## File legacy da migrare in futuro
- Controller e service relativi alla gestione insegne/GDO in `server/core/`.
- Modelli `punto_vendita/` in `server/core/models/`.

## Cosa non fare ancora
- Non spostare la logica finché non è definita l'interfaccia pubblica del modulo.
- Non cambiare le rotte API legacy usate dal frontend.
