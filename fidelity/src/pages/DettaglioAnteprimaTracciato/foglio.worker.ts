import { MessaggioDalMotore, MessaggioVersoMotore, MotoreFoglio } from "./motoreFoglio";

// Web Worker dell'anteprima tracciato: collega i messaggi della pagina al motore del foglio.
const ambito = self as unknown as DedicatedWorkerGlobalScope;

const pianifica = (cb: () => void) => {
    if (typeof ambito.requestAnimationFrame === "function") ambito.requestAnimationFrame(() => cb());
    else setTimeout(cb, 16);
};

const motore = new MotoreFoglio({
    invia: (messaggio: MessaggioDalMotore) => ambito.postMessage(messaggio),
    pianifica,
});

ambito.onmessage = (evento: MessageEvent<MessaggioVersoMotore>) => motore.gestisci(evento.data);
