import Lucide from '@/components/Base/Lucide';
import React from 'react';
import { Link } from 'react-router-dom';
import { twMerge } from "@/utils/twMerge";

export type Indietro = { etichetta?: string } & ({ to: string; onClick?: never } | { onClick: () => void; to?: never });

interface PageHeaderProps {
  title: string;
  description?: string | React.ReactNode;
  actions?: React.ReactNode;
  /** Pulsante prima del titolo per tornare alla pagina precedente. */
  indietro?: Indietro;
  /** Badge accanto al titolo, per esempio lo stato della promo. */
  badges?: React.ReactNode;
  className?: string;
}

// Sulla fascia scura della testata (mode--light) i badge stanno su una superficie chiara: i loro
// colori sono pensati per il fondo della pagina, e un badge senza fondo sparirebbe sul blu
const classiBadge =
  'flex flex-wrap items-center gap-2 group-[.mode--light]:rounded-control group-[.mode--light]:bg-white/95 group-[.mode--light]:px-1.5 group-[.mode--light]:py-1 group-[.mode--light]:shadow-sm dark:group-[.mode--light]:bg-darkmode-600/95';

const classiIndietro =
  'mt-1 flex h-8 w-8 flex-none items-center justify-center rounded-control border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40';

const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  actions,
  indietro,
  badges,
  className
}) => {
  const etichettaIndietro = indietro?.etichetta ?? 'Indietro';
  const icona = <Lucide icon="ArrowLeft" aria-hidden="true" className="h-4 w-4" />;

  return (
    <div className={twMerge('mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {indietro?.to !== undefined && (
          <Link to={indietro.to} aria-label={etichettaIndietro} title={etichettaIndietro} className={classiIndietro}>
            {icona}
          </Link>
        )}
        {indietro?.onClick && (
          <button type="button" onClick={indietro.onClick} aria-label={etichettaIndietro} title={etichettaIndietro} className={classiIndietro}>
            {icona}
          </button>
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {/* I codici senza spazi (PE2623_24_MIPREMIO_05-11-26) vanno a capo invece di uscire dallo schermo; i titoli con spazi non cambiano */}
            <h1 className="title-page min-w-0 max-w-full text-slate-800 [overflow-wrap:anywhere] group-[.mode--light]:text-white group-[.mode--dark]:text-slate-800">
              {title}
            </h1>
            {badges && <div className={classiBadge}>{badges}</div>}
          </div>
          {description && (
            <div className="text-slate-500 mt-1 group-[.mode--light]:text-white group-[.mode--dark]:text-slate-800">
              {description}
            </div>
          )}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:ml-4 sm:flex-none sm:justify-end">{actions}</div>}
    </div>
  );
};

export default PageHeader;
