# Modulo: promotions

## Scopo
Creazione e gestione promozioni: volantini digitali, kit runtime, design kit, ordini di stampa.

## File legacy da migrare in futuro
- `server/core/controllers/PromoController.ts`
- `server/core/services/PromoService.ts`
- `server/core/services/VolantinoService.ts`
- `server/core/services/WebPliantService.ts`
- `server/core/services/OrdiniStampaService.ts`
- `server/core/services/KitRuntimeService.ts`
- `server/core/services/DesignKitService.ts`

## Cosa non fare ancora
- Non dividere questo modulo in sotto-moduli prima di aver completato la migrazione base.
- Non cambiare l'algoritmo di calcolo promozioni senza suite di test.
