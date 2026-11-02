import type {
  BoxReportStorico,
  ImportStorico,
  OrigineStorico,
  RecordListino,
  ReferenzaReportStorico
} from '../../../lib/types';
import type { IAgenziaLib } from '../agenzia_lib/types';
import { chiaveBox } from './fantasmi';

const referenzaGenerica = (record: RecordListino): ReferenzaReportStorico => ({
  codice: '',
  descrizione: '',
  campi: Object.entries(record)
    .filter(([, valore]) => ['string', 'number', 'boolean'].includes(typeof valore) && String(valore).trim() !== '')
    .map(([label, valore]) => ({ label, valore: String(valore) }))
});

/** Adatta il report salvato sul runtime kit alle etichette previste dalla GDO installata. */
export const origineStoricoPerReport = (
  importStorico: ImportStorico | null | undefined,
  agenziaLib?: IAgenziaLib
): OrigineStorico | undefined => {
  if (!importStorico) return undefined;

  const referenza = (record: RecordListino): ReferenzaReportStorico =>
    agenziaLib?.storicoVolantino?.referenzaPerReport(record) ?? referenzaGenerica(record);

  const boxFuoriListino: BoxReportStorico[] = importStorico.boxFuoriListino
    ? importStorico.boxFuoriListino.map((box) => ({
      codiceBox: chiaveBox(box),
      pag: box.pag,
      ignorato: box.ignorato,
      testoBox: box.testoBox ?? [],
      referenze: (box.referenze ?? []).map(referenza)
    }))
    : Array.from((importStorico.fuoriListino ?? []).reduce((perBox, voce) => {
      const codiceBox = String(voce.codiceBox);
      const box: BoxReportStorico = perBox.get(codiceBox) ?? {
        codiceBox,
        pag: voce.pag,
        ignorato: false,
        testoBox: [],
        referenze: []
      };
      box.referenze.push({ codice: voce.codice ?? '', descrizione: voce.descrizione ?? '', campi: [] });
      return perBox.set(codiceBox, box);
    }, new Map<string, BoxReportStorico>()).values());

  return {
    importatoIl: importStorico.importatoIl,
    nomeFile: importStorico.nomeFile,
    boxNelVolantino: importStorico.boxNelVolantino,
    referenzeDaListino: importStorico.referenzeDaListino,
    nonImpaginate: (importStorico.nonImpaginate ?? []).map(referenza),
    lasciapassareNonImpaginate: importStorico.lasciapassareNonImpaginate === true,
    totaleFuoriListino: (importStorico.fuoriListino ?? []).length,
    fuoriListinoIgnorati: importStorico.fuoriListinoIgnorati ?? 0,
    boxFuoriListino
  };
};
