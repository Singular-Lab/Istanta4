import Lucide from "@/components/Base/Lucide";
import dayjs from "dayjs";
import "dayjs/locale/it";
import { FC } from "react";
import { KitInfoProps } from "../types";

dayjs.locale("it");

/**
 * KitInfo - Pannello con informazioni dettagliate del kit.
 * Mostra ID, codici, quantità e date.
 */
const KitInfo: FC<KitInfoProps> = ({ lavorazione }) => {

  return (
    <div className="box box--stacked p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-info/10">
          <Lucide icon="Info" className="h-5 w-5 text-info" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-slate-800">Informazioni Kit</h3>
          <p className="text-xs text-slate-500">Dettagli configurazione</p>
        </div>
      </div>

      {/* Info Rows */}
      <div className="space-y-3">
        {/* ID Kit */}
        <div className="flex items-center justify-between py-2 border-b border-slate-100">
          <span className="text-sm text-slate-500">ID Kit</span>
          <span
            className="text-sm font-mono text-slate-700 truncate max-w-[150px]"
            title={lavorazione.guidId}
          >
            {lavorazione.guidId.slice(0, 8)}...
          </span>
        </div>

        {/* Codice Area */}
        {lavorazione.codiceArea && (
          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <span className="text-sm text-slate-500">Codice Area</span>
            <span className="text-sm font-semibold text-slate-700">
              {lavorazione.codiceArea}
            </span>
          </div>
        )}

        {/* Codice Canale */}
        {lavorazione.codiceCanale && (
          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <span className="text-sm text-slate-500">Codice Canale</span>
            <span className="text-sm font-semibold text-slate-700">
              {lavorazione.codiceCanale}
            </span>
          </div>
        )}

        {/* Quantità Copie */}
        {lavorazione.quantitaCopie && (
          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <span className="text-sm text-slate-500">Quantità Copie</span>
            <span className="text-sm font-semibold text-slate-700">
              {lavorazione.quantitaCopie.toLocaleString()}
            </span>
          </div>
        )}

        {/* ID Promo */}
        {lavorazione.promo.nome && (
          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <span className="text-sm text-slate-500">Promo</span>
            <span
              className="text-sm font-mono text-slate-700 truncate max-w-[150px]"
              title={lavorazione.promo.nome}
            >
              {lavorazione.promo.nome}
            </span>
          </div>
        )}

        {/* Data Creazione */}
        <div className="flex items-center justify-between py-2">
          <span className="text-sm text-slate-500">Data Creazione</span>
          <span className="text-sm font-semibold text-slate-700">
            {lavorazione.createdAt
              ? dayjs(lavorazione.createdAt).format("DD/MM/YYYY [alle] HH:mm")
              : "-"}
          </span>
        </div>
      </div>
    </div>
  );
};

export default KitInfo;
