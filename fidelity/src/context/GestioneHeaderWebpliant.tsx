import React, { createContext, useContext, useState, ReactNode } from 'react';
import { TIPO_PAGINA } from '../../lib/enums';

interface GestioneHeaderWebpliantContextProps {
    oggettoHeaderWebpliant: {
        showLogo?: boolean;
        showListaPagine?: boolean;
        showPuntiVendita?: boolean;
        showWishlist?: boolean;
    };
    setOggettoHeaderWebpliant: (title: {
        showLogo?: boolean;
        showListaPagine?: boolean;
        showPuntiVendita?: boolean;
        showWishlist?: boolean;
    }) => void;
}

const GestioneHeaderWebpliantContext = createContext<GestioneHeaderWebpliantContextProps | undefined>(undefined);

export const GestioneHeaderWebpliantProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [oggettoHeaderWebpliant, setOggettoHeaderWebpliant] = useState<{
        showLogo?: boolean;
        showListaPagine?: boolean;
        showPuntiVendita?: boolean;
        showWishlist?: boolean;
    }>({
        showLogo: true,
        showListaPagine: true,
        showPuntiVendita: true,
        showWishlist: true,
    });

    return (
        <GestioneHeaderWebpliantContext.Provider value={{ oggettoHeaderWebpliant, setOggettoHeaderWebpliant }}>
            {children}
        </GestioneHeaderWebpliantContext.Provider>
    );
};

export const useGestioneHeaderWebpliant = (): GestioneHeaderWebpliantContextProps => {
    const context = useContext(GestioneHeaderWebpliantContext);
    if (!context) {
        throw new Error('useGestioneHeaderWebpliant must be used within a GestioneHeaderWebpliantProvider');
    }
    return context;
};