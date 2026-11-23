import { useEffect, useRef } from "react";
import SimpleBar from "simplebar";

/**
 * Barra di scorrimento SimpleBar sull'elemento a cui si collega il ref restituito.
 *
 * L'istanza nasce una sola volta, al montaggio, e viene smontata con il componente.
 * Crearne una nuova a ogni render o cambio di pagina, senza smontare la precedente,
 * accumula istanze sullo stesso elemento e con loro i listener sul mouse: il menu
 * diventa sempre più lento al passaggio del puntatore, fino al ricaricamento.
 * Dopo il montaggio la barra si ridimensiona da sola quando il contenuto cambia.
 */
export function useSimpleBar<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const elemento = ref.current;
    if (!elemento) {
      return;
    }
    const barra = new SimpleBar(elemento);
    return () => barra.unMount();
  }, []);

  return ref;
}
