#define BS_ENABLED

using DocumentFormat.OpenXml.Office2010.Excel;
using Istanta.Controllers;
using Istanta.Models;
using Istanta.Models_2;
using Istanta.Utility;
using IstantaLib;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Newtonsoft.Json;
using System.Configuration;
//using System.Data.Entity;



public class BackgroundCodeService : BackgroundService
{
    readonly ILogger<BackgroundCodeService> _logger;
    //private  edro21_dbContext? ctx;

    private readonly string path_to_export;
    private readonly string path_to_import;
    private readonly string path_external_lib;
    private readonly string path_external_source;
    IConfiguration _config;
    private readonly IOptions<FicoConfig> _ficoConfig;
    private readonly IDbContextFactory<edro21_dbContext> _dbContextFactory;

    // +--- DEPRECATO --- 7/9/2026 -------------------------------------------------
    // Questo campo e LastCheckPropagazione qui sotto sono assegnati e mai letti:
    // ExecuteAsync non invoca mai la propagazione. Vedi il blocco DEPRECATO in
    // Utility/Propagatore.cs per l'analisi completa. NON CANCELLARE.
    // +---------------------------------------------------------------------------
    private readonly Propagatore propagazioneService;
    private DateTime LastCheckPropagazione = DateTime.Now;

    private bool miningDescrAlias = true;
    //private readonly int? msIntervalCheckPropagazione = 1000 * 10;// 60 * 5; //5 minuti

    private Edro21_DbContext2 ctx2;

    private readonly IDbContextFactory<Edro21_DbContext2> _dbContextFactory2;
    public BackgroundCodeService(ILogger<BackgroundCodeService> logger, IConfiguration configuration, IOptions<PathOperationExport> option_export, IOptions<PathOperationImport> option_import, IOptions<PathExternal> external_lib, IOptions<FicoConfig> ficoConfig, IDbContextFactory<edro21_dbContext> dbContextFactory, IDbContextFactory<Edro21_DbContext2> dbContextFactory2)
    {
        this._dbContextFactory2 = dbContextFactory2;
        this._logger = logger;

        this._config = configuration;
        //this.ctx = new edro21_dbContext(configuration.GetConnectionString("IstandaConnectionDb"));
        this.ctx2 = this._dbContextFactory2.CreateDbContext();

        path_to_export = option_export.Value.path;
        path_to_import = option_import.Value.path;
        path_external_lib = external_lib.Value.pathLib;
        path_external_source = external_lib.Value.pathSource;

        this._ficoConfig = ficoConfig;
        this._dbContextFactory = dbContextFactory;

        propagazioneService = new Propagatore(this._config.GetConnectionString("IstandaConnectionDb")!, path_external_lib, path_external_source, this._ficoConfig.Value.nomeCliente, dbContextFactory2: this._dbContextFactory2);

    }


