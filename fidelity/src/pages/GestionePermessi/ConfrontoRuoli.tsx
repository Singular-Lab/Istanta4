import BarraFiltri from '@/components/Base/BarraFiltri';
import CampoRicerca from '@/components/Base/CampoRicerca';
import { FormSelect } from '@/components/Base/Form';
import FormSwitch from '@/components/Base/Form/FormSwitch';
import Lucide from '@/components/Base/Lucide';
import PageError from '@/components/Base/PageError';
import Sezione from '@/components/Base/Sezione';
import Spinner from '@/components/Base/Spinner';
import StatusBadge from '@/components/Base/StatusBadge';
import Tippy from '@/components/Base/Tippy';
import EmptyState from '@/components/EmptyState';
import clsx from 'clsx';
import { Fragment, useMemo, useState } from 'react';
import { AREE, DefinizioneAzione } from '../../../lib/accessi/catalogo';
import { useConfronto, useRuoliGestibili } from './api';
import { ETICHETTE_TIPO, etichettaSottoRuolo } from './ruoli';

/** Matrice in sola lettura: permessi effettivi (con le regole d'area) per ogni ruolo. */
const ConfrontoRuoli = () => {
  const ruoli = useRuoliGestibili();
  const [idGdo, setIdGdo] = useState<string | null>(null);
  const [ricerca, setRicerca] = useState('');
  const [soloDifferenze, setSoloDifferenze] = useState(false);
  const confronto = useConfronto(idGdo);

  const colonne = useMemo(() => {
    const nomiRuoli = new Map((ruoli.data?.ruoliGdo ?? []).map(r => [r.id, r.nome]));
    return (confronto.data?.colonne ?? []).map(c => ({
      ...c,
      etichetta: c.idRuoloGdo
        ? etichettaSottoRuolo(nomiRuoli.get(c.idRuoloGdo) ?? c.etichetta)
        : ETICHETTE_TIPO[c.tipo] ?? c.tipo,
      insieme: new Set(c.permessi),
    }));
  }, [confronto.data, ruoli.data]);

  const righePerArea = useMemo(() => {
    const q = ricerca.trim().toLowerCase();
    return AREE.filter(a => !a.sistema).map(area => {
      const azioni: DefinizioneAzione[] = [...(area.accesso ? [area.accesso] : []), ...area.azioni];
      const righe = azioni.filter(azione => {
        if (q && `${azione.nome} ${azione.codice} ${area.nome}`.toLowerCase().indexOf(q) < 0) return false;
        if (!soloDifferenze || colonne.length === 0) return true;
        const valori = colonne.map(c => c.insieme.has(azione.codice));
        return valori.some(v => v) && valori.some(v => !v);
      });
      return { area, righe };
    }).filter(g => g.righe.length > 0);
  }, [colonne, ricerca, soloDifferenze]);

  return (
    <Sezione senzaPadding className="overflow-hidden" titolo="Confronto dei ruoli" descrizione="Permessi effettivi di ogni ruolo, con le regole d'area">
      <BarraFiltri
        destra={
          <FormSwitch className="flex-shrink-0">
            <FormSwitch.Input
              id="solo-differenze"
              type="checkbox"
              checked={soloDifferenze}
              onChange={() => setSoloDifferenze(v => !v)}
            />
            <FormSwitch.Label htmlFor="solo-differenze" className="text-sm">Solo differenze</FormSwitch.Label>
          </FormSwitch>
        }
      >
        <CampoRicerca
          etichetta="Cerca un permesso"
          placeholder="Cerca un permesso..."
          value={ricerca}
          onChange={setRicerca}
        />
        <FormSelect
          formSelectSize="sm"
          className="sm:w-72"
          value={idGdo ?? ''}
          onChange={e => setIdGdo(e.target.value || null)}
          aria-label="Ambito del confronto"
        >
          <option value="">Permessi dei ruoli (senza override)</option>
          {(ruoli.data?.gdo ?? []).map(g => (
            <option key={g.id} value={g.id}>Con gli override di {g.nome}</option>
          ))}
        </FormSelect>
      </BarraFiltri>

      <div>
        {confronto.isLoading ? (
          <div role="status" className="flex items-center gap-2 p-5 text-sm text-slate-500">
            <Spinner size="sm" decorativo /> Caricamento confronto...
          </div>
        ) : confronto.isError ? (
          <div className="p-5">
            <PageError
              compatta
              titolo="Confronto non caricato"
              motivo={(confronto.error as any)?.message || 'Impossibile caricare il confronto dei ruoli'}
              onRiprova={() => confronto.refetch()}
            />
          </div>
        ) : righePerArea.length === 0 ? (
          ricerca.trim() || soloDifferenze ? (
            <EmptyState
              compatta
              icon="SearchX"
              title="Nessun risultato"
              description="Nessun permesso corrisponde alla ricerca o al filtro."
            />
          ) : (
            <EmptyState compatta icon="Table2" title="Nessun permesso da mostrare" description="" />
          )
        ) : (
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 top-0 z-20 min-w-[260px] border-b border-slate-200 bg-slate-50 px-4 py-3 text-left text-2xs font-medium uppercase tracking-wide text-slate-500 dark:border-darkmode-400 dark:bg-darkmode-700">
                    Permesso
                  </th>
                  {colonne.map(c => (
                    <th
                      key={c.chiave}
                      className={clsx(
                        // Intestazioni a capo e strette: 11 colonne entrano a 1280 px senza scorrere
                        'sticky top-0 z-10 min-w-[88px] max-w-[120px] whitespace-normal border-b border-slate-200 bg-slate-50 px-2 py-2 text-center align-bottom text-xs font-medium leading-tight text-slate-600 dark:border-darkmode-400 dark:bg-darkmode-700 dark:text-slate-300',
                        c.idRuoloGdo && 'font-normal text-slate-500'
                      )}
                    >
                      {c.idRuoloGdo && <span className="block text-3xs font-normal uppercase tracking-wide text-slate-400">{ETICHETTE_TIPO[c.tipo] ?? c.tipo}</span>}
                      {c.etichetta}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {righePerArea.map(({ area, righe }) => (
                  <Fragment key={area.id}>
                    <tr>
                      {/* L'etichetta sta nella prima cella, fissa a sinistra: una cella con colSpan su tutta la riga scorrerebbe via */}
                      <td className="sticky left-0 z-[5] border-b border-slate-200 bg-white px-4 pb-2 pt-4 dark:border-darkmode-400 dark:bg-darkmode-600">
                        <span className="title-eyebrow inline-flex items-center gap-2">
                          <Lucide icon={area.icona as any} aria-hidden="true" className="h-3.5 w-3.5" />
                          {area.nome}
                        </span>
                      </td>
                      {colonne.length > 0 && (
                        <td colSpan={colonne.length} className="border-b border-slate-200 bg-white dark:border-darkmode-400 dark:bg-darkmode-600" />
                      )}
                    </tr>
                    {righe.map(azione => (
                      <tr key={azione.codice} className="hover:bg-slate-50/70 dark:hover:bg-darkmode-700/30">
                        <td className="sticky left-0 z-[5] border-b border-slate-100 bg-white px-4 py-2.5 dark:border-darkmode-400 dark:bg-darkmode-600">
                          <Tippy content={azione.codice} options={{ placement: 'right', delay: [500, 0] }}>
                            <span className="text-slate-700 dark:text-slate-200">{azione.nome}</span>
                          </Tippy>
                          {area.accesso?.codice === azione.codice && (
                            <StatusBadge tono="brand" etichetta="Accesso" className="ml-2" />
                          )}
                        </td>
                        {colonne.map(c => {
                          const abilitato = c.insieme.has(azione.codice);
                          return (
                            <td key={c.chiave} className="border-b border-slate-100 px-3 py-2.5 text-center dark:border-darkmode-400">
                              {abilitato ? (
                                <Lucide icon="Check" className="mx-auto h-4 w-4 text-success" aria-label="Abilitato" />
                              ) : (
                                <span className="text-slate-300" aria-label="Non abilitato">–</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Sezione>
  );
};

export default ConfrontoRuoli;
