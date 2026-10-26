import Lucide from '@/components/Base/Lucide';
import PageHeader from '@/components/Base/PageHeader';
import withSessionCheck from "@/components/SessionChecker";
import clsx from 'clsx';
import { useState } from 'react';
import ConfrontoRuoli from './ConfrontoRuoli';
import MenuTab from './MenuTab';
import PermessiRuoli from './PermessiRuoli';

type Scheda = 'permessi' | 'confronto' | 'menu';

const SCHEDE: Array<{ id: Scheda; etichetta: string; icona: string }> = [
  { id: 'permessi', etichetta: 'Permessi dei ruoli', icona: 'KeyRound' },
  { id: 'confronto', etichetta: 'Confronta ruoli', icona: 'Table2' },
  { id: 'menu', etichetta: 'Menu', icona: 'LayoutList' },
];

/**
 * Gestione accessi (solo Superadmin). Le schede restano montate: cambiare scheda
 * non perde le modifiche in sospeso sui permessi.
 */
function GestioneAccessi() {
  const [scheda, setScheda] = useState<Scheda>('permessi');

  return (
    <div className="grid grid-cols-12 gap-y-6 gap-x-6">
      <div className="col-span-12">
        <PageHeader
          title="Gestione accessi"
          description="Cosa può vedere e fare ogni ruolo: accesso alle aree, azioni, override per singola GDO e menu."
        />

        <div className="box box--stacked mt-5 p-2" role="tablist" aria-label="Sezioni della gestione accessi">
          <div className="grid grid-cols-3 gap-1">
            {SCHEDE.map(s => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={scheda === s.id}
                onClick={() => setScheda(s.id)}
                className={clsx(
                  'flex items-center justify-center gap-2 rounded-[0.6rem] border py-3 text-sm transition-colors',
                  scheda === s.id
                    ? 'border-primary/20 bg-primary/[0.05] font-medium text-primary shadow-sm dark:text-slate-200'
                    : 'border-transparent text-slate-500 hover:bg-slate-50 dark:hover:bg-darkmode-400'
                )}
              >
                <Lucide icon={s.icona as any} className="h-4 w-4 stroke-[1.4]" />
                <span className="hidden sm:inline">{s.etichetta}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="col-span-12">
        <div role="tabpanel" hidden={scheda !== 'permessi'}><PermessiRuoli /></div>
        <div role="tabpanel" hidden={scheda !== 'confronto'}>{scheda === 'confronto' && <ConfrontoRuoli />}</div>
        <div role="tabpanel" hidden={scheda !== 'menu'}><MenuTab /></div>
      </div>
    </div>
  );
}

export default withSessionCheck(GestioneAccessi);
