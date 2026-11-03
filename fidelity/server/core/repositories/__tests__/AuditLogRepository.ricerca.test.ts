import { Op } from 'sequelize';
import { describe, expect, it } from 'vitest';
import { condizioniRicercaAudit } from '../AuditLogRepository';

// Proposta registro-audit, "Ricerca nel Registro Audit"

describe('AuditLogRepository, ricerca testuale', () => {
  it('cerca senza distinguere maiuscole e minuscole su risorsa, azione, tipo e id dell\'entita e IP', () => {
    const condizioni = condizioniRicercaAudit('c205ada4') as unknown as Array<Record<string, Record<symbol, string>>>;

    for (const campo of ['resource', 'action', 'target_entity_type', 'target_entity_id', 'ip_address']) {
      const condizione = condizioni.find(c => campo in c);
      expect(condizione[campo][Op.iLike]).toBe('%c205ada4%');
    }
  });

  it('nei dettagli, JSONB, cerca sul testo: ILIKE su jsonb va in errore in PostgreSQL', () => {
    type Condizione = { details?: unknown; attribute?: { val?: { col?: string }; type?: string }; logic?: Record<symbol, string> };
    const condizioni = condizioniRicercaAudit('A2625_SC') as unknown as Condizione[];

    expect(condizioni.some(c => 'details' in c)).toBe(false);
    const neiDettagli = condizioni.find(c => c.attribute?.val?.col === 'details');
    expect(neiDettagli?.attribute?.type).toBe('text');
    expect(neiDettagli?.logic?.[Op.iLike]).toBe('%A2625_SC%');
  });
});
