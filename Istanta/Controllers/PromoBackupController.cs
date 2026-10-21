using Istanta.Models;
using Istanta.Models_2;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Istanta.Controllers
{
    /// <summary>
    /// I20-1106 (Lotto 1): la pagina Backup promo del menu Confronti (indirizzo /PromoBackup: una cartella
    /// Views/BackupPromo sarebbe ignorata da git, regola **/[Bb]ackup*/ del .gitignore). L'operatore sceglie una
    /// promo, fa il backup dei suoi record dei tracciati o di quelli delle lavorazioni e, da un
    /// backup dell'elenco, ripristina. Le decisioni stanno in Models/BackupPromo.cs: qui si legge,
    /// si applica il piano e si salva, dentro una transazione.
    /// </summary>
    public class PromoBackupController : Controller
    {
        private readonly ILogger<PromoBackupController> _logger;
        private readonly Edro21_DbContext2 ctx2;

        public PromoBackupController(ILogger<PromoBackupController> logger, IDbContextFactory<Edro21_DbContext2> dbContextFactory2)
        {
            _logger = logger;
            ctx2 = dbContextFactory2.CreateDbContext();
        }

        public IActionResult Index()
        {
            return View();
        }

        [HttpGet]
        [Route("PromoBackup/lista/{idPromo}")]
        public async Task<IActionResult> lista(int idPromo)
        {
            var risposta = new ElencoBackupPromoRisposta();
            try
            {
                // Senza il contenuto: puo' pesare molti MB per backup, e all'elenco non serve.
                var righe = await ctx2.PromoBackups
                    .Where(b => b.IdPromo == idPromo)
                    .Select(b => new { b.Id, b.IdPromo, b.Tipo, b.DataBackup, b.Origine, b.Conteggio })
                    .ToListAsync();

                risposta.backups = BackupPromo.Elenco(righe.Select(r => new PromoBackup
                {
                    Id = r.Id,
                    IdPromo = r.IdPromo,
                    Tipo = r.Tipo,
                    DataBackup = r.DataBackup,
                    Origine = r.Origine,
                    Conteggio = r.Conteggio,
                    Contenuto = string.Empty
                }));
                risposta.esito = true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Elenco dei backup della promo {IdPromo} non letto", idPromo);
                risposta.error = ex.Message;
            }
            return Ok(risposta);
        }

        [HttpPut]
        [Route("PromoBackup/crea")]
        public async Task<IActionResult> crea([FromBody] RichiestaBackupPromo req)
        {
            var risposta = new BackupPromoRisposta();
            try
            {
                if (req == null)
                {
                    throw new Exception("parametro_null");
                }

                var promo = await ctx2.Promos.FirstOrDefaultAsync(p => p.Id == req.idPromo)
                    ?? throw new Exception("promo_non_trovata");

                var backup = await CreaBackup(promo, (TipoBackupPromo)req.tipo, BackupPromo.ORIGINE_OPERATORE);
                ctx2.PromoBackups.Add(backup);
                await ctx2.SaveChangesAsync();

                risposta.backup = BackupPromo.Info(backup);
                risposta.esito = true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Backup della promo non riuscito");
                risposta.error = ex.Message;
            }
            return Ok(risposta);
        }

        [HttpPut]
        [Route("PromoBackup/ripristina")]
        public async Task<IActionResult> ripristina([FromBody] RichiestaRipristinoPromo req)
        {
            var risposta = new RipristinoPromoRisposta();
            try
            {
                if (req == null)
                {
                    throw new Exception("parametro_null");
                }

                var backup = await ctx2.PromoBackups.FirstOrDefaultAsync(b => b.Id == req.idBackup)
                    ?? throw new Exception("backup_non_trovato");
                var promo = await ctx2.Promos.FirstOrDefaultAsync(p => p.Id == backup.IdPromo)
                    ?? throw new Exception("promo_non_trovata");
                var tipo = (TipoBackupPromo)backup.Tipo;

                // Tutto o niente: il backup di sicurezza, le righe e la sequenza, oppure nulla.
                using var tx = await ctx2.Database.BeginTransactionAsync();

                var sicurezza = await CreaBackup(promo, tipo, BackupPromo.ORIGINE_PRE_RIPRISTINO);
                ctx2.PromoBackups.Add(sicurezza);

                string tabella;
                int inseriti;
                switch (tipo)
                {
                    case TipoBackupPromo.TracciatiRecords:
                        inseriti = await RipristinaTracciati(backup, promo, risposta);
                        tabella = BackupPromo.TABELLA_TRACCIATI_RECORDS;
                        break;
                    case TipoBackupPromo.LavorazioniRecords:
                        inseriti = await RipristinaLavorazioni(backup, promo, risposta);
                        tabella = BackupPromo.TABELLA_LAVORAZIONI_RECORDS;
                        break;
                    default:
                        throw new Exception("tipo_backup_sconosciuto");
                }

                await ctx2.SaveChangesAsync();
                if (inseriti > 0)
                {
                    // Le righe reinserite portano il loro Id: la sequenza non e' avanzata per loro.
                    await ctx2.Database.ExecuteSqlRawAsync(BackupPromo.SqlRiallineaSequenza(tabella));
                }
                await tx.CommitAsync();

                risposta.idBackupSicurezza = sicurezza.Id;
                risposta.esito = true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ripristino del backup non riuscito");
                risposta.error = ex.Message;
            }
            return Ok(risposta);
        }

        /// <summary>
        /// Non e' nella issue: senza, i backup si accumulano senza rimedio, e per una promo
        /// grande ognuno pesa qualche MB.
        /// </summary>
        [HttpDelete]
        [Route("PromoBackup/elimina/{idBackup}")]
        public async Task<IActionResult> elimina(int idBackup)
        {
            var risposta = new BackupPromoRisposta();
            try
            {
                // ExecuteDelete: non si carica il contenuto per buttarlo via.
                int rimossi = await ctx2.PromoBackups.Where(b => b.Id == idBackup).ExecuteDeleteAsync();
                if (rimossi == 0)
                {
                    throw new Exception("backup_non_trovato");
                }
                risposta.esito = true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Eliminazione del backup {IdBackup} non riuscita", idBackup);
                risposta.error = ex.Message;
            }
            return Ok(risposta);
        }

        private async Task<PromoBackup> CreaBackup(Promo promo, TipoBackupPromo tipo, string origine)
        {
            switch (tipo)
            {
                case TipoBackupPromo.TracciatiRecords:
                    return BackupPromo.CreaTracciati(promo.Id, origine, await RecordDeiTracciati(promo).AsNoTracking().ToListAsync(), DateTime.Now);
                case TipoBackupPromo.LavorazioniRecords:
                    return BackupPromo.CreaLavorazioni(promo.Id, origine, await RecordDelleLavorazioni(promo).AsNoTracking().ToListAsync(), DateTime.Now);
                default:
                    throw new Exception("tipo_backup_sconosciuto");
            }
        }

        private IQueryable<PromoTracciatiRecord> RecordDeiTracciati(Promo promo)
        {
            return ctx2.PromoTracciatiRecords.Where(r => r.IdTracciatoNavigation.IdPromo == promo.Id);
        }

        /// <summary>Le lavorazioni non hanno una chiave esterna verso la promo: il legame e' GuidPromo.</summary>
        private IQueryable<PromoLavorazioniRecord> RecordDelleLavorazioni(Promo promo)
        {
            string guid = promo.guidID ?? string.Empty;
            return ctx2.PromoLavorazioniRecords.Where(r => r.IdPromoLavorazioniNavigation.GuidPromo == guid);
        }

        /// <summary>Applica il piano ai record dei tracciati. Torna quante righe ha reinserito.</summary>
        private async Task<int> RipristinaTracciati(PromoBackup backup, Promo promo, RipristinoPromoRisposta risposta)
        {
            var righe = BackupPromo.LeggiTracciati(backup);
            var correnti = await RecordDeiTracciati(promo).ToListAsync();
            var idCorrenti = correnti.Select(r => r.Id).ToList();

            // Cio' che riferisce un record lo blocca: il database rifiuterebbe comunque la rimozione.
            var bloccati = new Dictionary<long, string>();
            var impaginati = await ctx2.PromoLavorazioniRecords
                .Where(l => idCorrenti.Contains(l.IdRecordTracciato))
                .Select(l => l.IdRecordTracciato)
                .Distinct()
                .ToListAsync();
            foreach (var id in impaginati)
            {
                bloccati[id] = BackupPromo.MOTIVO_IMPAGINATO;
            }
            var nelMenabo = await ctx2.MenaboRefs
                .Where(m => m.IdRecord != null && idCorrenti.Contains(m.IdRecord.Value))
                .Select(m => m.IdRecord!.Value)
                .Distinct()
                .ToListAsync();
            foreach (var id in nelMenabo)
            {
                bloccati.TryAdd(id, BackupPromo.MOTIVO_NEL_MENABO);
            }

            var tracciati = (await ctx2.PromoTracciatis.Where(t => t.IdPromo == promo.Id).Select(t => t.Id).ToListAsync()).ToHashSet();

            var piano = BackupPromo.PianificaRipristinoTracciati(righe, correnti, bloccati, tracciati);
            var perId = correnti.ToDictionary(r => r.Id);
            foreach (var riga in piano.daAggiornare)
            {
                riga.ApplicaA(perId[riga.Id]);
            }
            foreach (var riga in piano.daInserire)
            {
                ctx2.PromoTracciatiRecords.Add(riga.NuovaEntita());
            }
            ctx2.PromoTracciatiRecords.RemoveRange(piano.daRimuovere.Select(id => perId[id]));

            risposta.Riporta(piano);
            return piano.daInserire.Count;
        }

        private async Task<int> RipristinaLavorazioni(PromoBackup backup, Promo promo, RipristinoPromoRisposta risposta)
        {
            var righe = BackupPromo.LeggiLavorazioni(backup);
            var correnti = await RecordDelleLavorazioni(promo).ToListAsync();

            string guid = promo.guidID ?? string.Empty;
            var lavorazioni = (await ctx2.PromoLavorazionis.Where(l => l.GuidPromo == guid).Select(l => l.Id).ToListAsync()).ToHashSet();
            var idRecord = righe.Select(r => r.IdRecordTracciato).Distinct().ToList();
            var recordEsistenti = (await ctx2.PromoTracciatiRecords.Where(r => idRecord.Contains(r.Id)).Select(r => r.Id).ToListAsync()).ToHashSet();

            var piano = BackupPromo.PianificaRipristinoLavorazioni(righe, correnti, lavorazioni, recordEsistenti);
            var perId = correnti.ToDictionary(r => r.Id);
            foreach (var riga in piano.daAggiornare)
            {
                riga.ApplicaA(perId[riga.Id]);
            }
            foreach (var riga in piano.daInserire)
            {
                ctx2.PromoLavorazioniRecords.Add(riga.NuovaEntita());
            }
            ctx2.PromoLavorazioniRecords.RemoveRange(piano.daRimuovere.Select(id => perId[id]));

            risposta.Riporta(piano);
            return piano.daInserire.Count;
        }
    }

    public class RichiestaBackupPromo
    {
        public int idPromo { get; set; }
        /// <summary>1 record dei tracciati, 2 record delle lavorazioni (TipoBackupPromo).</summary>
        public byte tipo { get; set; }
    }

    public class RichiestaRipristinoPromo
    {
        public int idBackup { get; set; }
    }

    public class ElencoBackupPromoRisposta
    {
        public bool esito { get; set; }
        public string error { get; set; } = string.Empty;
        public List<BackupPromoInfo> backups { get; set; } = new List<BackupPromoInfo>();
    }

    public class BackupPromoRisposta
    {
        public bool esito { get; set; }
        public string error { get; set; } = string.Empty;
        public BackupPromoInfo? backup { get; set; }
    }
}
