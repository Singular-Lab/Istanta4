import { useState } from "react";

/**
 * Bozza locale di una sezione, a partire dal valore salvato. Quando il valore salvato cambia (dopo il
 * salvataggio della sezione, o un nuovo caricamento) la bozza riparte da lì; le altre sezioni non la
 * toccano, perché il confronto è sul contenuto e non sul riferimento.
 */
export function useBozza<T>(salvato: T) {
  const chiave = JSON.stringify(salvato);
  const [bozza, setBozza] = useState<T>(salvato);
  const [chiaveVista, setChiaveVista] = useState(chiave);
  if (chiave !== chiaveVista) {
    setChiaveVista(chiave);
    setBozza(salvato);
  }
  const modificata = JSON.stringify(bozza) !== chiave;
  return { bozza, setBozza, modificata, annulla: () => setBozza(salvato) } as const;
}
