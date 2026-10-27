using System.Text.RegularExpressions;
using Istanta.Models_2;
using Istanta.Utility;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Istanta.Suite.Tests;

/// <summary>
/// TASK-35c2c68d: il salvataggio dal revisore con "tutti i tracciati" richiedeva circa un secondo.
///
/// Per una scheda singola Revisore/salva caricava la promo intera, tutti i tracciati e tutti i loro record
/// col dato, per ogni revisione, e poi prendeva in memoria l'ultimo record del codice in ogni tracciato.
/// Ora al database si chiedono solo i record del codice (RecordsRevisioneArticolo.DellArticoloNellaPromo)
/// e la scelta resta quella di prima (UltimoPerTracciato): firma e meta della revisione non cambiano.
///
/// L'SQL si guarda senza database: il contesto non apre mai una connessione, come in ModifichePendentiTests.
/// </summary>
public class RecordsRevisioneArticoloTests
{
    private static PromoTracciatiRecord Record(long id, int tracciato, DateTime? registrato) =>
        new PromoTracciatiRecord { Id = id, IdTracciato = tracciato, Codice = "6714445", DataRegistrazione = registrato };

    private static readonly DateTime Lunedi = new DateTime(2026, 10, 26, 9, 0, 0);

    [Fact]
    public void Per_ogni_tracciato_l_ultimo_record_registrato_con_i_tracciati_in_ordine()
    {
        var records = new[]
        {
            Record(10, 7, Lunedi),
            Record(11, 7, Lunedi.AddHours(2)),
            Record(12, 3, Lunedi.AddDays(1)),
            Record(13, 3, Lunedi),
        };

        var scelti = RecordsRevisioneArticolo.UltimoPerTracciato(records);

        Assert.Equal(new long[] { 12, 11 }, scelti.Select(r => r.Id));
    }

    [Fact]
    public void A_pari_data_vale_l_id_piu_basso_e_senza_data_si_perde_contro_chi_ce_l_ha()
    {
        var records = new[]
        {
            Record(21, 5, Lunedi),
            Record(20, 5, Lunedi),
            Record(30, 6, null),
            Record(31, 6, Lunedi),
            Record(41, 8, null),
            Record(40, 8, null),
        };

        Assert.Equal(new long[] { 20, 31, 40 }, RecordsRevisioneArticolo.UltimoPerTracciato(records).Select(r => r.Id));
        Assert.Empty(RecordsRevisioneArticolo.UltimoPerTracciato(Array.Empty<PromoTracciatiRecord>()));
    }

    /// La scelta di prima: i tracciati della promo e i loro record nell'ordine delle chiavi, come li
    /// caricava l'Include, e per ogni tracciato OrderByDescending(DataRegistrazione).FirstOrDefault().
    private static List<PromoTracciatiRecord> SceltaDiPrima(IEnumerable<PromoTracciatiRecord> recordsDelCodice)
    {
        var scelti = new List<PromoTracciatiRecord>();
        foreach (var tracciato in recordsDelCodice.Select(r => r.IdTracciato).Distinct().OrderBy(t => t))
        {
            var item = recordsDelCodice.Where(r => r.IdTracciato == tracciato).OrderBy(r => r.Id)
                .OrderByDescending(f => f.DataRegistrazione).FirstOrDefault();
            if (item != null)
            {
                scelti.Add(item);
            }
        }
        return scelti;
    }

    [Fact]
    public void La_scelta_e_la_stessa_di_prima_su_molti_casi()
    {
        var caso = new Random(35);
        for (int prova = 0; prova < 200; prova++)
        {
            var records = Enumerable.Range(1, caso.Next(0, 25))
                .Select(i => Record(caso.Next(1, 1000) * 100 + i, caso.Next(1, 5), caso.Next(0, 4) == 0 ? null : Lunedi.AddHours(caso.Next(0, 6))))
                .OrderBy(_ => caso.Next())
                .ToList();

            Assert.Equal(SceltaDiPrima(records).Select(r => r.Id), RecordsRevisioneArticolo.UltimoPerTracciato(records).Select(r => r.Id));
        }
    }

    [Fact]
    public void Al_database_si_chiedono_solo_i_record_del_codice_nella_promo()
    {
        using var ctx2 = new Edro21_DbContext2(new DbContextOptionsBuilder<Edro21_DbContext2>()
            .UseNpgsql("Host=localhost;Database=nessuno")
            .Options);

        var sql = RecordsRevisioneArticolo.DellArticoloNellaPromo(ctx2, 12, "6714445").ToQueryString();

        Assert.Matches(new Regex(@"FROM promo_tracciati_records AS \w+\s+INNER JOIN promo_tracciati AS"), sql);
        Assert.Matches(new Regex(@"\.id_promo = @"), sql);
        Assert.Matches(new Regex(@"\.codice = @"), sql);
        Assert.Contains("'6714445'", sql);
        //Non la promo con tutti i tracciati e tutti i record.
        Assert.DoesNotContain("FROM promo AS", sql);
    }

    [Fact]
    public void Il_salvataggio_usa_i_soli_record_del_codice_e_scrive_i_tempi_nel_log()
    {
        var controller = File.ReadAllText(TrovaFile("Istanta/Controllers/RevisoreController.cs"));

        Assert.Contains("promoRecordsArt = Utility.RecordsRevisioneArticolo.UltimoPerTracciato(", controller);
        Assert.Contains("Utility.RecordsRevisioneArticolo.DellArticoloNellaPromo(this.ctx2, acts.idPromo, act.Codice).ToList());", controller);
        Assert.DoesNotContain("this.ctx2.Promos.Include(f => f.PromoTracciatis).ThenInclude(f => f.PromoTracciatiRecords).Where(f => f.Id == acts.idPromo)", controller);
        //Una promo che non esiste si dice ancora come prima.
        Assert.Contains("if (!this.ctx2.Promos.Any(f => f.Id == acts.idPromo))", controller);
        Assert.Contains("\"Revisore/salva: {Salvate} revisioni salvate su {Revisioni} in {Tutto} ms", controller);
        Assert.Equal(4, Regex.Matches(controller, "msLibreria \\+= cronometroSalva\\.ElapsedMilliseconds - inizioLibreria;").Count);
    }

    private static string TrovaFile(string relativo)
    {
        var cartella = new DirectoryInfo(AppContext.BaseDirectory);
        while (cartella != null)
        {
            var candidato = Path.Combine(cartella.FullName, relativo.Replace('/', Path.DirectorySeparatorChar));
            if (File.Exists(candidato))
            {
                return candidato;
            }
            cartella = cartella.Parent;
        }

        throw new FileNotFoundException($"File non trovato risalendo da {AppContext.BaseDirectory}: {relativo}");
    }
}
