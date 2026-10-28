# initializeModels.ts

Comandi dello schema del database di Fidelity. Lo schema cambia solo con le migrazioni versionate
(`server/core/db/migrazioni`, vedi la sezione "Migrazioni dello schema" del README): questi comandi
sono scorciatoie verso lo stesso runner, con lo stesso lock e lo stesso storico.

| Comando | Script | Cosa fa |
| --- | --- | --- |
| `sync` | `yarn models:sync` | Applica le migrazioni pendenti, come all'avvio; rispetta `MIGRAZIONI_APPLICA_ALL_AVVIO` (il container lo lancia a ogni avvio) |
| `sync --force` | `yarn models:sync:force` | Solo con `NODE_ENV=development`: elimina tabelle dei modelli, enum e storico e riparte dalla baseline (CANCELLA I DATI) |
| `status` | `yarn models:status` | Come `yarn migrazioni:stato` |
| `check` | `yarn models:check` | Come `yarn migrazioni:verifica`, in sola lettura |
| `sync-db-objects` | `yarn models:sync-db-objects` | Ricrea view e materialized view (`db/oggetti_derivati`) |

Le opzioni `--alter` e `--logging` di `sync` sono accettate e ignorate; `--drop` vale come `--force`.
