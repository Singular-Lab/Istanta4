import React, { useEffect } from 'react';
import { Colorize } from '../../../lib/Colorize';
import { ServerCall } from '../../../lib/server_call';

const WebPliantStyleManager: React.FC = () => {
    useEffect(() => {
        const styleId = 'webpliant-styles';

        const loadStyles = async () => {
            const existingStyle = document.getElementById(styleId);

            // Se il tag <style> esiste già, rimuovilo
            if (existingStyle) {
                console.log(Colorize.bgGreen('Stili trovati, rimuovendo...'));
                existingStyle.remove();
            }

            // Crea un nuovo tag <style>
            const style = document.createElement('style');
            style.id = styleId; // Assegna un ID al tag <style>
            document.head.appendChild(style);

            let stylesContent = '';

            try {
                // Carica CSS dal server
                const cssServerCall = await ServerCall.get<string>('/getStiliToText');
                stylesContent += cssServerCall;
            } catch (error) {
                console.error('Errore durante il caricamento dei CSS dal server:', error);
            }

            try {
                // Carica CSS locale
               
            } catch (error) {
                console.error('Errore durante il caricamento dei CSS locali:', error);
            }

            // Applica lo stile al documento
            style.innerHTML = stylesContent;
        };

        loadStyles();

        return () => {
            console.log(Colorize.bgYellow('Rimuovendo il tag <style>...'));
            const styleToRemove = document.getElementById(styleId);
            if (styleToRemove) {
                styleToRemove.remove();
                console.log(Colorize.bgGreen('Tag <style> rimosso con successo.'));
            } else {
                console.warn('Tag <style> non trovato durante la rimozione.');
            }
        };
    }, []);

    return null;
};

export default WebPliantStyleManager;