    protected async override Task ExecuteAsync(CancellationToken stoppingToken)
    {
#if BS_ENABLED
        while (!stoppingToken.IsCancellationRequested)
        {
            //_logger.LogInformation("Routine demone at {time}", DateTime.Now);

            
            //Ogni 10 secondi Faccio un controllo delle attività e le eeseguo oppure le organizzo in coda di priorità

            using var ctx = await _dbContextFactory.CreateDbContextAsync(stoppingToken);

            // +--- DEPRECATO --- 7/9/2026 ---------------------------------------
            // COSA    Il blocco sottostante (~170 righe) che costruisce i file
            //         .jsonl di addestramento in ai_models/.
            // PERCHE  E IRRAGGIUNGIBILE. miningDescrAlias e inizializzato a true
            //         alla dichiarazione, e l'unica altra assegnazione nel codice
            //         lo rimette a true dentro il blocco stesso: la condizione
            //         !miningDescrAlias non e mai vera. Nessun altro punto della
            //         soluzione tocca quella variabile.
            // EFFETTO Questo codice non e mai stato eseguito in produzione.
            // NON CANCELLARE: da valutare in un futuro lavoro di pulizia.
            // +-------------------------------------------------------------------
            if (!miningDescrAlias)
            {
                try
                {
                    //var lista_articoli = ctx.Articolis.Include(i => i.ArticoliDescrizionis).Where(a => a.ArticoliDescrizionis.Any(f => f.FirmaTracciato != null && !f.FirmaTracciato.Contains("suggerimento"))).OrderByDescending(ord => ord.DataInserimento).ToList();
                    //var lista_articoli = ctx.Articolis.Include(i => i.ArticoliDescrizionis).Where(a => a.ArticoliDescrizionis.Any(f => f.FirmaTracciato != null)).OrderByDescending(ord => ord.DataInserimento).ToList();

                    List<Dictionary<string,object>> _allRecordsSingoli = this.ctx2.PromoTracciatiRecords.GroupBy(g => g.Codice).Select(s => Istanta.Utility.Main.getJsonObject(s.OrderByDescending(o => o.DataRegistrazione).FirstOrDefault().Dato)).ToList();

                    List <Dictionary<string, string>> lista_dict_descrizioni = new List<Dictionary<string, string>>();

                    //foreach (Articoli art in lista_articoli)
                    foreach (var dict in _allRecordsSingoli)
                    {

                        string rep = dict["reparto"].ToString();
                        string sett = dict["settore"].ToString();
                        string codice = dict[GLOBAL_VARIABLES_FICO.keyRefCodice].ToString();

                        var artDescr = ctx.ArticoliDescrizionis.Include(i => i.IdArticoloNavigation).Where(a => a.IdArticoloNavigation.Codice == codice).FirstOrDefault();
                        if (artDescr != null)
                        {
                            lista_dict_descrizioni.Add(new Dictionary<string, string>
                            {
                                { "reparto", rep },
                                { "settore", sett },
                                { "Descr1", dict.ContainsKey(GLOBAL_VARIABLES_FICO.keyDescrizione1) ? dict[GLOBAL_VARIABLES_FICO.keyDescrizione1].ToString() : string.Empty },
                                { "Descr2", dict.ContainsKey(GLOBAL_VARIABLES_FICO.keyDescrizione2) ? dict[GLOBAL_VARIABLES_FICO.keyDescrizione2].ToString() : string.Empty },
                                { "Descr3", dict.ContainsKey(GLOBAL_VARIABLES_FICO.keyDescrizione3) ? dict[GLOBAL_VARIABLES_FICO.keyDescrizione3].ToString() : string.Empty },
                                { "Descr4", dict.ContainsKey(GLOBAL_VARIABLES_FICO.keyDescrizione4) ? dict[GLOBAL_VARIABLES_FICO.keyDescrizione4].ToString() : string.Empty },
                                { "Titolo", artDescr.Descrizione1 },
                                { "Brand", artDescr.Descrizione2 },
                                { "Tipo", artDescr.Descrizione3 },
                                { "Grammatura", artDescr.Descrizione4 }
                            });
                        }

                        //string firma = art.ArticoliDescrizionis.FirstOrDefault().FirmaTracciato;
                        //List<PromoTracciatiRecord> qCodList = this.ctx2.PromoTracciatiRecords.Where(p => p.Codice == art.Codice).OrderByDescending(o=>o.DataRegistrazione).ToList();

                        //var itemInTracciato = qCodList.Where(i => Istanta.Utility.Main.getJsonObject(i.Dato)[GLOBAL_VARIABLES_FICO.keyTracciatoFirma].ToString() == firma).FirstOrDefault();
                        //if (itemInTracciato==null)
                        //{
                        //    //Perndiamo l'ultmo transitato
                        //    itemInTracciato = qCodList.LastOrDefault(p => p.Codice == art.Codice);
                        //}
                        //if (itemInTracciato != null)
                        //{
                        //    var dict = Istanta.Utility.Main.getJsonObject(itemInTracciato.Dato);
                        //    string rep = dict["reparto"].ToString();
                        //    string sett = dict["settore"].ToString();

                        //    ArticoliDescrizioni artDescr = art.ArticoliDescrizionis.FirstOrDefault();

                        //    lista_dict_descrizioni.Add(new Dictionary<string, string>
                        //{
                        //    { "reparto", rep },
                        //    { "settore", sett },
                        //    { "Descr1", dict.ContainsKey(GLOBAL_VARIABLES_FICO.keyDescrizione1) ? dict[GLOBAL_VARIABLES_FICO.keyDescrizione1].ToString() : string.Empty },
                        //    { "Descr2", dict.ContainsKey(GLOBAL_VARIABLES_FICO.keyDescrizione2) ? dict[GLOBAL_VARIABLES_FICO.keyDescrizione2].ToString() : string.Empty },
                        //    { "Descr3", dict.ContainsKey(GLOBAL_VARIABLES_FICO.keyDescrizione3) ? dict[GLOBAL_VARIABLES_FICO.keyDescrizione3].ToString() : string.Empty },
                        //    { "Descr4", dict.ContainsKey(GLOBAL_VARIABLES_FICO.keyDescrizione4) ? dict[GLOBAL_VARIABLES_FICO.keyDescrizione4].ToString() : string.Empty },
                        //    { "Titolo", artDescr.Descrizione1 },
                        //    { "Brand", artDescr.Descrizione2 },
                        //    { "Tipo", artDescr.Descrizione3 },
                        //    { "Grammatura", artDescr.Descrizione4 }
                        //});
                        //}
                    }

                    var lista_descr_gruppo = ctx.ArticoliDescrizionis.Where(a => a.CodiceGruppo != null && a.FirmaTracciato != null && !a.FirmaTracciato.Contains("suggerimento")).ToList();
                    List<Dictionary<string, string>> lista_dict_gruppi = new List<Dictionary<string, string>>();

                    foreach (ArticoliDescrizioni artDescr in lista_descr_gruppo)
                    {
                        string firma = artDescr.FirmaTracciato;

                        var allItemsInTracciato = await this.ctx2.PromoTracciatiRecords.Where(p => p.CodiceGruppo == artDescr.CodiceGruppo).ToListAsync();//.Where(i => Istanta.Utility.Main.getJsonObject(i.Dato)[GLOBAL_VARIABLES_FICO.keyTracciatoFirma].ToString() == firma).ToList();

                        //List<PromoTracciatiRecord> itemsInTracciato = allItemsInTracciato.GroupBy(g => g.IdTracciato).Where(t => Istanta.Utility.Main.getFirmaTracciatoGruppo(t.Select(s => Istanta.Utility.Main.getJsonObject(s.Dato)).ToList()) == firma).Select(s2 => s2.FirstOrDefault()).ToList();
                        List<PromoTracciatiRecord> itemsInTracciato = allItemsInTracciato.GroupBy(g => g.IdTracciato).Select(s2 => s2.FirstOrDefault()).ToList();

                        if (itemsInTracciato.Count > 0)
                        {
                            List<Dictionary<string, string>> lista_dict_descrizioni_gruppo = new List<Dictionary<string, string>>();
                            foreach (var itemInTracciato in itemsInTracciato)
                            {

                                var dict = Istanta.Utility.Main.getJsonObject(itemInTracciato.Dato);
                                string rep = dict["reparto"].ToString();
                                string sett = dict["settore"].ToString();

                                lista_dict_descrizioni_gruppo.Add(new Dictionary<string, string>
                        {
                            { "reparto", rep },
                            { "settore", sett },
                            { "Descr1", dict.ContainsKey(GLOBAL_VARIABLES_FICO.keyDescrizione1) ? dict[GLOBAL_VARIABLES_FICO.keyDescrizione1].ToString() : string.Empty },
                            { "Descr2", dict.ContainsKey(GLOBAL_VARIABLES_FICO.keyDescrizione2) ? dict[GLOBAL_VARIABLES_FICO.keyDescrizione2].ToString() : string.Empty },
                            { "Descr3", dict.ContainsKey(GLOBAL_VARIABLES_FICO.keyDescrizione3) ? dict[GLOBAL_VARIABLES_FICO.keyDescrizione3].ToString() : string.Empty },
                            { "Descr4", dict.ContainsKey(GLOBAL_VARIABLES_FICO.keyDescrizione4) ? dict[GLOBAL_VARIABLES_FICO.keyDescrizione4].ToString() : string.Empty },
                        });

                            }

                            lista_dict_gruppi.Add(new Dictionary<string, string> {
                            {"reparto", lista_dict_descrizioni_gruppo.FirstOrDefault()["reparto"] },
                            {"settore", lista_dict_descrizioni_gruppo.FirstOrDefault()["settore"] },
                            {"items", JsonConvert.SerializeObject(lista_dict_descrizioni_gruppo) },
                            {"Titolo", artDescr.Descrizione1 },
                            {"Brand", artDescr.Descrizione2 },
                            {"Tipo", artDescr.Descrizione3 },
                            {"Grammatura", artDescr.Descrizione4 }
                        });
                        }
                    }


                    miningDescrAlias = true;

                    int nSingleSampleTraining = (int)(lista_dict_descrizioni.Count * 0.8);
                    int nSingleSampleValidation = (int)(lista_dict_descrizioni.Count * 0.1);
                    int nSingleSampleTest = (int)(lista_dict_descrizioni.Count * 0.1);
                    int nGroupSampleTraining = (int)(lista_dict_gruppi.Count * 0.8);
                    int nGroupSampleValidation = (int)(lista_dict_gruppi.Count * 0.1);
                    int nGroupSampleTest = (int)(lista_dict_gruppi.Count * 0.1);

                    //Creo 6 jsonl basandomi su lista_dict_descrizioni e lista_dict_gruppi
                    //base dir
                    string modelPath = Path.Combine(AppContext.BaseDirectory, "ai_models");
                    if (!Directory.Exists(modelPath))
                        Directory.CreateDirectory(modelPath);

                    for (int i = 0; i < lista_dict_descrizioni.Count; i++)
                    {
                        string jsonLine = JsonConvert.SerializeObject(lista_dict_descrizioni[i]);
                        if (i < nSingleSampleTraining)
                        {
                            System.IO.File.AppendAllText(Path.Combine(modelPath, "single_sample_training.jsonl"), jsonLine + Environment.NewLine);
                        }
                        else if (i < nSingleSampleTraining + nSingleSampleValidation)
                        {
                            System.IO.File.AppendAllText(Path.Combine(modelPath, "single_sample_validation.jsonl"), jsonLine + Environment.NewLine);
                        }
                        else
                        {
                            System.IO.File.AppendAllText(Path.Combine(modelPath, "single_sample_test.jsonl"), jsonLine + Environment.NewLine);
                        }
                    }

                    for (int i = 0; i < lista_dict_gruppi.Count; i++)
                    {
                        string jsonLine = JsonConvert.SerializeObject(lista_dict_gruppi[i]);
                        if (i < nGroupSampleTraining)
                        {
                            System.IO.File.AppendAllText(Path.Combine(modelPath, "group_sample_training.jsonl"), jsonLine + Environment.NewLine);
                        }
                        else if (i < nGroupSampleTraining + nGroupSampleValidation)
                        {
                            System.IO.File.AppendAllText(Path.Combine(modelPath, "group_sample_validation.jsonl"), jsonLine + Environment.NewLine);
                        }
                        else
                        {
                            System.IO.File.AppendAllText(Path.Combine(modelPath, "group_sample_test.jsonl"), jsonLine + Environment.NewLine);
                        }
                    }

                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Errore durante il mining delle descrizioni e alias");
                }
            }

            //this.ctx = new edro21_dbContext(this._config.GetConnectionString("IstandaConnectionDb")!);
            var attivita_da_svolgere = ctx.Attivita.Where(a => a.Stato == (Byte)OperationStauts.InAttesaDiAssegnazione).OrderBy(o=>o.DataInserimento).ToList();

            var attivita_in_svolgimento = ctx.Attivita.Where(a => 
            a.Stato == (Byte)OperationStauts.InCoda || 
            a.Stato == (Byte)OperationStauts.ElaborazioneDati || 
            a.Stato == (Byte)OperationStauts.AttesaI_O || 
            a.Stato == (Byte)OperationStauts.I_O).OrderByDescending(o=>o.Coda).ToList();


            Attivitum? last_elab = attivita_in_svolgimento.Where(a => a.TipoProcesso == (Byte)TipoProcesso.Elaborazione).OrderByDescending(o=>o.Coda).FirstOrDefault();
            Byte ultima_coda_tipo_elaborazione = last_elab != null ? last_elab.Coda : (Byte)0;
            //Attivitum? last_fs = attivita_in_svolgimento.Where(a => a.TipoProcesso == (Byte)TipoProcesso.FileSystem).FirstOrDefault();
            //Byte ultima_coda_tipo_io = last_fs!=null ? last_fs.Coda: (Byte)0;
            
            Byte conteggio_elaborazioni_attive = (Byte)attivita_in_svolgimento.Where(s => s.Stato != (Byte)OperationStauts.InCoda && s.TipoProcesso == (Byte)TipoProcesso.Elaborazione).Count();
            //Byte conteggio_fs_attive = (Byte)attivita_in_svolgimento.Where(s => s.Stato != (Byte)OperationStauts.InCoda && s.TipoProcesso == (Byte)TipoProcesso.FileSystem).Count();
            



            try
            {
                int maxTake = GLOBAL_VARIABLES.maxSimultaneousOperationRequestOfElaboration - conteggio_elaborazioni_attive;
                //Controllo di non avere in coda, attività di elaboraione da eseguire
                List<Attivitum> inCodaDaEseguire = attivita_in_svolgimento.Where(s => s.Stato == (Byte)OperationStauts.InCoda && s.TipoProcesso == (Byte)TipoProcesso.Elaborazione).OrderBy(o => o.Coda).Take(maxTake).ToList();


                foreach (Attivitum act in inCodaDaEseguire)
                {
                    //_logger.LogInformation("Elabora attività in coda n. {coda}", act.Coda);

                    act.Stato = (Byte)OperationStauts.ElaborazioneDati;
                    act.Coda = 0;
                    await ctx.SaveChangesAsync();

                    conteggio_elaborazioni_attive++;
                    OperationsController op_ctrl = new OperationsController(_config.GetConnectionString("IstandaConnectionDb")!, path_to_import, path_to_export, path_external_lib, path_external_source, this._ficoConfig.Value.nomeCliente, this._dbContextFactory, dbContextFactory2: this._dbContextFactory2);
                    _=op_ctrl.EseguiByID(act.Id);

                }

                if (inCodaDaEseguire.Count > 0)
                {
                    Byte progCoda = 1;
                    //Ricalcolo i numeri di coda
                    foreach (Attivitum act in attivita_in_svolgimento.Where(s => s.Stato == (Byte)OperationStauts.InCoda && s.TipoProcesso == (Byte)TipoProcesso.Elaborazione).OrderBy(o => o.Coda))
                    {
                        act.Coda = progCoda;
                        ultima_coda_tipo_elaborazione = progCoda;

                        progCoda++;
                    }

                    await ctx.SaveChangesAsync();
                }
            }catch(Exception ex)
            {
                ex.ToString();
            }

            

            //Coda dei processi da prendere in carico
            foreach (Attivitum act in attivita_da_svolgere)
            {
                act.TipoProcesso = (Byte)TipoProcesso.Elaborazione;

                if (conteggio_elaborazioni_attive >= GLOBAL_VARIABLES.maxSimultaneousOperationRequestOfElaboration)
                {
                    //Non c'è piu spazio devo assegnargli una coda
                    Byte coda = (Byte)(ultima_coda_tipo_elaborazione + (conteggio_elaborazioni_attive - GLOBAL_VARIABLES.maxSimultaneousOperationRequestOfElaboration));
                    act.Stato = (Byte)OperationStauts.InCoda;
                    act.Coda = coda;
                    await ctx.SaveChangesAsync();
                }
                else
                {
                    //Bene posso metterlo tra quelli in elaborazione
                    conteggio_elaborazioni_attive++;
                    act.Stato = (Byte)OperationStauts.InCoda;
                    act.Coda = 0;
                    await ctx.SaveChangesAsync();
                }
            }



            await Task.Delay(10000);
        }

#endif
    }

}