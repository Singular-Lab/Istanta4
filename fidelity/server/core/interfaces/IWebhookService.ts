import { EVENTI_WEBHOOK } from '../../../lib/enums';
import { WebhookAttributes } from '../../../lib/types';
import { TentativoWebhookAttributes } from '../models/TentativoWebhook';

export interface PayloadWebhookData {
  evento: EVENTI_WEBHOOK;
  dati: any;
  meta?: {
    user_id?: string;
    session_id?: string;
    source?: string;
    request_id?: string;
  };
}

export interface IWebhookService {
  // CRUD Operations
  creaWebhook(datiWebhook: Partial<WebhookAttributes>, creatoBy: string): Promise<WebhookAttributes>;
  aggiornaWebhook(idWebhook: string, datiAggiornamento: Partial<WebhookAttributes>): Promise<WebhookAttributes>;
  eliminaWebhook(idWebhook: string): Promise<boolean>;
  ottieniWebhook(idWebhook: string): Promise<WebhookAttributes | null>;
  ottieniTuttiWebhook(filtri?: { attivo?: boolean; creatoBy?: string; }): Promise<WebhookAttributes[]>;
  
  // Event Operations
  scatenaEvento(payload: PayloadWebhookData): Promise<void>;
  
  // Statistics & Monitoring
  ottieniStatisticheWebhook(idWebhook: string): Promise<{
    statistiche_base: any;
    tentativi_recenti: TentativoWebhookAttributes[];
    punteggio_salute: number;
  }>;
  
  // Testing
  testaWebhook(idWebhook: string, datiTest?: any): Promise<boolean>;
  
  // Validation
  validaFirmaWebhook(payload: string, firma: string, secret: string): Promise<boolean>;
} 