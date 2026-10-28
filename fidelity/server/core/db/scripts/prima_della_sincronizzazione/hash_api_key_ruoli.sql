-- Chiavi API dei ruoli GDO: a riposo si conserva solo l'hash.
--
-- Fino a questa versione ruolo_utente_gdo.api_key_ruolo_utente_gdo conteneva la
-- chiave in chiaro (il testo cifrato di 160 caratteri esadecimali consegnato
-- alle integrazioni): chi leggeva il database poteva chiamare le API. Ora
-- l'applicazione salva sha256 della chiave e, a ogni richiesta, confronta
-- sha256 della chiave presentata (middleware/apiKeyAuth.ts, hashApiKey).
--
-- Qui si convertono le chiavi gia' salvate, cosi' le integrazioni esistenti
-- continuano a funzionare con la chiave che hanno. La conversione deve restare
-- identica a hashApiKey: sha256 dei byte UTF-8, esadecimale minuscolo.
--
-- Idempotente: un hash e' gia' di 64 caratteri esadecimali minuscoli e non si
-- tocca, mentre nessuna chiave emessa da Fidelity ha quella forma (sono 160
-- caratteri). Su un database vuoto la tabella non c'e' ancora e non fa nulla.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ruolo_utente_gdo'
      AND column_name = 'api_key_ruolo_utente_gdo'
  ) THEN
    UPDATE public.ruolo_utente_gdo
    SET api_key_ruolo_utente_gdo = encode(sha256(convert_to(api_key_ruolo_utente_gdo, 'UTF8')), 'hex')
    WHERE api_key_ruolo_utente_gdo IS NOT NULL
      AND api_key_ruolo_utente_gdo <> ''
      AND api_key_ruolo_utente_gdo !~ '^[0-9a-f]{64}$';
  END IF;
END $$;
