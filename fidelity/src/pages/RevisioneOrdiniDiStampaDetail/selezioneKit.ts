// Selezione da inviare: solo i kit ancora disponibili, compresi quelli nascosti dalla ricerca.
export const selezioneDaInviare = (
  kitDisponibili: { guidId: string }[],
  selezionati: Record<string, boolean>
): Record<string, boolean> =>
  Object.fromEntries(kitDisponibili.map((kit) => [kit.guidId, !!selezionati[kit.guidId]]));

export const contaSelezionati = (selezione: Record<string, boolean>) =>
  Object.values(selezione).filter(Boolean).length;
