import Pagina from '@/components/Base/Pagina';
import Segmenti, { type OpzioneSegmento } from '@/components/Base/Segmenti';
import withSessionCheck from "@/components/SessionChecker";
import { useState } from 'react';
import ConfrontoRuoli from './ConfrontoRuoli';
import MenuTab from './MenuTab';
import PermessiRuoli from './PermessiRuoli';

type Scheda = 'permessi' | 'confronto' | 'menu';

const SCHEDE: OpzioneSegmento<Scheda>[] = [
  { valore: 'permessi', etichetta: 'Permessi dei ruoli' },
  { valore: 'confronto', etichetta: 'Confronta ruoli' },
  { valore: 'menu', etichetta: 'Menu' },
];

/**
 * Gestione accessi (solo Superadmin). Le schede restano montate: cambiare scheda
 * non perde le modifiche in sospeso sui permessi. Per questo la scelta usa Segmenti
 * e pannelli propri: Tab.Panel di Base smonta i pannelli non selezionati.
 */
function GestioneAccessi() {
  const [scheda, setScheda] = useState<Scheda>('permessi');

  return (
    <Pagina
      titolo="Gestione accessi"
      descrizione="Cosa può vedere e fare ogni ruolo: accesso alle aree, azioni, override per singola GDO e menu."
    >
      <Segmenti
        etichetta="Sezioni della gestione accessi"
        opzioni={SCHEDE}
        valore={scheda}
        onChange={setScheda}
        className="self-start"
      />

      <div>
        <div hidden={scheda !== 'permessi'}><PermessiRuoli /></div>
        <div hidden={scheda !== 'confronto'}>{scheda === 'confronto' && <ConfrontoRuoli />}</div>
        <div hidden={scheda !== 'menu'}><MenuTab /></div>
      </div>
    </Pagina>
  );
}

export default withSessionCheck(GestioneAccessi);
