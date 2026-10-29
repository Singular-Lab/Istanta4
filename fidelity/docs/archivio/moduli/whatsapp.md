# Modulo: whatsapp

## Scopo
Integrazione WhatsApp Business API: template, campagne mass, chat bidirezionale, analytics delivery.

## File legacy da migrare in futuro
- `server/core/controllers/WhatsAppController.ts`
- `server/core/services/WhatsAppService.ts`
- `server/core/services/WhatsappQueueService.ts`
- `server/core/services/WhatsappQueueWorker.ts`
- `server/core/models/whatsapp/` (7 modelli)

## Cosa non fare ancora
- Non spostare nulla finché la queue BullMQ `whatsapp` non è testata end-to-end.
- Non modificare i template WhatsApp esistenti.
- Non cambiare il sistema di retry senza un piano di migrazione dati.
