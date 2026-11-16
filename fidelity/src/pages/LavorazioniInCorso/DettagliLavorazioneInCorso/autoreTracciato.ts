import type { TracciatiResponseDTO } from "../../../../server/core/dto";

// Autore e date nella scheda del tracciato (spec ciclo-promozione-importazione, "Autore e date del tracciato")

/** Chi ha caricato il tracciato, come lo legge l'operatore. */
export const descriviAutore = (caricatoDa: TracciatiResponseDTO["caricatoDa"]): string =>
    !caricatoDa ? "Autore non registrato" : caricatoDa.nome ? `Caricato da ${caricatoDa.nome}` : "Caricato da un utente non più presente";

/** L'aggiornamento si mostra solo se e' di un altro minuto rispetto al caricamento: la scheda mostra l'ora al minuto. */
export const aggiornatoDopoIlCaricamento = (creato?: Date | string | null, aggiornato?: Date | string | null): boolean => {
    if (!creato || !aggiornato) return false;
    const inizio = new Date(creato).getTime();
    const fine = new Date(aggiornato).getTime();
    return Number.isFinite(inizio) && Number.isFinite(fine) && Math.floor(fine / 60_000) > Math.floor(inizio / 60_000);
};
