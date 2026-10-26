import i18n, { ModuleType } from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import { ServerCall } from "../lib/server_call";

class CustomBackend {
    static type: ModuleType = "backend";
    services: any;
    options: any;

    constructor(services: any, options: any = {}, i18nextOptions: any = {}) {
        this.init(services, options, i18nextOptions);
    }

    init(services: any, options: any = {}, i18nextOptions: any = {}) {
        this.services = services;
        this.options = options;
    }

    // Questo metodo viene chiamato da i18next per caricare le traduzioni.
    // 'language' è il codice della lingua (es. "en"), 'namespace' il namespace (es. "common")
    read(language: string, namespace: string, callback: (error: any, data: any) => void) {
        // Ad esempio, puoi effettuare una chiamata fetch al tuo endpoint API
        // che restituisce le traduzioni dal database.
        ServerCall.get<any>(`/t?lng=${language}&ns=${namespace}`)
            .then(data => {
                if (typeof data === 'string') {
                    data = JSON.parse(data);
                }
                callback(null, data);
            })
            .catch(error => {
                callback(error, false);
            });
    }
}



i18n
    .use(LanguageDetector)
    .use(CustomBackend)
    .use(initReactI18next)
    .init({
        fallbackLng: "it-IT",
        debug: false,
        load: "languageOnly",
        interpolation: {
            escapeValue: false,
        },
        // Puoi anche passare opzioni specifiche al tuo backend se necessario
        backend: {
            // Ad esempio, se vuoi passare opzioni extra, oppure lasciare vuoto se gestisci tutto nel metodo read
        },
        showSupportNotice:false,
        defaultNS: 'translation',
        nonExplicitSupportedLngs: true, // <-- Aggiunto qui
        supportedLngs: ['it', 'en']   // <-- Aggiunto qui
    });
export default i18n;
