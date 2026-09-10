import { useCallback, useEffect, useRef, useState } from "react";
import type { UtenteResponseDTO } from "../../../server/core/dto/UtenteDTO";
import { useSocket } from "../../hooks/useSocket";

export interface MenaboEditor {
    socketId: string;
    userId: string;
    userName: string;
    userTipo: string;
}

interface UseMenaboPresenceParams {
    idPromo: string | undefined;
    user: UtenteResponseDTO | null;
}

interface UseMenaboPresenceResult {
    allPresences: Record<string, MenaboEditor[]>;
    isKicked: boolean;
    kickedInfo: { kickedBy: string; divisionId: string } | null;
    joinDivision: (divisionId: string) => void;
    leaveDivision: () => void;
    kickEditor: (targetSocketId: string) => void;
    clearKicked: () => void;
}

export function useMenaboPresence({ idPromo, user }: UseMenaboPresenceParams): UseMenaboPresenceResult {
    const socket = useSocket();
    const [allPresences, setAllPresences] = useState<Record<string, MenaboEditor[]>>({});
    const [kickedInfo, setKickedInfo] = useState<{ kickedBy: string; divisionId: string } | null>(null);
    const currentDivisionRef = useRef<string | undefined>(undefined);

    // Unisciti alla pagina menabò al mount del componente (quando socket e idPromo sono pronti).
    // Il re-join avviene a ogni `connect`: in produzione i socket si riconnettono spesso e il
    // server, al disconnect, ha già rimosso la sessione da `menaboSessions`. Senza ri-annunciare
    // la presenza l'utente resterebbe un "fantasma" (invisibile agli altri, socketId morto → kick
    // inefficace). Ri-emettiamo anche il join sulla divisione corrente per ripristinarne lo stato.
    useEffect(() => {
        if (!socket || !idPromo || !user) return;

        const payload = {
            idPromo,
            userId: user.id,
            userName: user.nome_completo ?? `${user.nome} ${user.cognome}`,
            userTipo: user.tipo,
        };

        const announcePresence = () => {
            socket.emit("menabo:page:join", payload);
            if (currentDivisionRef.current) {
                socket.emit("menabo:join", { idPromo, divisionId: currentDivisionRef.current });
            }
        };

        // Se il socket è già connesso l'evento `connect` non riscatta retroattivamente: annuncia ora.
        if (socket.connected) announcePresence();
        socket.on("connect", announcePresence);

        return () => {
            socket.off("connect", announcePresence);
            socket.emit("menabo:page:leave", { idPromo });
        };
    }, [socket, idPromo, user]);

    // Listener presenza iniziale e aggiornamenti
    useEffect(() => {
        if (!socket) return;

        // Il server invia sempre lo snapshot completo (replace totale): nessun update incrementale,
        // così lo stato non può andare in deriva e restare con presenze fantasma.
        const onAllPresences = (data: Record<string, MenaboEditor[]>) => {
            setAllPresences(data);
        };

        const onKicked = (info: { kickedBy: string; divisionId: string }) => {
            setKickedInfo(info);
        };

        socket.on("menabo:all-presences", onAllPresences);
        socket.on("menabo:kicked", onKicked);

        return () => {
            socket.off("menabo:all-presences", onAllPresences);
            socket.off("menabo:kicked", onKicked);
        };
    }, [socket]);

    const joinDivision = useCallback((divisionId: string) => {
        if (!socket || !idPromo) return;
        currentDivisionRef.current = divisionId;
        socket.emit("menabo:join", { idPromo, divisionId });
    }, [socket, idPromo]);

    const leaveDivision = useCallback(() => {
        if (!socket) return;
        currentDivisionRef.current = undefined;
        socket.emit("menabo:leave");
    }, [socket]);

    const kickEditor = useCallback((targetSocketId: string) => {
        if (!socket) return;
        socket.emit("menabo:kick", { targetSocketId });
    }, [socket]);

    const clearKicked = useCallback(() => {
        setKickedInfo(null);
    }, []);

    return {
        allPresences,
        isKicked: kickedInfo !== null,
        kickedInfo,
        joinDivision,
        leaveDivision,
        kickEditor,
        clearKicked,
    };
}
