import Sezione from "@/components/Base/Sezione";
import EmptyState from "@/components/EmptyState";
import { useState } from "react";
import type { ImpostazioniGdo } from "../../../lib/impostazioniGdo/tipi";
import { monogramma } from "./file";

const COLORE_NEUTRO = "#64748b";

/** Logo dal catalogo, o il monogramma quando manca o non si carica. */
function LogoMarchio({ nome, logo, colore, tondo = false }: { nome: string; logo: string | null; colore?: string | null; tondo?: boolean }) {
  const [rotto, setRotto] = useState(false);
  const forma = tondo ? "h-8 w-8 rounded-full" : "h-11 w-11 rounded-control";
  if (logo && !rotto) {
    return (
      <img
        src={logo}
        alt={`Logo ${nome}`}
        onError={() => setRotto(true)}
        className={`${forma} flex-none border border-slate-200 bg-white object-contain p-0.5`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`${forma} flex flex-none items-center justify-center text-xs font-semibold text-white`}
      style={{ backgroundColor: colore ?? COLORE_NEUTRO }}
    >
      {monogramma(nome)}
    </span>
  );
}

/** Linee e bolli del distributore dichiarati dalla libreria agenzia del cliente: sola lettura. */
function SezioneMarchiDistributore({ lineeDistributore }: { lineeDistributore: ImpostazioniGdo["lineeDistributore"] }) {
  const linee = lineeDistributore?.linee ?? [];
  const bolli = lineeDistributore?.bolli ?? [];

  return (
    <Sezione
      id="marchi-distributore"
      className="scroll-mt-24"
      icona="BadgeCheck"
      titolo="Marchi del distributore"
      descrizione="Le linee e i bolli del distributore che la libreria agenzia del cliente riconosce nelle referenze. Sola lettura: si cambiano nella libreria agenzia."
    >
      {!lineeDistributore || (linee.length === 0 && bolli.length === 0) ? (
        <EmptyState
          compatta
          icon="BadgeCheck"
          title="Nessuna linea del distributore"
          description="La libreria agenzia del cliente non dichiara linee del distributore."
        />
      ) : (
        <div className="flex flex-col gap-5">
          {linee.length > 0 && (
            <ul aria-label="Linee del distributore" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {linee.map((linea) => (
                <li key={linea.sigla} className="flex items-center gap-3 rounded-card border border-slate-200 bg-white p-3">
                  <LogoMarchio nome={linea.nome} logo={linea.logo} colore={linea.colore} />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-800">{linea.nome}</p>
                    <code className="text-xs text-slate-500">{linea.sigla}</code>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {bolli.length > 0 && (
            <div>
              <h3 className="title-card mb-2">Bolli</h3>
              <ul aria-label="Bolli del distributore" className="flex flex-wrap gap-2">
                {bolli.map((bollo) => (
                  <li
                    key={bollo.sigla}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-3 text-sm"
                  >
                    <LogoMarchio nome={bollo.nome} logo={bollo.logo} tondo />
                    {bollo.nome}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Sezione>
  );
}

export default SezioneMarchiDistributore;
