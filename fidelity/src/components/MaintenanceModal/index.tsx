import { FormInput } from "@/components/Base/Form";
import { Dialog } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ServerCall } from "../../../lib/server_call";
import { AvvisoManutenzione } from "../../../lib/types";

interface MaintenanceModalProps {
  open: boolean;
  onClose: () => void;
  avvisoAttivo: AvvisoManutenzione | null | undefined;
}

type Modalita = "orario" | "countdown";

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

export default function MaintenanceModal({ open, onClose, avvisoAttivo }: MaintenanceModalProps) {
  const queryClient = useQueryClient();
  const [modalita, setModalita] = useState<Modalita>("orario");
  const [giorno, setGiorno] = useState<string>(todayISO());
  const [oraInizio, setOraInizio] = useState<string>("22:00");
  const [oraFine, setOraFine] = useState<string>("23:00");
  const [minuti, setMinuti] = useState<number>(20);
  const [messaggioExtra, setMessaggioExtra] = useState<string>("");

  const saveMutation = useMutation({
    mutationFn: (avviso: AvvisoManutenzione) =>
      ServerCall.post<void>("/avviso-manutenzione", avviso),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["avviso-manutenzione"] });
      onClose();
    },
  });

  const handleSave = () => {
    const base: AvvisoManutenzione = {
      attivo: true,
      giorno: modalita === "orario" ? giorno : todayISO(),
      oraInizio: modalita === "orario" ? oraInizio : "",
      oraFine: modalita === "orario" ? oraFine : "",
      creatoIl: new Date().toISOString(),
      messaggioExtra: messaggioExtra.trim() || undefined,
    };
    if (modalita === "countdown") {
      base.minutiRimanenti = minuti;
    }
    saveMutation.mutate(base);
  };

  const isValid =
    modalita === "countdown"
      ? minuti > 0
      : giorno !== "" && oraInizio !== "" && oraFine !== "" && oraInizio < oraFine;

  return (
    <Dialog open={open} onClose={onClose}>
      <Dialog.Panel className="p-0 w-[480px]">
        <Dialog.Title className="flex items-center gap-2 h-14 px-5 border-b border-slate-200/60">
          <Lucide icon="Wrench" className="w-5 h-5 text-amber-500" />
          <h2 className="text-base font-semibold">Avviso Manutenzione Sistema</h2>
        </Dialog.Title>

        <Dialog.Description className="p-5 space-y-5">
          {/* Modalità selector */}
          <div className="flex gap-2">
            <button
              onClick={() => setModalita("orario")}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                modalita === "orario"
                  ? "bg-amber-500 text-white border-amber-500"
                  : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
              }`}
            >
              <Lucide icon="Calendar" className="inline w-4 h-4 mr-1.5 -mt-0.5" />
              Orario programmato
            </button>
            <button
              onClick={() => setModalita("countdown")}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                modalita === "countdown"
                  ? "bg-amber-500 text-white border-amber-500"
                  : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
              }`}
            >
              <Lucide icon="Timer" className="inline w-4 h-4 mr-1.5 -mt-0.5" />
              Tra X minuti
            </button>
          </div>

          {/* Campi per modalità orario */}
          {modalita === "orario" && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Giorno</label>
                <FormInput
                  type="date"
                  value={giorno}
                  min={todayISO()}
                  onChange={(e) => setGiorno(e.target.value)}
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ora inizio</label>
                  <FormInput
                    type="time"
                    value={oraInizio}
                    onChange={(e) => setOraInizio(e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ora fine</label>
                  <FormInput
                    type="time"
                    value={oraFine}
                    onChange={(e) => setOraFine(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Campi per modalità countdown */}
          {modalita === "countdown" && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Il sistema andrà offline tra
                </label>
                <div className="flex items-center gap-2">
                  <FormInput
                    type="number"
                    min={1}
                    max={480}
                    value={minuti}
                    onChange={(e) => setMinuti(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-28"
                  />
                  <span className="text-sm text-slate-600">minuti</span>
                </div>
              </div>
            </div>
          )}

          {/* Messaggio extra opzionale */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nota aggiuntiva <span className="text-slate-400 font-normal">(opzionale)</span>
            </label>
            <FormInput
              type="text"
              placeholder="es. Aggiornamento server, backup dati..."
              value={messaggioExtra}
              maxLength={120}
              onChange={(e) => setMessaggioExtra(e.target.value)}
            />
          </div>

          {/* Anteprima */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 flex items-start gap-2">
            <Lucide icon="AlertTriangle" className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-800">
              {modalita === "countdown" ? (
                <>
                  Il sistema andrà offline per manutenzione tra{" "}
                  <strong>{minuti} {minuti === 1 ? "minuto" : "minuti"}</strong>
                  {messaggioExtra && <> — {messaggioExtra}</>}
                </>
              ) : (
                <>
                  Il sistema sarà offline per manutenzione il{" "}
                  <strong>
                    {giorno
                      ? new Date(giorno + "T00:00:00").toLocaleDateString("it-IT", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "—"}
                  </strong>{" "}
                  dalle <strong>{oraInizio || "—"}</strong> alle{" "}
                  <strong>{oraFine || "—"}</strong>
                  {messaggioExtra && <> — {messaggioExtra}</>}
                </>
              )}
            </p>
          </div>

          {avvisoAttivo?.attivo && (
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <Lucide icon="Info" className="w-3.5 h-3.5" />
              È già presente un avviso attivo. Salvando verrà sostituito.
            </p>
          )}
        </Dialog.Description>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-200/60">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Annulla
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid || saveMutation.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-amber-500 rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {saveMutation.isPending ? (
              <Lucide icon="Loader" className="w-4 h-4 animate-spin" />
            ) : (
              <Lucide icon="BellRing" className="w-4 h-4" />
            )}
            Attiva avviso
          </button>
        </div>
      </Dialog.Panel>
    </Dialog>
  );
}
