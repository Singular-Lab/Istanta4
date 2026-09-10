import React, { useCallback, useEffect, useState, useMemo } from 'react';
import styleWp from "@/assets/css/webpliant/stylewp.module.scss";
import { ServerCall } from '../../../lib/server_call';
import { DataFields } from '../../../lib/types';
import clsx from 'clsx';
import { useGestioneHeaderWebpliant } from '@/context/GestioneHeaderWebpliant';
import { useNavigate } from 'react-router-dom';
import { useWebpliantParamsManager } from '@/hooks/useWebpliantParamsManager';
import { useWishlistEvents } from '@/utils/wishlistEvents';

const WishlistWebpliant: React.FC = () => {
    const [refLista, setRefLista] = useState<DataFields[] | null>(null);
    const [wishlistLoading, setWishlistLoading] = useState(false);
    const [wishlistError, setWishlistError] = useState<string | null>(null);
    const navigate = useNavigate();
    const { oggettoHeaderWebpliant, setOggettoHeaderWebpliant } = useGestioneHeaderWebpliant();
    
    // Utilizza il nuovo sistema centralizzato di gestione parametri
    const webpliantParams = useWebpliantParamsManager();
    const {
        // Parametri essenziali
        idArea,
        idCanale,
        idGDO,
        idPV,
        idWorkspace,
        idPagina,
        
        // Parametri di sessione
        sessionWishlistId,
        isCondivisa,
        
        // Stato
        isLoading,
        error,
        isReady,
        
        // Utility functions
        buildUrlWithCurrentParams,
    } = webpliantParams;

    // Sistema di eventi per la gestione della wishlist
    const { events: wishlistEvents } = useWishlistEvents();

    // 🔍 DEBUG: Log completo dello stato del sistema webpliant (solo al mount)
    useEffect(() => {
        console.log('🔍 WishlistWebpliant: Stato completo webpliantParams:', {
            sessionWishlistId,
            idArea,
            idCanale,
            idGDO,
            idPV,
            idWorkspace,
            idPagina,
            isCondivisa,
            isLoading,
            error,
            isReady
        });
        
        // Debug aggiuntivo: mostra tutti i parametri dell'URL corrente
        const urlParams = new URLSearchParams(window.location.search);
        console.log('🔍 WishlistWebpliant: Parametri URL correnti:', {
            guidIdWishlist: urlParams.get('guidIdWishlist'),
            idArea: urlParams.get('idArea'),
            idCanale: urlParams.get('idCanale'),
            idGDO: urlParams.get('idGDO'),
            idPV: urlParams.get('idPV'),
            idWorkspace: urlParams.get('id'),
            idPagina: urlParams.get('idPagina'),
            isCondivisa: urlParams.get('c'),
            fullUrl: window.location.href
        });
    }, []); // Esegui solo al mount per evitare loop

    // Configura header al mount (esegui solo una volta)
    useEffect(() => {
        setOggettoHeaderWebpliant({
            showListaPagine: false,
            showWishlist: false,
            showLogo: true,
            showPuntiVendita: false,
        });
    }, [setOggettoHeaderWebpliant]); // Rimuovi oggettoHeaderWebpliant dalle dipendenze per evitare loop



    // Funzione per fetch delle referenze
    const fetchWishlistData = useCallback(async (wishlistId: string) => {
        setWishlistLoading(true);
        setWishlistError(null);

        try {
            console.log('🔍 Fetching wishlist data for ID:', wishlistId);
            const refs = await ServerCall.get<DataFields[]>(`/getAllReferenzeFromWishlistId?id=${wishlistId}`);
            console.log('✅ Wishlist data fetched successfully:', refs?.length || 0, 'items');
            setRefLista(refs);
        } catch (error) {
            console.error('❌ Error fetching wishlist data:', error);
            setWishlistError(error instanceof Error ? error.message : 'Errore durante il caricamento della wishlist');
            setRefLista([]);
        } finally {
            setWishlistLoading(false);
        }
    }, []);



    // Initial fetch quando sessionWishlistId cambia
    useEffect(() => {
        if (sessionWishlistId) {
            fetchWishlistData(sessionWishlistId);
        } else {
            setRefLista(null);
            setWishlistError(null);
        }
    }, [sessionWishlistId, fetchWishlistData]);

    // Listen agli eventi wishlist per aggiornamenti in tempo reale
    useEffect(() => {
        const unsubscribeUpdated = wishlistEvents.on('wishlist-updated', (event) => {
            if (!event.wishlistId || event.wishlistId === sessionWishlistId) {
                console.log('🔔 Wishlist updated event received, refreshing...');
                if (sessionWishlistId) {
                    fetchWishlistData(sessionWishlistId);
                }
            }
        });

        const unsubscribeItemAdded = wishlistEvents.on('item-added', (event) => {
            if (!event.wishlistId || event.wishlistId === sessionWishlistId) {
                console.log('🔔 Item added event received, refreshing...');
                if (sessionWishlistId) {
                    fetchWishlistData(sessionWishlistId);
                }
            }
        });

        const unsubscribeItemRemoved = wishlistEvents.on('item-removed', (event) => {
            if (!event.wishlistId || event.wishlistId === sessionWishlistId) {
                console.log('🔔 Item removed event received, refreshing...');
                if (sessionWishlistId) {
                    fetchWishlistData(sessionWishlistId);
                }
            }
        });

        return () => {
            unsubscribeUpdated();
            unsubscribeItemAdded();
            unsubscribeItemRemoved();
        };
    }, [sessionWishlistId, fetchWishlistData, wishlistEvents]);

    // Handler per la condivisione
    const handleShare = useCallback(() => {
        const currentUrl = `${window.location.origin}/webpliant/wishlist?guidIdWishlist=${sessionWishlistId}&c=true`;
        const shareData = {
            title: 'Condividi la tua wishlist',
            text: 'Guarda la mia wishlist',
            url: currentUrl,
        };

        if (navigator.share) {
            navigator.share(shareData)
                .then(() => console.log('Condivisione avviata con successo'))
                .catch((error) => console.error('Errore durante la condivisione:', error));
        } else if (navigator.clipboard) {
            navigator.clipboard.writeText(currentUrl)
                .then(() => alert('Link copiato negli appunti!'))
                .catch((err) => console.error('Errore durante la copia del link:', err));
        } else {
            console.warn('API Web Share e Clipboard non supportate');
        }
    }, [sessionWishlistId]);

    // Memoizza la funzione per evitare ricreazioni
    const memoizedBuildUrl = useMemo(() => buildUrlWithCurrentParams, [
        idArea, idCanale, idGDO, idPV, idWorkspace, idPagina, sessionWishlistId
    ]);

    // Handler per tornare alla promozione
    const handleBackToPromotion = useCallback(() => {
        if (!idPagina || !idWorkspace || !idArea || !idCanale || !idGDO ) {
            console.error('Parametri mancanti per la navigazione');
            return;
        }

        const promoUrl = memoizedBuildUrl('/webpliant/volantino');
        navigate(promoUrl.replace(window.location.origin, ''));
    }, [idPagina, idWorkspace, idArea, idCanale, idGDO, idPV, memoizedBuildUrl, navigate]);

    // Loading state (considera sia il caricamento dei parametri che della wishlist)
    if (isLoading || wishlistLoading) {
        return (
            <main className="mt-20 w-full p-5 h-full flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p>Caricamento wishlist...</p>
                </div>
            </main>
        );
    }

    // Error state (considera sia errori dei parametri che della wishlist)
    if (error || wishlistError) {
        return (
            <main className="mt-20 w-full p-5 h-full flex items-center justify-center">
                <div className="text-center text-red-600">
                    <h2 className="text-xl font-bold mb-2">Errore</h2>
                    <p>{error || wishlistError}</p>
                    <button 
                        onClick={() => window.location.reload()} 
                        className={clsx(styleWp["wp-btn"], styleWp["wp-btn-primary"], "mt-4")}
                    >
                        Ricarica Pagina
                    </button>
                </div>
            </main>
        );
    }

    return (
        <main className="mt-20 w-full p-5 h-full">
            <div className="text-center mb-4">
                <h1 className={clsx("text-2xl font-bold mb-2")}>
                    {isCondivisa ? "Wishlist Condivisa" : "La Mia Wishlist"}
                </h1>
            </div>
            
            <div className='flex flex-row items-center justify-center h-full mb-5 space-x-4 flex-wrap'>
                <button
                    className={clsx(styleWp["wp-btn"], styleWp["wp-btn-primary"], "mt-auto")}
                    onClick={handleBackToPromotion}
                    disabled={!isReady}
                >
                    Torna alla Promozione
                </button>
                

                
                {!isCondivisa && sessionWishlistId && (
                    <button
                        className={clsx(styleWp["wp-btn"], styleWp["wp-btn-primary"], "mt-auto")}
                        onClick={handleShare}
                    >
                        Condividi la wishlist
                    </button>
                )}
            </div>

            {refLista && refLista.length > 0 ? (
                <>
                    <div className={clsx("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4")}>
                        {refLista.map((item) => (
                            <div key={item.codice_referenza as string} className="border p-4 flex flex-col">
                                <img
                                    src={Array.isArray(item["foto"]) ? item["foto"][0] as string : item["foto"] as string}
                                    alt={item?.descrizione_uno as string || 'Image'}
                                    className="w-full h-80 object-contain mb-2 mx-auto"
                                />
                                <h5 className="font-bold text-lg mb-4">
                                    {item?.descrizione_uno} {item?.descrizione_due} {item?.descrizione_tre} {item?.descrizione_peso}
                                </h5>
                                {!isCondivisa && (
                                    <button
                                        onClick={async () => {
                                            try {
                                                // Aggiorna UI immediatamente per responsività
                                                setRefLista((prev) => prev?.filter((ref) => ref.codice_referenza !== item.codice_referenza) || null);
                                                
                                                // Effettua la rimozione sul server
                                                await ServerCall.post("/deleteWishlistItem", { codice: item.codice_referenza, wishlistId: sessionWishlistId });
                                                
                                                // Emetti evento per notificare altri componenti
                                                const { notifyItemRemoved } = useWishlistEvents();
                                                notifyItemRemoved(item.codice_referenza as string, sessionWishlistId);
                                                
                                                console.log('✅ Item removed from wishlist:', item.codice_referenza);
                                            } catch (error) {
                                                console.error('❌ Errore durante la rimozione:', error);
                                                // In caso di errore, ricarica i dati
                                                if (sessionWishlistId) {
                                                    fetchWishlistData(sessionWishlistId);
                                                }
                                            }
                                        }}
                                        className={clsx(styleWp["wp-btn"], styleWp["wp-btn-sm"], styleWp["wp-btn-outline-danger"], "mt-auto")}
                                    >
                                        Elimina
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </>
            ) : refLista === null ? (
                <div className='flex flex-col items-center justify-center h-full'>
                    <div className="text-center text-blue-500 text-lg mt-10">
                        🔄 Caricamento referenze in corso...
                    </div>
                </div>
            ) : (
                <div className='flex flex-col items-center justify-center h-full'>
                    <div className="text-center text-gray-500 text-lg mt-10">
                        📭 Nessun prodotto trovato nella wishlist.
                    </div>
                    <div className="text-sm text-gray-400 mt-2">
                        {sessionWishlistId ? 
                            `WishlistId: ${sessionWishlistId}` : 
                            'Nessun ID wishlist disponibile'
                        }
                    </div>
                </div>
            )}
        </main>
    );
};

export default WishlistWebpliant;