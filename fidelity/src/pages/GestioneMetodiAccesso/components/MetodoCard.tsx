import Badge from "@/components/Base/Badge";
import Button from "@/components/Base/Button";
import { FormSwitch } from "@/components/Base/Form";
import Lucide from "@/components/Base/Lucide";
import StatusBadge from "@/components/Base/StatusBadge";
import Tippy from "@/components/Base/Tippy";
import type { TonoStato } from "@/constants/stati";
import clsx from "clsx";
import type { AuthProviderAdminDTO, StatoSegretoProvider } from "../../../../lib/types";
import { ETICHETTE_SEGRETI, etichettaTipo, TIPI_METODO } from "../utils";

interface MetodoCardProps {
  provider: AuthProviderAdminDTO;
  primo: boolean;
  ultimo: boolean;
  occupato: boolean;
  riordinabile: boolean;
  onSposta: (direzione: -1 | 1) => void;
  onCambiaStato: () => void;
  onProva: () => void;
  onModifica: () => void;
  onElimina: () => void;
}

/** Stato di un segreto: tono e icona della sua pastiglia. */
export const CLASSI_SEGRETO: Record<StatoSegretoProvider, { tono: TonoStato; icona: string; testo: string }> = {
  cifrato: { tono: "success", icona: "Lock", testo: "cifrato" },
  in_chiaro: { tono: "warning", icona: "LockOpen", testo: "in chiaro" },
  assente: { tono: "neutral", icona: "CircleDashed", testo: "non impostato" },
};

const isImmagine = (icona: string) => icona.startsWith("data:image/") || /^https?:\/\//.test(icona);

const MetodoCard = ({
  provider,
  primo,
  ultimo,
  occupato,
  riordinabile,
  onSposta,
  onCambiaStato,
  onProva,
  onModifica,
  onElimina,
}: MetodoCardProps) => {
  const domini = Array.isArray(provider.config_server.domini_ammessi) ? (provider.config_server.domini_ammessi as string[]) : [];
  const iconaTipo = TIPI_METODO.find((t) => t.value === provider.tipo)?.icona ?? "Key";

  return (
    <div
      className={clsx(
        "overflow-hidden rounded-card border border-l-4 border-slate-200 bg-white",
        provider.attivo ? "border-l-primary" : "border-l-slate-300"
      )}
    >
      <div className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4 min-w-0">
            {riordinabile && (
              <div className="flex flex-col items-center gap-0.5">
                <button
                  type="button"
                  title="Sposta su"
                  aria-label={`Sposta ${provider.nome} su`}
                  className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-default"
                  disabled={primo || occupato}
                  onClick={() => onSposta(-1)}
                >
                  <Lucide icon="ChevronUp" aria-hidden="true" className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  title="Sposta giù"
                  aria-label={`Sposta ${provider.nome} giù`}
                  className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-default"
                  disabled={ultimo || occupato}
                  onClick={() => onSposta(1)}
                >
                  <Lucide icon="ChevronDown" aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>
            )}
            <div
              className={clsx(
                "w-12 h-12 rounded-card flex items-center justify-center shrink-0 overflow-hidden",
                provider.attivo ? "bg-primary/10 text-primary" : "bg-slate-100 text-slate-400"
              )}
            >
              {isImmagine(provider.icona)
                ? <img src={provider.icona} alt="" className="w-6 h-6 object-contain" />
                : <Lucide icon={provider.icona || "Key"} className="w-6 h-6" />}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="title-card">{provider.nome}</h3>
                <Badge variant="secondary" size="sm" border className="font-mono">
                  {provider.codice}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-slate-500 line-clamp-2">
                {provider.descrizione || "Nessuna descrizione configurata."}
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <StatusBadge tono="brand" icon={iconaTipo} etichetta={etichettaTipo(provider.tipo)} />
                <StatusBadge
                  tono={provider.attivo ? "success" : "neutral"}
                  etichetta={provider.attivo ? "Attivo" : "Disattivo"}
                />
                {Object.entries(provider.segreti ?? {}).map(([nome, stato]) => (
                  <StatusBadge
                    key={nome}
                    tono={CLASSI_SEGRETO[stato].tono}
                    icon={CLASSI_SEGRETO[stato].icona}
                    etichetta={`${ETICHETTE_SEGRETI[nome] ?? nome}: ${CLASSI_SEGRETO[stato].testo}`}
                  />
                ))}
                {domini.length > 0 && (
                  <StatusBadge tono="info" icon="AtSign" etichetta={domini.join(", ")} />
                )}
                {provider.ruoli_ammessi && provider.ruoli_ammessi.length > 0 && (
                  <StatusBadge tono="brand" icon="Users" etichetta={provider.ruoli_ammessi.join(", ")} />
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <label className="flex items-center gap-1.5 text-xs text-slate-500 mr-1">
              <FormSwitch className="!m-0">
                <FormSwitch.Input
                  type="checkbox"
                  checked={provider.attivo}
                  disabled={occupato}
                  aria-label={provider.attivo ? `Disattiva ${provider.nome}` : `Attiva ${provider.nome}`}
                  onChange={onCambiaStato}
                />
              </FormSwitch>
              {provider.attivo ? "Attivo" : "Disattivo"}
            </label>
            <Button variant="outline-secondary" size="sm" onClick={onProva}>
              <Lucide icon="Stethoscope" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
              Prova
            </Button>
            <Button variant="outline-secondary" size="sm" onClick={onModifica}>
              <Lucide icon="PencilLine" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
              Modifica
            </Button>
            {provider.tipo !== "internal" && (
              <Tippy content="Elimina">
                <Button
                  variant="outline-danger"
                  size="sm"
                  disabled={occupato}
                  aria-label={`Elimina ${provider.nome}`}
                  onClick={onElimina}
                >
                  <Lucide icon="Trash2" aria-hidden="true" className="h-3.5 w-3.5" />
                </Button>
              </Tippy>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MetodoCard;
