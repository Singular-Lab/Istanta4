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
    ///
    /// TASK-a77bd7b2: qui anche ordinamento, contatori, pagina e query della merceologia della stessa
    /// pagina, scritti perche' la ricerca giri il meno possibile.
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

        /// L'ordinamento scelto nella pagina: per codice (di norma), codice discendente, recenti o
        /// descrizione.
        public static IQueryable<Articoli> Ordina(edro21_dbContext ctx, IQueryable<Articoli> query, string? ordinamento)
        {
            switch (ordinamento)
            {
                case "codice_desc":
                    return query.OrderByDescending(a => a.Codice);
                case "recenti":
                    return query.OrderByDescending(a => a.DataModifica ?? a.DataInserimento);
                case "descrizione":
                    // RISCRITTO 7/9/2026 come giunzione con la riga base, non come sottoquery.
                    //
                    // Cosa si e visto sui dati veri: articoli.descrizione1..4 sono VUOTE su tutti
                    // e 51 gli articoli del demo, sia su SQL Server sia su PostgreSQL. Il nome del
                    // prodotto sta solo in articoli_descrizioni.descrizione_1 della riga 'base',
                    // quella con area e canale vuoti. Ordinare per articoli.descrizione1 sarebbe
                    // stato istantaneo e SBAGLIATO: avrebbe ordinato per una colonna vuota.
                    //
                    // La forma precedente chiedeva quella descrizione con una sottoquery correlata:
                    // il motore la eseguiva una volta per articolo, 200.051 volte, ~730 ms a volume
                    // pieno, e nessun indice poteva evitarlo. Chiesta come giunzione, il motore
                    // percorre l'indice gia in ordine e si ferma dopo quaranta righe.
                    //
                    // Serve l'indice: articoli_descrizioni (descrizione_1, id_articolo)
                    //                 WHERE area IS NULL AND canale IS NULL     -> ix_ad_ordine
                    //
                    // Nota: la giunzione duplicherebbe un articolo che avesse piu di una riga base.
                    // Verificato sui dati veri: nessun articolo ne ha piu di una.
                    return from a in query
                           join d in ctx.ArticoliDescrizionis.Where(x => x.Area == null && x.Canale == null)
                                on (Int64?)a.Id equals d.IdArticolo
                           orderby d.Descrizione1
                           select a;
                default:
                    return query.OrderBy(a => a.Codice);
            }
        }

        /// TASK-a77bd7b2: i due contatori della testata, quanti articoli trova la ricerca e quanti hanno
        /// una foto, in una query sola: prima erano due, e ognuna rifaceva tutti i filtri.
        public sealed class Conteggi
        {
            public int Totale { get; set; }
            public int ConFoto { get; set; }
        }

        public static IQueryable<Conteggi> QueryConteggi(IQueryable<Articoli> query) =>
            query.GroupBy(a => 1)
                 .Select(g => new Conteggi { Totale = g.Count(), ConFoto = g.Count(a => a.ArticoliFotos!.Any()) });

        public static async Task<Conteggi> ContaAsync(IQueryable<Articoli> query) =>
            await QueryConteggi(query).FirstOrDefaultAsync() ?? new Conteggi();

        /// TASK-a77bd7b2: gli articoli di una pagina. Prima la pagina si chiedeva con le descrizioni e le
        /// foto incluse (AsSplitQuery): le due query delle collezioni ripetevano filtri, ordinamento e
        /// paginazione, e la ricerca girava tre volte. Ora la ricerca trova solo gli id della pagina, e
        /// articoli, descrizioni e foto si leggono per id, nell'ordine della ricerca.
        public static async Task<List<Articoli>> PaginaAsync(edro21_dbContext ctx, IQueryable<Articoli> query, int salta, int quanti)
        {
            var idPagina = await QueryIdPagina(query, salta, quanti).ToListAsync();
            if (idPagina.Count == 0)
            {
                return new List<Articoli>();
            }
            var articoli = await ArticoliConDettagli(ctx, idPagina).ToListAsync();
            return NellOrdineDellaPagina(articoli, idPagina);
        }

        public static IQueryable<long> QueryIdPagina(IQueryable<Articoli> query, int salta, int quanti) =>
            query.Select(a => a.Id).Skip(salta).Take(quanti);

        /// Gli articoli di quegli id con descrizioni e foto. AsSplitQuery aggiunto il 9/9/2026: con due
        /// Include di collezioni EF costruisce una query con due giunzioni, e ogni articolo esce ripetuto
        /// (numero foto x numero descrizioni); con lo split sono tre query piccole, ora tutte per id.
        public static IQueryable<Articoli> ArticoliConDettagli(edro21_dbContext ctx, List<long> id) =>
            ctx.Articolis.Include(a => a.ArticoliFotos)
                .Include(a => a.ArticoliDescrizionis)
                .AsSplitQuery()
                .Where(a => id.Contains(a.Id));

        /// Gli articoli nell'ordine degli id della pagina, che la lettura per id non conserva. Pura.
        public static List<Articoli> NellOrdineDellaPagina(IEnumerable<Articoli> articoli, IList<long> idPagina)
        {
            var posizione = new Dictionary<long, int>();
            for (int i = 0; i < idPagina.Count; i++)
            {
                posizione.TryAdd(idPagina[i], i);
            }
            return articoli.Where(a => posizione.ContainsKey(a.Id)).OrderBy(a => posizione[a.Id]).ToList();
        }

        /// TASK-a77bd7b2: la query della merceologia, codice -> reparto, settore, categoria dall'ultimo
        /// record di lista che cita il codice.
        ///
        /// Su PostgreSQL prima si leggeva il JSON di ogni record di ogni tracciato, quattro volte (IS JSON
        /// e i tre campi), per poi tenere solo l'ultimo di ogni codice. Ora si trova prima l'ultimo record
        /// di ogni codice, senza leggere il JSON, e il JSON si legge solo di quello. Un ultimo record con
        /// un dato che non e' JSON non ricade piu' su quello prima: il dato lo scrive Istanta, sempre JSON.
        ///
        /// CORREZIONE 7/9/2026: la query era scritta solo in T-SQL, che su PostgreSQL falliva in
        /// silenzio; per questo si sceglie in base al motore.
        public static string QueryMerceologia(bool suPostgres) => suPostgres
            ? "SELECT r.codice," +
              "       (r.dato::json ->> 'reparto')   AS reparto," +
              "       (r.dato::json ->> 'settore')   AS settore," +
              "       (r.dato::json ->> 'categoria') AS categoria" +
              "  FROM (SELECT codice, MAX(id) AS id FROM promo_tracciati_records" +
              "         WHERE codice IS NOT NULL AND dato IS NOT NULL GROUP BY codice) ultimo" +
              "  JOIN promo_tracciati_records r ON r.id = ultimo.id" +
              " WHERE r.dato IS JSON"
            : "WITH ultimo AS (" +
              "  SELECT codice," +
              "         JSON_VALUE(CAST(dato AS nvarchar(max)), '$.reparto')   AS reparto," +
              "         JSON_VALUE(CAST(dato AS nvarchar(max)), '$.settore')   AS settore," +
              "         JSON_VALUE(CAST(dato AS nvarchar(max)), '$.categoria') AS categoria," +
              "         ROW_NUMBER() OVER (PARTITION BY codice ORDER BY id DESC) AS rn" +
              "  FROM promo_tracciati_records WHERE codice IS NOT NULL" +
              ") SELECT codice, reparto, settore, categoria FROM ultimo WHERE rn = 1";
    }
}
