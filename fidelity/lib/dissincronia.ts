/**
 * In development, se Istanta non risponde, il server salva solo in FP e lo dice con questo
 * header (vedi server/core/utils/istanta.ts). ServerCall lo trasforma in un evento del browser,
 * che l'interfaccia mostra come avviso di dissincronia.
 */
export const HEADER_DISSINCRONIA = "X-Istanta-Dissincronia";
export const EVENTO_DISSINCRONIA = "istanta-dissincronia";

/** Emette EVENTO_DISSINCRONIA (detail: l'operazione di Istanta) se la risposta porta l'header. */
export function segnalaDissincronia(
  response: Pick<Response, "headers">,
  // Nel browser e window; lib/ si compila anche per il server, che non ha i tipi del DOM
  bersaglio: EventTarget | undefined = typeof (globalThis as Partial<EventTarget>).dispatchEvent === "function"
    ? (globalThis as unknown as EventTarget)
    : undefined
): void {
  const operazione = response.headers?.get?.(HEADER_DISSINCRONIA);
  if (operazione && bersaglio) bersaglio.dispatchEvent(new CustomEvent(EVENTO_DISSINCRONIA, { detail: operazione }));
}
