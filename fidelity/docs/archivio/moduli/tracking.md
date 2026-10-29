# Modulo: tracking

## Scopo
Tracciati e report: TracciatoReport, ScoreBoard, confronto momenti promozionali, metriche GDO.

## File legacy da migrare in futuro
- `server/core/controllers/TracciatoController.ts`
- `server/core/agenzia_lib/` (metodi `getReportOptions`, `getGlobalFiltersForUser`)
- Tipi `TracciatoReport`, `TracciatoQueryRequest` in `lib/types.ts`

## Cosa non fare ancora
- Non refactorare il sistema di widget-report finché non è documentata l'interfaccia pubblica.
- Non spostare la logica `calcolaQueryScoreboard` senza test di regressione.
