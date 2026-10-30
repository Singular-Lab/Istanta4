import CampoRicerca from "@/components/Base/CampoRicerca";
import { FormSelect } from "@/components/Base/Form";
import Sezione from "@/components/Base/Sezione";
import { formatNumero } from "@/utils/format";
import { testoValidita } from "@/utils/materiali";
import { twMerge } from "@/utils/twMerge";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { PromoPop } from "../../../lib/materiali/tipi";

interface ElencoPromozioniProps {
  promozioni: PromoPop[];
  /** Promo mostrata a destra. */
  idSelezionata: string;
  className?: string;
}

// Senza accenti: "caffe" trova "Caffè"
const normalizza = (testo: string) => testo.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// Cambiando promo si riparte dal suo primo formato, senza i filtri dei file
const percorsoPromo = (idPromo: string) => `?promo=${encodeURIComponent(idPromo)}`;

/**
 * Colonna delle promozioni del periodo: si cerca per nome e se ne sceglie una. Da desktop resta
 * ferma accanto al dettaglio e scorre per conto suo; sotto lg diventa una tendina, perché l'elenco
 * starebbe sopra il dettaglio e lo spingerebbe in fondo alla pagina.
 */
function ElencoPromozioni({ promozioni, idSelezionata, className }: ElencoPromozioniProps) {
  const navigate = useNavigate();
  const [ricerca, setRicerca] = useState("");

  const visibili = useMemo(() => {
    const cercato = normalizza(ricerca.trim());
    return cercato ? promozioni.filter((promo) => normalizza(promo.nome).includes(cercato)) : promozioni;
  }, [promozioni, ricerca]);
  const selezionataInElenco = promozioni.some((promo) => promo.id === idSelezionata);

  return (
    // Lo sticky sta sul contenitore, non sul riquadro: su un elemento sticky (che fa da contesto di
    // impilamento) il secondo foglio di box--stacked si disegnerebbe sopra il fondo, come un
    // riquadro interno spostato, invece di spuntare sotto
    <div className={twMerge("lg:sticky lg:top-24", className)}>
      <Sezione
        as="aside"
        compatta
        aria-label="Promozioni"
        titolo={
          <>
            Promozioni <span className="font-normal tabular-nums text-slate-500">{formatNumero(promozioni.length)}</span>
          </>
        }
      >
        <FormSelect
          formSelectSize="sm"
          aria-label="Promozione"
          className="lg:hidden"
          value={selezionataInElenco ? idSelezionata : ""}
          onChange={(evento) => {
            if (evento.target.value) navigate(percorsoPromo(evento.target.value));
          }}
        >
          {!selezionataInElenco && (
            <option value="" disabled>
              Scegli una promozione
            </option>
          )}
          {promozioni.map((promo) => (
            <option key={promo.id} value={promo.id}>
              {promo.nome} · {formatNumero(promo.numeroFile)} file
            </option>
          ))}
        </FormSelect>
        <div className="hidden lg:block">
          <CampoRicerca
            etichetta="Cerca promozione"
            placeholder="Cerca promozione…"
            value={ricerca}
            onChange={setRicerca}
            className="sm:w-full"
          />
          {visibili.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">Nessuna promozione corrisponde alla ricerca.</p>
          ) : (
            // Un pannello solo: le voci restano dentro il padding del riquadro, la barra di
            // scorrimento ha il suo spazio e non copre il numero dei file
            <ul className="mt-3 max-h-[60vh] space-y-1 overflow-y-auto [scrollbar-gutter:stable]">
              {visibili.map((promo) => {
                const selezionata = promo.id === idSelezionata;
                const validita = testoValidita(promo.validitaDal, promo.validitaAl);
                return (
                  <li key={promo.id}>
                    <Link
                      to={percorsoPromo(promo.id)}
                      aria-current={selezionata ? "true" : undefined}
                      title={promo.nome}
                      className={twMerge(
                        "block rounded-control border-l-2 border-transparent px-2.5 py-2 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-theme-1/40 dark:hover:bg-darkmode-400/40",
                        selezionata && "border-theme-1 bg-theme-1/10 hover:bg-theme-1/10 dark:border-indigo-300 dark:bg-darkmode-400/60"
                      )}
                    >
                      <span className="flex items-baseline justify-between gap-2">
                        <span
                          className={twMerge(
                            "min-w-0 truncate text-sm font-medium text-slate-700 dark:text-slate-200",
                            selezionata && "text-theme-1 dark:text-indigo-200"
                          )}
                        >
                          {promo.nome}
                        </span>
                        <span className="flex-none whitespace-nowrap text-xs tabular-nums text-slate-500 dark:text-slate-400">
                          {formatNumero(promo.numeroFile)}
                          <span className="sr-only"> file POP</span>
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
                        {[validita, `${formatNumero(promo.numeroFormati)} ${promo.numeroFormati === 1 ? "formato" : "formati"}`]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Sezione>
    </div>
  );
}

export default ElencoPromozioni;
