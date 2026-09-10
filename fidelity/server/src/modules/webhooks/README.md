# Modulo: webhooks

## Scopo
Gestione webhook in entrata e in uscita: registrazione endpoint, firma HMAC, retry con BullMQ.

## File legacy da migrare in futuro
- `server/core/controllers/WebhookController.ts`
- `server/core/services/WebhookService.ts` (se presente)
- `server/core/models/webhook*.ts`

## Cosa non fare ancora
- Non attivare la queue BullMQ `webhooks` prima di aver migrato il controller.
- Non rimuovere il controller legacy finché le rotte non sono testate nel nuovo modulo.
