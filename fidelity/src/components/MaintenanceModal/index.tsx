import Alert from "@/components/Base/Alert";
import Button from "@/components/Base/Button";
import { FormField, FormInput } from "@/components/Base/Form";
import { Dialog } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import Segmenti from "@/components/Base/Segmenti";
import { formatData } from "@/utils/format";
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
    <Dialog open={open} onClose={onClose} size="md">
      <Dialog.Panel>
        <Dialog.Title>
          <Lucide icon="Wrench" aria-hidden="true" className="h-5 w-5 text-warning" />
          Avviso manutenzione sistema
        </Dialog.Title>

        <Dialog.Description className="space-y-5">
          {/* Modalità selector */}
          <Segmenti<Modalita>
            etichetta="Modalità dell'avviso"
            valore={modalita}
            onChange={setModalita}
            opzioni={[
              { valore: "orario", etichetta: "Orario programmato" },
              { valore: "countdown", etichetta: "Tra X minuti" },
            ]}
          />

          {/* Campi per modalità orario */}
          {modalita === "orario" && (
            <div className="space-y-3">
              <FormField etichetta="Giorno">
                <FormInput
                  type="date"
                  value={giorno}
                  min={todayISO()}
                  onChange={(e) => setGiorno(e.target.value)}
                />
              </FormField>
              <div className="flex gap-3">
                <FormField etichetta="Ora inizio" className="flex-1">
                  <FormInput
                    type="time"
                    value={oraInizio}
                    onChange={(e) => setOraInizio(e.target.value)}
                  />
                </FormField>
                <FormField etichetta="Ora fine" className="flex-1">
                  <FormInput
                    type="time"
                    value={oraFine}
                    onChange={(e) => setOraFine(e.target.value)}
                  />
                </FormField>
              </div>
            </div>
          )}

          {/* Campi per modalità countdown */}
          {modalita === "countdown" && (
            <div className="flex items-end gap-2">
              <FormField etichetta="Il sistema andrà offline tra">
                <FormInput
                  type="number"
                  min={1}
                  max={480}
                  value={minuti}
                  onChange={(e) => setMinuti(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-28"
                />
              </FormField>
              <span className="pb-2.5 text-sm text-slate-600">minuti</span>
            </div>
          )}

          {/* Messaggio extra opzionale */}
          <FormField etichetta={<>Nota aggiuntiva <span className="text-slate-400 font-normal">(opzionale)</span></>}>
            <FormInput
              type="text"
              placeholder="es. Aggiornamento server, backup dati..."
              value={messaggioExtra}
              maxLength={120}
              onChange={(e) => setMessaggioExtra(e.target.value)}
            />
          </FormField>

          {/* Anteprima */}
          <Alert variant="soft-warning" icona="TriangleAlert" className="text-sm">
            {modalita === "countdown" ? (
              <>
                Il sistema andrà offline per manutenzione tra{" "}
                <strong>{minuti} {minuti === 1 ? "minuto" : "minuti"}</strong>
                {messaggioExtra && <> — {messaggioExtra}</>}
              </>
            ) : (
              <>
                Il sistema sarà offline per manutenzione il{" "}
                <strong>{giorno ? formatData(giorno) : "—"}</strong>{" "}
                dalle <strong>{oraInizio || "—"}</strong> alle{" "}
                <strong>{oraFine || "—"}</strong>
                {messaggioExtra && <> — {messaggioExtra}</>}
              </>
            )}
          </Alert>

          {avvisoAttivo?.attivo && (
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <Lucide icon="Info" aria-hidden="true" className="w-3.5 h-3.5" />
              È già presente un avviso attivo. Salvando verrà sostituito.
            </p>
          )}
        </Dialog.Description>

        <Dialog.Footer>
          <Button type="button" variant="outline-secondary" onClick={onClose}>
            Annulla
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleSave}
            disabled={!isValid}
            loading={saveMutation.isPending}
          >
            {!saveMutation.isPending && <Lucide icon="BellRing" aria-hidden="true" className="mr-2 h-4 w-4" />}
            Attiva avviso
          </Button>
        </Dialog.Footer>
      </Dialog.Panel>
    </Dialog>
  );
}
