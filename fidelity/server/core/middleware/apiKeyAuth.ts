import dayjs from 'dayjs';
import { NextFunction, Request, Response } from 'express';
import crypto from 'node:crypto';
import { BadRequestError, UnauthorizedError } from '../../../lib/errors';
import config from '../config';
import { log } from '../logger';
import { RuoloUtenteGDO } from '../models/ruolo_gdo';

/**
 * Middleware per l'autenticazione tramite API Key
 * Utilizzato esclusivamente per le API esterne
 */
export const apiKeyAuthMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Estrae l'API key dall'header
    const apiKey = req.headers['x-api-key'] as string || req.headers['api-key'] as string;

    if (!apiKey) {
      log.warn('API Key mancante', {
        ip: req.ip,
        path: req.path,
        method: req.method,
        userAgent: req.get('User-Agent')
      });

      throw new UnauthorizedError({
        message: 'API Key richiesta per accedere a questo endpoint',
        details: {
          requiredHeader: 'x-api-key o api-key',
          example: 'x-api-key: your-api-key-here'
        }
      });
    }

    // PRIMO CONTROLLO: Verifica se la chiave è valida decifrandola con FICO_SECRET
    if (!verifyApiKey(apiKey)) {
      log.warn('API Key non valida o scaduta', {
        ip: req.ip,
        path: req.path,
        apiKeyPrefix: apiKey.substring(0, 8) + '...'
      });

      throw new UnauthorizedError({
        message: 'API Key non valida o scaduta',
        details: {
          error: 'INVALID_OR_EXPIRED_API_KEY'
        }
      });
    }

    // Cerca il ruolo associato all'API key
    const ruoloGDO = await RuoloUtenteGDO.findOne({
      where: {
        api_key_ruolo_utente_gdo: apiKey
      }
    });

    if (!ruoloGDO) {
      log.warn('API Key non trovata o non valida', {
        ip: req.ip,
        path: req.path,
        apiKeyPrefix: apiKey.substring(0, 8) + '...'
      });

      throw new UnauthorizedError({
        message: 'API Key non valida o scaduta',
        details: {
          error: 'INVALID_API_KEY'
        }
      });
    }

    // Aggiunge le informazioni del ruolo alla richiesta
    (req as any).apiKeyInfo = {
      ruoloId: ruoloGDO.id_ruolo_utente_gdo,
      ruolo: ruoloGDO.ruolo_ruolo_utente_gdo,
      apiKey: apiKey
    };

    log.info('Autenticazione API Key riuscita', {
      ip: req.ip,
      path: req.path,
      ruolo: ruoloGDO.ruolo_ruolo_utente_gdo,
      ruoloId: ruoloGDO.id_ruolo_utente_gdo
    });

    next();
  } catch (error) {
    // Gestione centralizzata degli errori
    if (error instanceof UnauthorizedError || error instanceof BadRequestError) {
      return res.status(error.httpStatus).json({
        success: false,
        error: error.name,
        message: error.message,
        details: error.details,
        timestamp: new Date().toISOString()
      });
    }

    log.error('Errore nel middleware API Key', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: req.ip,
      path: req.path
    });

    res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Errore interno del server durante l\'autenticazione',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Verifica se l'API key ha un formato valido (per compatibilità con chiavi esistenti)
 */
function isValidApiKeyFormat(apiKey: string): boolean {
  // Accetta UUID, hash SHA256 (64 caratteri) o hash alfanumerici di almeno 32 caratteri
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const sha256Regex = /^[a-f0-9]{64}$/i; // SHA256 hash esatto (64 caratteri esadecimali)
  const hashRegex = /^[a-zA-Z0-9]{32,}$/;

  return uuidRegex.test(apiKey) || sha256Regex.test(apiKey) || hashRegex.test(apiKey);
}

/**
 * Verifica se una chiave API è valida decifrandola con FICO_SECRET
 */
export function verifyApiKey(apiKey: string): boolean {
  try {
    const secret = config.FICO_SECRET;

    if (!secret || typeof secret !== 'string' || secret.trim().length === 0) {
      log.error('FICO_SECRET non configurato — tutte le richieste con API key saranno rifiutate');
      return false;
    }

    // Prova a decifrare la chiave
    const key = crypto.createHash('sha256').update(secret).digest();
    const iv = key.subarray(0, 16); // IV fisso derivato dalla secret
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(apiKey, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    // Verifica che i dati decifrati abbiano il formato corretto
    const parts = decrypted.split('-');
    if (parts.length !== 2) {
      return false;
    }

    // Verifica che il timestamp sia valido (non troppo vecchio, es. 1 anno)
    const timestamp = parseInt(parts[1]);
    const oneYearAgo = dayjs().subtract(1, 'year').valueOf();

    return timestamp > oneYearAgo;
  } catch (error) {
    // Se la decifratura fallisce, la chiave non è valida
    return false;
  }
}

/**
 * Genera un UUID v4 per API key
 */
export function generateUuidApiKey(): string {
  return crypto.randomUUID();
}

/**
 * Estende l'interfaccia Request per includere le informazioni API Key
 */
declare global {
  namespace Express {
    interface Request {
      apiKeyInfo?: {
        ruoloId: string;
        ruolo: string;
        apiKey: string;
      };
    }
  }
}
