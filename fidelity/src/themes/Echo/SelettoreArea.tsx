import Lucide from "@/components/Base/Lucide";
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from "@headlessui/react";
import clsx from "clsx";
import { useId } from "react";
import { AreaMenu, contaVoci } from "./side-menu";

interface SelettoreAreaProps {
  /** Aree del menu, nell'ordine del menu. */
  aree: AreaMenu[];
  /** Chiave dell'area mostrata dal menu. */
  corrente: string;
  /** Sceglie l'area da mostrare: cambia le voci del menu, non la pagina. */
  onScegli: (chiave: string) => void;
  /** Menu ridotto alle icone: resta il riquadro dell'area e l'elenco si apre più largo del menu. */
  compresso?: boolean;
}

/**
 * Selettore dell'area del menu laterale: mostra l'area corrente (riquadro con l'icona, nome e
 * descrizione) e apre l'elenco delle aree, prima quelle di lavoro e poi, sotto "Amministrazione",
 * Gestione interna e Sistema. L'area corrente ha la spunta, le altre il numero delle loro voci.
 * L'elenco sta in un portale ancorato al pulsante: non lo taglia il menu compresso né lo scorrimento.
 * Headless UI gestisce tastiera (frecce, Invio, Esc che riporta il focus al pulsante) e clic fuori.
 */
function SelettoreArea({ aree, corrente, onScegli, compresso = false }: SelettoreAreaProps) {
  const idAmministrazione = useId();
  const area = aree.find((a) => a.chiave === corrente) ?? aree[0];
  if (!area) {
    return null;
  }

  const lavoro = aree.filter((a) => !a.amministrazione);
  const amministrazione = aree.filter((a) => a.amministrazione);

  const opzione = (voce: AreaMenu) => {
    const scelta = voce.chiave === area.chiave;
    const voci = contaVoci(voce.elementi);
    return (
      <ListboxOption
        key={voce.chiave}
        value={voce.chiave}
        className={clsx("selettore-area__opzione", { "selettore-area__opzione--corrente": scelta })}
      >
        <span className="selettore-area__riquadro" aria-hidden="true">
          <Lucide icon={voce.icona} className="selettore-area__icona" />
        </span>
        <span className="selettore-area__testo">
          <span className="selettore-area__nome">{voce.titolo}</span>
          {voce.descrizione && <span className="selettore-area__descrizione">{voce.descrizione}</span>}
        </span>
        {scelta ? (
          <Lucide icon="Check" className="selettore-area__spunta" aria-hidden="true" />
        ) : (
          <span className="selettore-area__conta">
            {voci}
            <span className="sr-only"> {voci === 1 ? "voce" : "voci"}</span>
          </span>
        )}
      </ListboxOption>
    );
  };

  return (
    <Listbox value={area.chiave} onChange={onScegli}>
      <div className={clsx("selettore-area", { "selettore-area--compresso": compresso })}>
        <ListboxButton
          className="selettore-area__pulsante"
          title={`Area: ${area.titolo}`}
          aria-label={`Area: ${area.titolo}`}
        >
          <span className="selettore-area__riquadro" aria-hidden="true">
            <Lucide icon={area.icona} className="selettore-area__icona" />
          </span>
          <span className="selettore-area__testo">
            <span className="selettore-area__nome">{area.titolo}</span>
            {area.descrizione && <span className="selettore-area__descrizione">{area.descrizione}</span>}
          </span>
          <Lucide icon="ChevronsUpDown" className="selettore-area__chevron" aria-hidden="true" />
        </ListboxButton>
        <ListboxOptions
          anchor={{ to: "bottom start", gap: 6, offset: compresso ? -6 : 0, padding: 8 }}
          modal={false}
          className={clsx("selettore-area__elenco", { "selettore-area__elenco--compresso": compresso })}
        >
          {lavoro.length > 0 && (
            <div role="group" aria-label="Aree di lavoro" className="selettore-area__gruppo">
              {lavoro.map(opzione)}
            </div>
          )}
          {amministrazione.length > 0 && (
            <div role="group" aria-labelledby={idAmministrazione} className="selettore-area__gruppo">
              <div id={idAmministrazione} className="selettore-area__separatore">
                Amministrazione
              </div>
              {amministrazione.map(opzione)}
            </div>
          )}
        </ListboxOptions>
      </div>
    </Listbox>
  );
}

export default SelettoreArea;
