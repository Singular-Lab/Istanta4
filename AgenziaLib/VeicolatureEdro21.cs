using AgenziaLib.Tipi;
using System;
using System.Collections.Generic;

namespace AgenziaLib
{
    /// <summary>
    /// TASK-e758bd95: la "veicolatura" dei campi compilati di Edro21, cioe' i campi del record del
    /// tracciato da cui esportaVolantino ed esportaPoP compongono il contenuto. Ogni
    /// assignCompiledField di Edro21.cs passa uno di questi elenchi, secondo l'espressione che usa come
    /// contenuto: il Plugin li mostra con "Mostra etichetta veicolata", con il valore di ogni campo nel
    /// record. I nomi sono quelli del record (Edro21Context.Meta), non quelli delle variabili.
    ///
    /// Un elenco vuoto (TestoFisso) vuol dire che il contenuto e' un testo fisso del box e non viene
    /// dal record; null vuol dire non dichiarato.
    /// </summary>
    public static class VeicolatureEdro21
    {
        static IReadOnlyList<string> Di(params string[] campi) => Array.AsReadOnly(campi);

        /// prezzo_offerta e tutto quello che ne deriva (per etto, "€ x", "a conf. € x", 1 pezzo).
        public static readonly IReadOnlyList<string> PrezzoOfferta = Di(Edro21Context.Meta.prezzo_offerta);

        /// Il prezzo "anziche'" (campo_offerta, campo_offerta_etto).
        public static readonly IReadOnlyList<string> PrezzoAnziche = Di(Edro21Context.Meta.prezzo_anziche);

        /// "a conf. da € anziche' a € offerta".
        public static readonly IReadOnlyList<string> PrezzoAnzicheEOfferta = Di(Edro21Context.Meta.prezzo_anziche, Edro21Context.Meta.prezzo_offerta);

        /// Il prezzo al kg/l in offerta (prezzo_offerta_KgL e la sua forma con "€").
        public static readonly IReadOnlyList<string> PrezzoOffertaKgl = Di(Edro21Context.Meta.prezzo_offerta_kgl);

        /// Il prezzo al kg/l "anziche'" (campo_offerta_ofalkg).
        public static readonly IReadOnlyList<string> PrezzoAnzicheKgl = Di(Edro21Context.Meta.prezzo_anziche_kgl);

        /// "al kg € x" o "per 100 g € x" (campo_offerta_KgL): prezzo al kg/l, unita' di misura e peso,
        /// che decide se si scrive al kg o per 100 g.
        public static readonly IReadOnlyList<string> PrezzoAlKg = Di(Edro21Context.Meta.prezzo_offerta_kgl, GLOBAL_VARIABLES.keyDescrUm, GLOBAL_VARIABLES.keyDescrPeso);

        /// "al kg da € x a € y" (campo_offerta_KgL_sconto): i due prezzi al kg/l, unita' di misura e peso.
        public static readonly IReadOnlyList<string> PrezzoAlKgConSconto = Di(Edro21Context.Meta.prezzo_anziche_kgl, Edro21Context.Meta.prezzo_offerta_kgl,
            GLOBAL_VARIABLES.keyDescrUm, GLOBAL_VARIABLES.keyDescrPeso);

        /// Lo sconto mostrato grande (sconto_effettivo_grande).
        public static readonly IReadOnlyList<string> ScontoAgenzia = Di(Edro21Context.Meta.sconto_agenzia);

        public static readonly IReadOnlyList<string> ScontoMM = Di(Edro21Context.Meta.sconto_MM);

        public static readonly IReadOnlyList<string> ScontoFID = Di(Edro21Context.Meta.sconto_FID);

        public static readonly IReadOnlyList<string> Range1 = Di(Edro21Context.Meta.range_1);

        public static readonly IReadOnlyList<string> Range2 = Di(Edro21Context.Meta.range_2);

        public static readonly IReadOnlyList<string> Punti1 = Di(Edro21Context.Meta.punti_1);

        public static readonly IReadOnlyList<string> Punti2 = Di(Edro21Context.Meta.punti_2);

        /// Il tipo dei punti: dal tipo del record e, quando lo si traduce, dal numero dei punti.
        public static readonly IReadOnlyList<string> TipoPunti1 = Di(Edro21Context.Meta.tipo_punti, Edro21Context.Meta.punti_1);

        public static readonly IReadOnlyList<string> TipoPunti2 = Di(Edro21Context.Meta.tipo_punti, Edro21Context.Meta.punti_2);

        public static readonly IReadOnlyList<string> M_MM = Di(Edro21Context.Meta.M_MM);

        /// "M pezzi € x": quanti pezzi, il prezzo e la grammatura, che dice se si scrive "conf.".
        public static readonly IReadOnlyList<string> PezziMMConPrezzo = Di(Edro21Context.Meta.M_MM, Edro21Context.Meta.prezzo_offerta, Edro21Context.Meta.DescrizioniDescrizione4);

        public static readonly IReadOnlyList<string> PezziFIDConPrezzo = Di(Edro21Context.Meta.M_FID, Edro21Context.Meta.prezzo_offerta, Edro21Context.Meta.DescrizioniDescrizione4);

        /// "1 pezzo"/"1 conf.": dalla grammatura.
        public static readonly IReadOnlyList<string> UnPezzo = Di(Edro21Context.Meta.DescrizioniDescrizione4);

        /// Il prezzo del secondo pezzo: il prezzo in offerta, solo con le meccaniche NM fid.
        public static readonly IReadOnlyList<string> PrezzoSecondoPezzo = Di(Edro21Context.Meta.prezzo_offerta, Edro21Context.Meta.meccanica_origine);

        /// La descrizione del box: le quattro descrizioni e, dove c'e', la dicitura del reparto.
        public static readonly IReadOnlyList<string> Descrizione = Di(Edro21Context.Meta.DescrizioniDescrizione1, Edro21Context.Meta.DescrizioniDescrizione2,
            Edro21Context.Meta.DescrizioniDescrizione3, Edro21Context.Meta.DescrizioniDescrizione4, Edro21Context.Meta.dicitura_reparto);

        /// Un testo fisso del box, che non viene dal record.
        public static readonly IReadOnlyList<string> TestoFisso = Di();

        /// "N pezzi" delle meccaniche bis (PezzConf_NM): N_MM, o N_FID con le meccaniche fid, e la
        /// grammatura; la meccanica assegnata decide quale. Stessa regola del ramo che lo compone.
        public static IReadOnlyList<string> PezziMeccanicaBis(object combinazioneAssegnata)
        {
            string combinazione = combinazioneAssegnata?.ToString() ?? "";
            if (combinazione.IndexOf("NM_", StringComparison.Ordinal) < 0)
            {
                return Di(Edro21Context.Meta.keyCombinazioneAssegnata);
            }
            string pezzi = combinazione.IndexOf("_FID", StringComparison.Ordinal) < 0 ? Edro21Context.Meta.N_MM : Edro21Context.Meta.N_FID;
            return Di(Edro21Context.Meta.keyCombinazioneAssegnata, pezzi, Edro21Context.Meta.DescrizioniDescrizione4);
        }

        /// Lo sconto del PoP: sconto_MM, o sconto_FID con le meccaniche fid. Stessa regola del ramo.
        public static IReadOnlyList<string> ScontoPoP(string combinazioneAssegnata)
        {
            return (combinazioneAssegnata ?? "").ToLower().Contains("_fid") ? ScontoFID : ScontoMM;
        }
    }
}
