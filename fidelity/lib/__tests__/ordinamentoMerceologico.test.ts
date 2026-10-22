import { describe, expect, it } from 'vitest';
import {
  INDICE_FUORI_ORDINAMENTO,
  ORDINAMENTO_MERCEOLOGICO_VUOTO,
  creaIndiceMerceologico,
  ordinaPerMerceologia,
  type OrdinamentoMerceologico,
} from '../ordinamentoMerceologico';

// Come il SourceOrdinamentoLista di Coopfi: il livello "area" legge il settore del record,
// "settore" il reparto, "reparto" la categoria
const ordinamento: OrdinamentoMerceologico = {
  universale: true,
  campi: { area: 'settore', settore: 'reparto', reparto: 'categoria', categoria: '' },
  voci: [
    { area: 'freschissimi', settore: 'ortofrutta', reparto: 'mele', categoria: '', orderIndex: 1 },
    { area: 'freschissimi', settore: 'ortofrutta', reparto: 'pere', categoria: '', orderIndex: 2 },
    { area: 'freschissimi', settore: 'macelleria', reparto: 'bovino', categoria: '', orderIndex: 10 },
    { area: 'casa', settore: 'detersivi', reparto: 'piatti', categoria: '', orderIndex: 50 },
  ],
};

const ref = (codice: string, settore: string, reparto: string, categoria: string) => ({
  'Referenza.Codice': codice,
  'Scatto.CodiceGruppo': codice,
  settore,
  reparto,
  categoria,
});

const codici = (records: Array<Record<string, unknown>>) => records.map(r => r['Referenza.Codice']);

describe('ordinaPerMerceologia', () => {
  it('ordina le referenze secondo le voci, confrontando senza maiuscole e minuscole', () => {
    const records = [
      ref('D', 'CASA', 'Detersivi', 'Piatti'),
      ref('B', 'freschissimi', 'MACELLERIA', 'bovino'),
      ref('C', 'Freschissimi', 'Ortofrutta', 'PERE'),
      ref('A', 'freschissimi', 'ortofrutta', 'mele'),
    ];

    expect(codici(ordinaPerMerceologia(records, ordinamento))).toEqual(['A', 'C', 'B', 'D']);
  });

  it('mette in coda le referenze senza corrispondenza, nel loro ordine originale', () => {
    const records = [
      ref('X', 'freschissimi', 'pescheria', 'tonno'),
      ref('B', 'freschissimi', 'macelleria', 'bovino'),
      ref('Y', 'stagionali', 'giardino', 'vasi'),
      ref('A', 'freschissimi', 'ortofrutta', 'mele'),
    ];

    expect(codici(ordinaPerMerceologia(records, ordinamento))).toEqual(['A', 'B', 'X', 'Y']);
  });

  it('a parità di voce mantiene l\'ordine ricevuto', () => {
    const records = [ref('M2', 'freschissimi', 'ortofrutta', 'mele'), ref('M1', 'freschissimi', 'ortofrutta', 'mele')];

    expect(codici(ordinaPerMerceologia(records, ordinamento))).toEqual(['M2', 'M1']);
  });

  it('ignora un livello che il record non ha, come Istanta', () => {
    const senzaCategoria = { 'Referenza.Codice': 'S', settore: 'freschissimi', reparto: 'macelleria' };
    const records = [senzaCategoria, ref('A', 'freschissimi', 'ortofrutta', 'mele')];

    expect(codici(ordinaPerMerceologia(records, ordinamento))).toEqual(['A', 'S']);
  });

  it('non ordina il record di gruppo che elenca più codici', () => {
    const gruppo = { ...ref('G1,G2', 'freschissimi', 'ortofrutta', 'mele') };

    expect(creaIndiceMerceologico(ordinamento)(gruppo)).toBe(INDICE_FUORI_ORDINAMENTO);
  });

  it('senza ordinamento lascia l\'ordine ricevuto e non modifica l\'originale', () => {
    const records = [ref('B', 'freschissimi', 'macelleria', 'bovino'), ref('A', 'freschissimi', 'ortofrutta', 'mele')];

    for (const assente of [null, undefined, ORDINAMENTO_MERCEOLOGICO_VUOTO, { ...ordinamento, universale: false }]) {
      const risultato = ordinaPerMerceologia(records, assente);
      expect(codici(risultato)).toEqual(['B', 'A']);
      expect(risultato).not.toBe(records);
    }
  });

  it('non modifica l\'array ricevuto', () => {
    const records = [ref('B', 'freschissimi', 'macelleria', 'bovino'), ref('A', 'freschissimi', 'ortofrutta', 'mele')];

    ordinaPerMerceologia(records, ordinamento);

    expect(codici(records)).toEqual(['B', 'A']);
  });
});
