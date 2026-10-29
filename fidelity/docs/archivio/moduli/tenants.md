# Modulo: tenants

## Scopo
Gestione multi-tenant: isolamento dati per GDO, configurazioni per cliente, `CLIENT_ID` routing.

## File legacy da migrare in futuro
- `server/core/services/ConfigService.ts` (parte relativa ai tenant)
- `server/core/agenzia_lib/` (logiche custom per cliente)
- Parsing OIDC con `codice_posizione` in `DefaultAgenziaLib`

## Cosa non fare ancora
- Non creare middleware di tenant isolation prima di aver mappato tutti gli endpoint esistenti.
- Non modificare la sessione utente (`req.session.id_gdo`) senza piano di rollback.
