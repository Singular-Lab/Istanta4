using Istanta.Models;
using Microsoft.EntityFrameworkCore;

namespace Istanta.Utility
{
    /// TASK-6e4320b7: la ricerca della pagina Archivio senza distinguere maiuscole e minuscole.
    ///
    /// I filtri di testo si scrivevano con string.Contains, che Npgsql traduce in un confronto che
    /// distingue maiuscole e minuscole: "salame" non trovava "SALAME UNGHERESE". Ora sono ILIKE, che
    /// non le distingue, lettere accentate comprese con la lingua del database (en_US.utf8 di
    /// postgres:17), e usa gli stessi indici a trigrammi di LIKE. Il testo dell'operatore resta un
    /// "contiene": % e _ si cercano come tali, come faceva Contains.
    public static class RicercaArchivio
    {
        /// Il carattere di escape del modello, dichiarato nella query (ESCAPE '\').
        public const string Escape = "\\";

        /// Il modello ILIKE per "contiene il testo": %testo%, con \, % e _ protetti, cosi' quello
        /// che l'operatore scrive si cerca alla lettera e non fa da carattere jolly.
        public static string ModelloContiene(string testo)
        {
            var protetto = testo.Replace(Escape, Escape + Escape)
                                .Replace("%", Escape + "%")
                                .Replace("_", Escape + "_");
            return "%" + protetto + "%";
        }

        /// I filtri di testo della pagina Archivio sulla query degli articoli: Codice, Cerca ovunque
        /// (il codice o una delle quattro descrizioni), Nome, Brand, Tipo / Gusto e Grammatura sulle
        /// descrizioni dell'articolo. Un campo vuoto non filtra.
        public static IQueryable<Articoli> FiltraPerTesto(edro21_dbContext ctx, IQueryable<Articoli> query,
            string? codice, string? generico, string? nome, string? brand, string? tipoGusto, string? grammatura)
        {
            if (!string.IsNullOrEmpty(codice))
            {
                var modello = ModelloContiene(codice);
                query = query.Where(a => EF.Functions.ILike(a.Codice, modello, Escape));
            }

            if (!string.IsNullOrEmpty(generico))
            {
                // RISCRITTA 7/9/2026 come unione di due insiemi di id, invece che come OR
                // fra una colonna di 'articoli' e una sottoquery su 'articoli_descrizioni'.
                // Con l'OR il motore non puo usare gli indici: deve valutare la sottoquery
                // riga per riga, 200.051 volte. Misurato su 200.000 articoli:
                //     forma con OR       1,03 s
                //     forma con unione   0,15 s
                // Il risultato e lo stesso insieme di articoli: cambia solo come lo si chiede.
                // Perche l'unione sia veloce servono gli indici a trigrammi (pg_trgm) su
                // articoli.codice e su articoli_descrizioni.descrizione_1..4, che valgono anche per ILIKE.
                var modello = ModelloContiene(generico);
                var idPerCodice = ctx.Articolis
                    .Where(a => EF.Functions.ILike(a.Codice!, modello, Escape))
                    .Select(a => (Int64?)a.Id);

                var idPerDescrizione = ctx.ArticoliDescrizionis
                    .Where(d => EF.Functions.ILike(d.Descrizione1!, modello, Escape) ||
                                EF.Functions.ILike(d.Descrizione2!, modello, Escape) ||
                                EF.Functions.ILike(d.Descrizione3!, modello, Escape) ||
                                EF.Functions.ILike(d.Descrizione4!, modello, Escape))
                    .Select(d => (Int64?)d.IdArticolo);

                var idTrovati = idPerCodice.Union(idPerDescrizione);

                query = query.Where(a => idTrovati.Contains((Int64?)a.Id));
            }

            if (!string.IsNullOrEmpty(nome))
            {
                var modello = ModelloContiene(nome);
                query = query.Where(a => a.ArticoliDescrizionis.Any(d => EF.Functions.ILike(d.Descrizione1!, modello, Escape)));
            }

            if (!string.IsNullOrEmpty(brand))
            {
                var modello = ModelloContiene(brand);
                query = query.Where(a => a.ArticoliDescrizionis.Any(d => EF.Functions.ILike(d.Descrizione2!, modello, Escape)));
            }

            if (!string.IsNullOrEmpty(tipoGusto))
            {
                var modello = ModelloContiene(tipoGusto);
                query = query.Where(a => a.ArticoliDescrizionis.Any(d => EF.Functions.ILike(d.Descrizione3!, modello, Escape)));
            }

            if (!string.IsNullOrEmpty(grammatura))
            {
                var modello = ModelloContiene(grammatura);
                query = query.Where(a => a.ArticoliDescrizionis.Any(d => EF.Functions.ILike(d.Descrizione4!, modello, Escape)));
            }

            return query;
        }
    }
}
