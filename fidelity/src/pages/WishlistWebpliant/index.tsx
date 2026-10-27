import React, { useCallback, useEffect, useState, useMemo } from 'react';
import styleWp from "@/assets/css/webpliant/stylewp.module.scss";
import { ServerCall } from '../../../lib/server_call';
import { DataFields } from '../../../lib/types';
import clsx from 'clsx';
import { useGestioneHeaderWebpliant } from '@/context/GestioneHeaderWebpliant';
import { useNavigate } from 'react-router-dom';
import { useWebpliantParamsManager } from '@/hooks/useWebpliantParamsManager';
import { useWishlistEvents } from '@/utils/wishlistEvents';
import { CaricamentoPubblico, CLASSE_TITOLO_PUBBLICO, ErrorePubblico, VuotoPubblico } from '../WebpliantLayout/StatiPubblici';

const WishlistWebpliant: React.FC = () => {
    const [refLista, setRefLista] = useState<DataFields[] | null>(null);
    const [wishlistLoading, setWishlistLoading] = useState(false);
    const [wishlistError, setWishlistError] = useState<string | null>(null);
    const [linkCopiato, setLinkCopiato] = useState(false);
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
    const { events: wishlistEvents, notifyItemRemoved } = useWishlistEvents();

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
            const refs = await ServerCall.get<DataFields[]>(`/getAllReferenzeFromWishlistId?id=${wishlistId}`);
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
                if (sessionWishlistId) {
                    fetchWishlistData(sessionWishlistId);
                }
            }
        });

        const unsubscribeItemAdded = wishlistEvents.on('item-added', (event) => {
            if (!event.wishlistId || event.wishlistId === sessionWishlistId) {
                if (sessionWishlistId) {
                    fetchWishlistData(sessionWishlistId);
                }
            }
        });

        const unsubscribeItemRemoved = wishlistEvents.on('item-removed', (event) => {
            if (!event.wishlistId || event.wishlistId === sessionWishlistId) {
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
                .catch((error) => console.error('Errore durante la condivisione:', error));
        } else if (navigator.clipboard) {
            navigator.clipboard.writeText(currentUrl)
                .then(() => {
                    // Feedback sul pulsante: i toast globali finirebbero sotto l'header del volantino
                    setLinkCopiato(true);
                    setTimeout(() => setLinkCopiato(false), 2500);
                })
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
            <main className="mt-20 w-full p-5 h-full">
                <CaricamentoPubblico testo="Caricamento wishlist..." />
            </main>
        );
    }

    // Error state (considera sia errori dei parametri che della wishlist)
    if (error || wishlistError) {
        return (
            <main className="mt-20 w-full p-5 h-full">
                <ErrorePubblico
                    titolo="Impossibile caricare la wishlist"
                    messaggio={error || wishlistError}
                    onRiprova={() => window.location.reload()}
                />
            </main>
        );
    }

    return (
        <main className="mt-20 w-full p-5 h-full">
            <h1 className={clsx(CLASSE_TITOLO_PUBBLICO, styleWp["wp-mb-4"])}>
                {isCondivisa ? "Wishlist condivisa" : "La mia wishlist"}
            </h1>

            <div className={clsx('flex flex-row flex-wrap items-center justify-center gap-4 mb-5')}>
                <button
                    type="button"
                    className={clsx(styleWp["wp-btn"], styleWp["wp-btn-primary"])}
                    onClick={handleBackToPromotion}
                    disabled={!isReady}
                >
                    Torna alla promozione
                </button>

                {!isCondivisa && sessionWishlistId && (
                    <button
                        type="button"
                        className={clsx(styleWp["wp-btn"], styleWp["wp-btn-primary"])}
                        onClick={handleShare}
                    >
                        {linkCopiato ? 'Link copiato negli appunti!' : 'Condividi la wishlist'}
                    </button>
                )}
            </div>

            {refLista && refLista.length > 0 ? (
                <>
                    <div className={clsx("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4")}>
                        {refLista.map((item) => (
                            <div key={item.codice_referenza as string} className={clsx(styleWp["wp-card"], "flex flex-col")}>
                                <div className={clsx(styleWp["wp-card-body"], "flex flex-1 flex-col")}>
                                <img
                                    src={Array.isArray(item["foto"]) ? item["foto"][0] as string : item["foto"] as string}
                                    alt={item?.descrizione_uno as string || 'Image'}
                                    className="w-full h-80 object-contain mb-2 mx-auto"
                                />
                                <h5 className={clsx(styleWp["wp-h5"], styleWp["wp-card-title"], styleWp["wp-mb-4"])}>
                                    {item?.descrizione_uno} {item?.descrizione_due} {item?.descrizione_tre} {item?.descrizione_peso}
                                </h5>
                                {!isCondivisa && (
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            try {
                                                // Aggiorna UI immediatamente per responsività
                                                setRefLista((prev) => prev?.filter((ref) => ref.codice_referenza !== item.codice_referenza) || null);
                                                
                                                // Effettua la rimozione sul server
                                                await ServerCall.post("/deleteWishlistItem", { codice: item.codice_referenza, wishlistId: sessionWishlistId });
                                                
                                                // Emetti evento per notificare altri componenti
                                                notifyItemRemoved(item.codice_referenza as string, sessionWishlistId);
                                                
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
                            </div>
                        ))}
                    </div>
                </>
            ) : refLista === null && sessionWishlistId ? (
                <CaricamentoPubblico testo="Caricamento prodotti in corso..." />
            ) : (
                <VuotoPubblico
                    titolo="Nessun prodotto nella wishlist"
                    descrizione="Aggiungi i prodotti dal volantino per ritrovarli qui."
                />
            )}
        </main>
    );
};

export default WishlistWebpliant;