# Modulo: audit

## Scopo
Tracciamento delle azioni utente e degli eventi di sistema per compliance e debugging.

## File legacy da migrare in futuro
- `server/core/services/AuditLogService.ts`
- `server/core/interfaces/IAuditLogService.ts`
- `server/core/models/audit_log.ts` (se presente)

## Cosa non fare ancora
- Non spostare `AuditLogService` finché non è definita la struttura del modulo.
- Non cambiare il formato dei log esistenti (rottura del sistema di monitoring).
- Non modificare i binding DI esistenti in `server/core/di/container.ts`.
