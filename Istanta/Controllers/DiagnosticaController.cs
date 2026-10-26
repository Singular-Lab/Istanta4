using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Istanta.Models;
using Istanta.Utility;
using Istanta.Models_2;

namespace Istanta.Controllers
{
    // +--- SOLO PER LE PROVE ------------------------------------------------------
    // Questo controller non fa parte dell'applicazione: e uno strumento di misura
    // aggiunto durante il porting (settembre 2026).
    //   /Diagnostica/Propaga   fa partire a mano il motore di propagazione
    //   /Diagnostica/Ctx2      verifica che la fabbrica del secondo contesto funzioni
    //   /Diagnostica/Archivio  rimisura i tempi dell'Archivio a volume pieno
    // Richiede una sessione come tutto il resto: l'esenzione dal filtro di
    // autenticazione che avevo messo il 7/9 e stata tolta il 9/9.
    // Si puo cancellare senza conseguenze: nessun'altra parte del codice lo chiama.
    // +---------------------------------------------------------------------------
    // Aggiunto per la prova di migrazione a PostgreSQL: fa partire a mano il motore
    // di propagazione, che nel codice non viene invocato da nessuno.
    public class DiagnosticaController : Controller
    {
        private readonly IConfiguration _config;
        private readonly IOptions<PathExternal> _ext;
        private readonly IOptions<FicoConfig> _fico;
        private readonly IDbContextFactory<edro21_dbContext> _factory;

        private readonly IDbContextFactory<Edro21_DbContext2> _dbContextFactory2;
        public DiagnosticaController(IConfiguration configuration,
                                     IOptions<PathExternal> ext,
                                     IOptions<FicoConfig> fico,
                                     IDbContextFactory<edro21_dbContext> factory, IDbContextFactory<Edro21_DbContext2> dbContextFactory2)
        {
            this._dbContextFactory2 = dbContextFactory2;
            _config = configuration; _ext = ext; _fico = fico; _factory = factory;
        }

        [Route("Diagnostica/Propaga")]
        public IActionResult Propaga()
        {
            Console.WriteLine(">>>> DIAGNOSTICA: costruisco il Propagatore");
            var p = new Propagatore(
                _config.GetConnectionString("IstandaConnectionDb")!,
                _ext.Value.pathLib, _ext.Value.pathSource,
                _fico.Value.nomeCliente, _factory, dbContextFactory2: this._dbContextFactory2);
            Console.WriteLine(">>>> DIAGNOSTICA: chiamo ElaboraRegistro");
            p.ElaboraRegistro();
            Console.WriteLine(">>>> DIAGNOSTICA: ritornato dal metodo (e async void)");
            return Content("propagatore avviato");
        }

        // Prova aggiunta il 7/9/2026 per verificare la dependency injection del secondo
        // contesto: se questa pagina risponde con dei numeri, IDbContextFactory<Edro21_DbContext2>
        // e registrata correttamente e le query passano davvero da PostgreSQL.
        [Route("Diagnostica/Ctx2")]
        public IActionResult Ctx2()
        {
            var r = new System.Text.StringBuilder();
            using (var c2 = _dbContextFactory2.CreateDbContext())
            {
                r.AppendLine("contesto 2 (Edro21_DbContext2), dalla fabbrica");
                r.AppendLine("  provider          " + c2.Database.ProviderName);
                r.AppendLine("  promo             " + c2.Promos.Count());
                r.AppendLine("  promo_tracciati   " + c2.PromoTracciatis.Count());
                r.AppendLine("  tracciati_records " + c2.PromoTracciatiRecords.Count());
                r.AppendLine("  schema_custom     " + c2.SchemaCustoms.Count());
                r.AppendLine("  menabo_pagine     " + c2.MenaboPagines.Count());
                r.AppendLine("  lavorazioni       " + c2.PromoLavorazionis.Count());
            }
            using (var c1 = _factory.CreateDbContext())
            {
                r.AppendLine("contesto 1 (edro21_dbContext), dalla fabbrica");
                r.AppendLine("  provider          " + c1.Database.ProviderName);
                r.AppendLine("  utenti            " + c1.Utentis.Count());
                r.AppendLine("  articoli          " + c1.Articolis.Count());
            }
            return Content(r.ToString());
        }


