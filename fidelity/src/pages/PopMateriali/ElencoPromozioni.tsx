import CampoRicerca from "@/components/Base/CampoRicerca";
import Sezione from "@/components/Base/Sezione";
import { formatNumero } from "@/utils/format";
import { testoValidita } from "@/utils/materiali";
import { twMerge } from "@/utils/twMerge";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { PromoPop } from "../../../lib/materiali/tipi";

interface ElencoPromozioniProps {
  promozioni: PromoPop[];
  /** Promo mostrata a destra. */
  idSelezionata: string;
  className?: string;
}

// Senza accenti: "caffe" trova "Caffè"
const normalizza = (testo: string) => testo.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Colonna delle promozioni del periodo: si cerca per nome e se ne sceglie una. */
function ElencoPromozioni({ promozioni, idSelezionata, className }: ElencoPromozioniProps) {
  const [ricerca, setRicerca] = useState("");

  const visibili = useMemo(() => {
    const cercato = normalizza(ricerca.trim());
    return cercato ? promozioni.filter((promo) => normalizza(promo.nome).includes(cercato)) : promozioni;
  }, [promozioni, ricerca]);

  return (
    <Sezione
      as="aside"
      compatta
      aria-label="Promozioni"
      titolo={
        <>
          Promozioni <span className="font-normal tabular-nums text-slate-500">{formatNumero(promozioni.length)}</span>
        </>
      }
      className={className}
    >
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
        <ul className="-mx-2 mt-3 space-y-1">
          {visibili.map((promo) => {
            const selezionata = promo.id === idSelezionata;
            const validita = testoValidita(promo.validitaDal, promo.validitaAl);
            return (
              <li key={promo.id}>
                <Link
                  // Cambiando promo si riparte dal suo primo formato
                  to={`?promo=${encodeURIComponent(promo.id)}`}
                  aria-current={selezionata ? "true" : undefined}
                  className={twMerge(
                    "block rounded-control px-2 py-2 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40",
                    selezionata && "bg-theme-1/10 hover:bg-theme-1/10"
                  )}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={twMerge("truncate text-sm font-medium text-slate-700", selezionata && "text-theme-1")}>
                      {promo.nome}
                    </span>
                    <span className="flex-none text-xs tabular-nums text-slate-500">
                      {formatNumero(promo.numeroFile)}
                      <span className="sr-only"> file POP</span>
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-slate-500">
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
    </Sezione>
  );
}

export default ElencoPromozioni;
