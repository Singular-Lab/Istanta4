import Lucide from "@/components/Base/Lucide";
import { useUser } from "@/context/UserContext";
import { useSocket } from "@/hooks/useSocket";
import { useFetchAvvisoManutenzione } from "@/query/query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { TIPO_UTENTI } from "../../../lib/enums";
import { ServerCall } from "../../../lib/server_call";
import { AvvisoManutenzione } from "../../../lib/types";

function formatDate(isoDate: string): string {
  const d = new Date(isoDate + "T00:00:00");
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });
}

function calcMinutiRimanenti(avviso: AvvisoManutenzione): number {
  if (!avviso.minutiRimanenti || !avviso.creatoIl) return 0;
  const creatoIl = new Date(avviso.creatoIl).getTime();
  const minutiPassati = Math.floor((Date.now() - creatoIl) / 60000);
  return Math.max(0, avviso.minutiRimanenti - minutiPassati);
}

export default function MaintenanceBanner() {
  const { user } = useUser();
  const { data: avvisoRemoto } = useFetchAvvisoManutenzione();
  const [avviso, setAvviso] = useState<AvvisoManutenzione | null | undefined>(undefined);
  const [minutiRimanenti, setMinutiRimanenti] = useState<number>(0);
  const socket = useSocket();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (avvisoRemoto !== undefined) {
      setAvviso(avvisoRemoto);
      if (avvisoRemoto?.minutiRimanenti) {
        setMinutiRimanenti(calcMinutiRimanenti(avvisoRemoto));
      }
    }
  }, [avvisoRemoto]);

  useEffect(() => {
    if (!socket) return;
    const handleAvviso = (data: AvvisoManutenzione | null) => {
      setAvviso(data);
      if (data?.minutiRimanenti) setMinutiRimanenti(calcMinutiRimanenti(data));
      queryClient.invalidateQueries({ queryKey: ["avviso-manutenzione"] });
    };
    socket.on("avviso_manutenzione", handleAvviso);
    return () => { socket.off("avviso_manutenzione", handleAvviso); };
  }, [socket, queryClient]);

  useEffect(() => {
    if (!avviso?.minutiRimanenti) return;
    const interval = setInterval(() => setMinutiRimanenti(calcMinutiRimanenti(avviso)), 60000);
    return () => clearInterval(interval);
  }, [avviso]);

  const deleteMutation = useMutation({
    mutationFn: () => ServerCall.delete("/avviso-manutenzione"),
    onSuccess: () => {
      setAvviso(null);
      queryClient.invalidateQueries({ queryKey: ["avviso-manutenzione"] });
    },
  });

  if (!avviso?.attivo) return null;

  const isCountdown = !!avviso.minutiRimanenti;
  const isSuperadmin = user?.tipo === TIPO_UTENTI.SUPERADMIN;

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] bg-amber-500 text-white px-5 py-2.5 flex items-center justify-between gap-3 shadow-sm">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Lucide icon="AlertTriangle" className="w-4 h-4 flex-shrink-0" />
        <span className="text-sm font-medium leading-snug">
          {isCountdown ? (
            minutiRimanenti > 0 ? (
              <>
                Il sistema andrà offline per manutenzione tra{" "}
                <strong>{minutiRimanenti} {minutiRimanenti === 1 ? "minuto" : "minuti"}</strong>
              </>
            ) : (
              <>Il sistema potrebbe andare offline per manutenzione a breve</>
            )
          ) : (
            <>
              Il sistema sarà offline per manutenzione il{" "}
              <strong>{formatDate(avviso.giorno)}</strong> dalle{" "}
              <strong>{avviso.oraInizio}</strong> alle{" "}
              <strong>{avviso.oraFine}</strong>
            </>
          )}
          {avviso.messaggioExtra && (
            <span className="ml-2 opacity-80">— {avviso.messaggioExtra}</span>
          )}
        </span>
      </div>
      {isSuperadmin && (
        <button
          onClick={() => deleteMutation.mutate()}
          disabled={deleteMutation.isPending}
          className="flex-shrink-0 p-1 rounded hover:bg-amber-600 transition-colors disabled:opacity-50"
          title="Rimuovi avviso"
        >
          <Lucide icon="X" className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
