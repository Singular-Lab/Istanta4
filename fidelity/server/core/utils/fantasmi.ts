import type { BoxFuoriListino, FantasmaDeciso, FantasmaIncompleto } from '../../../lib/types';

/** Il box fantasma come lo segnala il sistema di storico: quello che serve per riagganciarlo. */
export interface FantasmaSegnalato {
  groupId?: number | string;
  dna?: string;
  pag?: number;
  /** I testi del box come li ha letti il plugin nel volantino. */
  compiledFields?: Array<{ content?: unknown }>;
}

/** Lo stesso box arriva dal sistema di storico e dal plugin: si riconosce per groupId, o per DNA se manca. */
export const chiaveBox = (box: { groupId?: number | string; dna?: string }) => String(box.groupId ?? box.dna ?? '');

export function indicizzaPerBox<T extends { groupId?: number | string; dna?: string }>(boxes: T[]): Map<string, T> {
  return new Map(boxes.map((box) => [chiaveBox(box), box]));
}

/**
 * Chi sono i fantasmi rimasti senza risposta e quali campi mancano a quelli
 * compilati. Torna una riga per problema, cosi il plugin dice all'operatore
 * esattamente dove tornare invece di un "dati incompleti" che non aiuta nessuno.
 * Quali campi servono lo dice l'agenzia lib: dipende dal listino del cliente.
 */
export function fantasmiIncompleti(
  segnalati: FantasmaSegnalato[],
  decisi: FantasmaDeciso[],
  campiObbligatori: Array<{ campo: string; etichetta: string }>
): FantasmaIncompleto[] {
  const problemi: FantasmaIncompleto[] = [];
  const perBox = indicizzaPerBox(decisi);

  for (const fantasma of segnalati) {
    const deciso = perBox.get(chiaveBox(fantasma));
    if (!deciso) {
      problemi.push({
        groupId: typeof fantasma.groupId === 'number' ? fantasma.groupId : undefined,
        pag: fantasma.pag,
        campi: [],
        motivo: 'Box fantasma senza decisione: va compilato oppure ignorato',
      });
      continue;
    }
    if (deciso.ignorato) continue;
    const referenze = Array.isArray(deciso.referenze) ? deciso.referenze : [];
    if (referenze.length === 0) {
      problemi.push({
        groupId: deciso.groupId, pag: deciso.pag, campi: [],
        motivo: 'Box fantasma accettato ma senza nessuna referenza compilata',
      });
      continue;
    }
    referenze.forEach((referenza, indice) => {
      const mancanti = campiObbligatori
        .filter(({ campo }) => String(referenza[campo] ?? '').trim() === '')
        .map(({ etichetta }) => etichetta);
      if (mancanti.length === 0) return;
      problemi.push({
        groupId: deciso.groupId, pag: deciso.pag, referenza: indice + 1,
        campi: mancanti,
        motivo: `Referenza ${indice + 1}: manca ${mancanti.join(', ')}`,
      });
    });
  }
  return problemi;
}

/**
 * Il report dei box fuori listino: uno per decisione presa, perche sono le
 * decisioni a diventare referenze. Dal box segnalato si recupera il testo, l'unica
 * traccia di cosa c'era nel volantino quando l'operatore lo ha ignorato.
 */
export function reportFuoriListino(segnalati: FantasmaSegnalato[], decisi: FantasmaDeciso[]): BoxFuoriListino[] {
  const perBox = indicizzaPerBox(segnalati);
  return decisi.map((deciso) => {
    const segnalato = perBox.get(chiaveBox(deciso));
    return {
      groupId: deciso.groupId ?? segnalato?.groupId,
      dna: deciso.dna ?? segnalato?.dna,
      pag: deciso.pag ?? segnalato?.pag,
      ignorato: deciso.ignorato === true,
      testoBox: (segnalato?.compiledFields ?? [])
        .map((campo) => typeof campo?.content === 'string' || typeof campo?.content === 'number' ? String(campo.content).trim() : '')
        .filter(Boolean),
      referenze: deciso.ignorato || !Array.isArray(deciso.referenze) ? [] : deciso.referenze,
    };
  });
}