        // Misura dei tempi dell'Archivio a volume pieno (Fase 5, 7/9/2026).
        // Riproduce pezzo per pezzo quello che fa ArchivioController.eseguiRicerca,
        // per capire quale parte costa e quali indici servono. Solo per la prova.
        [Route("Diagnostica/Archivio")]
        public async Task<IActionResult> ArchivioTempi()
        {
            var r = new System.Text.StringBuilder();
            using var c = _factory.CreateDbContext();
            c.Database.SetCommandTimeout(120);

            async Task Misura(string nome, Func<Task<string>> f)
            {
                var sw = System.Diagnostics.Stopwatch.StartNew();
                try
                {
                    var esito = await f();
                    sw.Stop();
                    r.AppendLine(string.Format("  {0,-44} {1,8} ms   {2}", nome, sw.ElapsedMilliseconds, esito));
                }
                catch (Exception ex)
                {
                    sw.Stop();
                    r.AppendLine(string.Format("  {0,-44} {1,8} ms   NON RIUSCITA: {2}: {3}{4}", nome, sw.ElapsedMilliseconds,
                        ex.GetType().Name, ex.Message.Replace("\r"," ").Replace("\n"," "),
                        ex.InnerException == null ? "" : "  ||  " + ex.InnerException.Message.Replace("\r"," ").Replace("\n"," ")));
                }
            }

            IQueryable<Istanta.Models.Articoli> Base() =>
                c.Articolis.Include(a => a.ArticoliFotos)
                           .Include(a => a.ArticoliDescrizionis)
                           .Where(a => a.ArticoliDescrizionis.Any());

            IQueryable<Istanta.Models.Articoli> Generica(string testo)
            {
                var perCodice = c.Articolis.Where(a => a.Codice.Contains(testo)).Select(a => (Int64?)a.Id);
                var perDescr  = c.ArticoliDescrizionis
                    .Where(d => d.Descrizione1!.Contains(testo) || d.Descrizione2!.Contains(testo) ||
                                d.Descrizione3!.Contains(testo) || d.Descrizione4!.Contains(testo))
                    .Select(d => (Int64?)d.IdArticolo);
                var ids = perCodice.Union(perDescr);
                return Base().Where(a => ids.Contains((Int64?)a.Id));
            }

            r.AppendLine("Archivio a volume pieno — tempi misurati dall'applicazione");
            r.AppendLine();

            await Misura("A. conteggio totale articoli", async () =>
                (await c.Articolis.CountAsync()).ToString() + " articoli");

            await Misura("B. conteggio del risultato (con descrizioni)", async () =>
                (await Base().CountAsync()).ToString() + " articoli");

            await Misura("C. contatore KPI 'con foto'", async () =>
                (await Base().CountAsync(a => a.ArticoliFotos.Any())).ToString() + " articoli");

            await Misura("D. pagina 1, ordine per codice", async () =>
                (await Base().OrderBy(a => a.Codice).Skip(0).Take(40).ToListAsync()).Count + " righe");

            await Misura("E. pagina 2500, ordine per codice", async () =>
                (await Base().OrderBy(a => a.Codice).Skip(99960).Take(40).ToListAsync()).Count + " righe");

            await Misura("F. pagina 1, ordine 'piu recenti'", async () =>
                (await Base().OrderByDescending(a => a.DataModifica ?? a.DataInserimento)
                             .Skip(0).Take(40).ToListAsync()).Count + " righe");

            await Misura("G. pagina 1, ordine per descrizione", async () =>
                (await (from a in Base()
                        join d in c.ArticoliDescrizionis.Where(x => x.Area == null && x.Canale == null)
                             on (Int64?)a.Id equals d.IdArticolo
                        orderby d.Descrizione1
                        select a).Skip(0).Take(40).ToListAsync()).Count + " righe");

            await Misura("H. ricerca per codice, conteggio", async () =>
                (await Base().Where(a => a.Codice.Contains("300123")).CountAsync()).ToString() + " articoli");

            await Misura("I. ricerca per codice, prima pagina", async () =>
                (await Base().Where(a => a.Codice.Contains("300123"))
                             .OrderBy(a => a.Codice).Take(40).ToListAsync()).Count + " righe");

            await Misura("L. ricerca generica 'BARILLA', conteggio", async () =>
                (await Base().Where(a => a.Codice.Contains("BARILLA") ||
                                    a.ArticoliDescrizionis.Any(d =>
                                        d.Descrizione1!.Contains("BARILLA") ||
                                        d.Descrizione2!.Contains("BARILLA") ||
                                        d.Descrizione3!.Contains("BARILLA") ||
                                        d.Descrizione4!.Contains("BARILLA")))
                             .CountAsync()).ToString() + " articoli");

            await Misura("M. ricerca generica 'BARILLA', prima pagina", async () =>
                (await Base().Where(a => a.Codice.Contains("BARILLA") ||
                                    a.ArticoliDescrizionis.Any(d =>
                                        d.Descrizione1!.Contains("BARILLA") ||
                                        d.Descrizione2!.Contains("BARILLA") ||
                                        d.Descrizione3!.Contains("BARILLA") ||
                                        d.Descrizione4!.Contains("BARILLA")))
                             .OrderBy(a => a.Codice).Take(40).ToListAsync()).Count + " righe");

            await Misura("N. nome esatto in descrizione_1, conteggio", async () =>
                (await Base().Where(a => a.ArticoliDescrizionis.Any(d => d.Descrizione1!.Contains("MOZZARELLA")))
                             .CountAsync()).ToString() + " articoli");

            await Misura("L2. ricerca generica come unione, conteggio", async () =>
                (await Generica("BARILLA").CountAsync()).ToString() + " articoli");

            await Misura("M2. ricerca generica come unione, prima pagina", async () =>
                (await Generica("BARILLA").OrderBy(a => a.Codice).Take(40).ToListAsync()).Count + " righe");

            r.AppendLine();
            r.AppendLine("Una apertura dell'Archivio esegue A + B + C + D: la somma di quelle quattro.");
            return Content(r.ToString());
        }

    }
}
