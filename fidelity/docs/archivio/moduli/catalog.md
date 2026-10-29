# Modulo: catalog

## Scopo
Catalogo prodotti e referenze: integrazione ISTANTA, gestione referenze promozionali, foto extra.

## File legacy da migrare in futuro
- `server/core/controllers/IstantaController.ts`
- `server/core/services/ReferenzeService.ts`
- `server/core/repositories/ReferenzeRepository.ts`

## Cosa non fare ancora
- Non spostare la logica ISTANTA prima di testare l'integrazione in staging.
- Non cambiare il formato dei dati referenze usato dal frontend.
