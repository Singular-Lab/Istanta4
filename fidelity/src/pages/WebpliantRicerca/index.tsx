import { useQuery } from '@tanstack/react-query';
import React, { useState, useEffect } from 'react';
import { ServerCall } from '../../../lib/server_call';
import { ReferenzeIstanta } from '../../../lib/types';
import { useFetchConfig } from '@/query/query';
import BoxRef from '../WebPliant/BoxRef';
import { useWebpliantParamsManager } from '@/hooks/useWebpliantParamsManager';

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
            <div className=" mx-auto">
                <div className="mb-8 flex flex-col justify-center items-center">
                    <h1 className="text-2xl md:text-3xl font-bold mb-2">Ricerca dei prodotti</h1>
                    <p className="text-gray-600 text-center">
                        Inserisci il nome del prodotto o parte di esso per trovare le referenze disponibili
                    </p>
                </div>
                
                <div className="relative mb-6 max-w-7xl mx-auto flex justify-center items-center">
                    <input
                        type="text"
                        value={searchValue}
                        className="w-full border border-black outline-none focus:border-black focus:ring-0 p-3 md:p-4 rounded-md text-base"
                        placeholder="Cerca..."
                        onChange={(e) => setSearchValue(e.target.value)}
                    />
                    {isLoading && (
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                            <span className="text-gray-500">Loading...</span>
                        </div>
                    )}
                </div>
                
                {debouncedQuery && queryResultRicerca.data?.length === 0 && !isLoading && (
                    <div className="my-6 p-4 bg-gray-50 rounded-md text-center">
                        <p className="text-gray-600">Nessun risultato per "<span className="font-semibold">{debouncedQuery}</span>"</p>
                    </div>
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