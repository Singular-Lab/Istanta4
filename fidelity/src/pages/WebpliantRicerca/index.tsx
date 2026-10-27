import { useQuery } from '@tanstack/react-query';
import React, { useState, useEffect } from 'react';
import { ServerCall } from '../../../lib/server_call';
import { ReferenzeIstanta } from '../../../lib/types';
import { useFetchConfig } from '@/query/query';
import BoxRef from '../WebPliant/BoxRef';
import { useWebpliantParamsManager } from '@/hooks/useWebpliantParamsManager';
import styleWp from "@/assets/css/webpliant/stylewp.module.scss";
import clsx from 'clsx';
import {
    CaricamentoPubblico,
    CLASSE_CAMPO_PUBBLICO,
    CLASSE_TITOLO_PUBBLICO,
    ErrorePubblico,
    VuotoPubblico,
} from '../WebpliantLayout/StatiPubblici';

const WebpliantRicerca: React.FC = () => {
    const config = useFetchConfig();
    
    // Get initial query from URL
    const [searchValue, setSearchValue] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    
    // Usa il nuovo sistema centralizzato per i parametri
    const {
        idArea,
        idCanale,
        idGDO,
        idPV,
        idWorkspace,
    } = useWebpliantParamsManager();

    // Initialize from URL on component mount
    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search);
        const initialQuery = searchParams.get('query') || '';
        setSearchValue(initialQuery);
        setDebouncedQuery(initialQuery);
    }, []);
    
    // Debounce search query to prevent too many API calls
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(searchValue);
            
            // Update URL with current search value
            const newSearchParams = new URLSearchParams(window.location.search);
            if (searchValue) {
                newSearchParams.set('query', searchValue);
            } else {
                newSearchParams.delete('query');
            }
            
            const newUrl = `${window.location.pathname}${newSearchParams.toString() ? `?${newSearchParams.toString()}` : ''}`;
            window.history.replaceState(null, '', newUrl);
            
        }, 500); // 500ms debounce
        
        return () => clearTimeout(timer);
    }, [searchValue]);
    
    const queryResultRicerca = useQuery({
        queryKey: ['ricercaReferenzePromo', debouncedQuery],
        queryFn: async () => {
            if (debouncedQuery) {
                const res = await ServerCall.post<Array<{ score: number, ref: ReferenzeIstanta }>>(
                    '/ricercaReferenzePromo', 
                    { 
                        query: debouncedQuery, 
                        idWorkspace, 
                        idArea, 
                        idCanale, 
                        idGDO, 
                        idPV 
                    }
                );
                return res;
            }
            return [];
        },
        enabled: debouncedQuery.length > 0,
    });
    
    // Show loading state
    const isLoading = debouncedQuery.length > 0 && queryResultRicerca.isLoading;
    
    return (
        <main className="w-full mt-20 min-h-screen bg-white px-4 py-6 md:px-6 md:py-8 lg:px-8">
            <div className="mx-auto">
                <div className="mb-8 flex flex-col justify-center items-center">
                    <h1 className={clsx(CLASSE_TITOLO_PUBBLICO, styleWp["wp-mb-2"])}>Ricerca dei prodotti</h1>
                    <p className={clsx(styleWp["wp-text-muted"], styleWp["wp-text-center"], styleWp["wp-mb-0"])}>
                        Inserisci il nome del prodotto o parte di esso per trovare le referenze disponibili
                    </p>
                </div>

                <div className="mb-6 max-w-7xl mx-auto">
                    <input
                        type="search"
                        aria-label="Cerca prodotti"
                        value={searchValue}
                        className={CLASSE_CAMPO_PUBBLICO}
                        placeholder="Cerca..."
                        onChange={(e) => setSearchValue(e.target.value)}
                    />
                </div>

                {isLoading && <CaricamentoPubblico testo="Ricerca in corso..." />}

                {debouncedQuery && queryResultRicerca.isError && !isLoading && (
                    <ErrorePubblico
                        titolo="Ricerca non riuscita"
                        messaggio={queryResultRicerca.error instanceof Error ? queryResultRicerca.error.message : "Riprova tra qualche istante."}
                        onRiprova={() => queryResultRicerca.refetch()}
                        etichettaRiprova="Riprova"
                    />
                )}

                {debouncedQuery && queryResultRicerca.data?.length === 0 && !isLoading && (
                    <VuotoPubblico
                        titolo={`Nessun risultato per "${debouncedQuery}"`}
                        descrizione="Prova con un altro nome o con una parte di esso."
                    />
                )}

                <div className="my-10 p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4 lg:gap-5">
                    {queryResultRicerca.data
                        ?.sort((a, b) => b.score - a.score)
                        .map((item, index) => {
                            if (!config.data) {
                                return null;
                            }
                            return (
                                <div key={index} className="flex justify-center">
                                    <BoxRef referenza={item.ref} config={config.data} />
                                </div>
                            );
                        })}
                </div>
            </div>
        </main>
    );
};

export default WebpliantRicerca;