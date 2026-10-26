import { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';
import { SystemNotification } from '../../lib/types';
import { useNotification } from '@/context/NotificationContext';
import Lucide from '@/components/Base/Lucide';
type SocketClient = ReturnType<typeof io>;
const SocketContext = createContext<SocketClient | null>(null);

export const useSocket = () => {
    return useContext(SocketContext);
};

function getNotificationIcon(tipo: SystemNotification['tipo']): string {
    switch (tipo) {
        case 'success': return 'CheckCircle';
        case 'error': return 'AlertCircle';
        case 'warning': return 'AlertTriangle';
        case 'info':
        default: return 'Bell';
    }
}

function getNotificationIconColor(tipo: SystemNotification['tipo']): string {
    switch (tipo) {
        case 'success': return 'text-success';
        case 'error': return 'text-danger';
        case 'warning': return 'text-warning';
        case 'info':
        default: return 'text-info';
    }
}

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
    const [socket, setSocket] = useState<SocketClient | null>(null);
    const { showNotification } = useNotification();
    const handleNotification = (data: SystemNotification) => {
        console.log('Notifica ricevuta:', data);
        showNotification(
            <div className="flex items-center gap-2">
                <Lucide
                    icon={getNotificationIcon(data.tipo) as any}
                    className={`${getNotificationIconColor(data.tipo)} w-4 h-4 shrink-0`}
                />
                <div>
                    {data.titolo && (
                        <div className="text-sm font-semibold">{data.titolo}</div>
                    )}
                    <div className="text-sm text-slate-600">{data.messaggio}</div>
                </div>
            </div>,
            { variant: data.tipo }
        );
    };
    useEffect(() => {
        
        // Costruisce l'URL di connessione con fallback robusto
        let socketUrl = (window as any).__WS_URL__ || import.meta.env.VITE_WS_URL;
        
        // Se non abbiamo un URL valido, usa l'URL corrente
        if (!socketUrl) {
            socketUrl = `${window.location.protocol}//${window.location.host}`;
        }
        
        // Assicurati che l'URL non termini con /api se presente
        if (socketUrl.endsWith('/api')) {
            socketUrl = socketUrl.slice(0, -4);
        }
        
        console.log('URL finale per Socket.IO:', socketUrl);
        
        const newSocket = io(socketUrl, {
            transports: ["websocket"], // Allineato con il server
            forceNew: true,
            timeout: 20000,
            withCredentials: true,
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            autoConnect: true,
            query: {
                'x-internal-request': 'true'
            }
        });

        newSocket.on('connect', () => {
            console.log('Socket.IO connesso con successo!', newSocket.id);
        });

        newSocket.on('connect_error', (error: Error) => {
            console.error('Errore di connessione Socket.IO:', error);
        });

        newSocket.on('disconnect', (reason: string) => {
            console.log('Socket.IO disconnesso:', reason);
        });

        newSocket.on('notifica', (data: unknown) => {
            let stringData: string;

            // Gestione caso ArrayBuffer (tipico in browser)
            if (data instanceof ArrayBuffer) {
                stringData = new TextDecoder().decode(new Uint8Array(data));
            } else if (data && typeof data === 'object' && data.toString() === '[object ArrayBuffer]') {
                // Alcuni browser/ambienti restituiscono oggetti che sembrano ArrayBuffer
                stringData = new TextDecoder().decode(new Uint8Array(data as ArrayBuffer));
            } else if (typeof data === 'string') {
                stringData = data;
            } else if (data && Buffer.isBuffer(data)) {
                stringData = data.toString();
            } else {
                // Fallback: prova a serializzare
                stringData = String(data);
            }

            try {
                const notification = JSON.parse(stringData);
                handleNotification(notification);
            } catch (err) {
                console.error('Errore nel parsing della notifica:', err, stringData);
            }
        });

        setSocket(newSocket);
        
        return () => {
            newSocket.close();
        };
    }, []);

    return (
        <SocketContext.Provider value={socket}>
            {children}
        </SocketContext.Provider>
    );
}; 
