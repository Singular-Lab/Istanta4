using Istanta.Controllers;
using Istanta.Models;
using Istanta.Models_2;
using IstantaLib;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Internal;
using Newtonsoft.Json;
using System.Reflection;

namespace Istanta.Utility
{
    // +--- DEPRECATO --- 7/9/2026 -------------------------------------------------
    // COSA        Propagatore, e in particolare ElaboraRegistro(): il motore che
    //             decide dove propagare una correzione.
    // PERCHE      Non lo chiama nessuno. Cercando "ElaboraRegistro" in tutta la
    //             soluzione (Istanta, IstantaLib, AgenziaLib) e anche nei sorgenti
    //             di port10, l'unica occorrenza del nome e la dichiarazione stessa.
    //             Un Propagatore viene costruito in un solo punto, il costruttore di
    //             BackgroundCodeService, e il ciclo del demone non lo usa mai.
    // PROVA       Al 7/9/2026 registro_propagazioni era VUOTA sia su SQL Server sia
    //             su PostgreSQL, e registro_operazioni aveva 16 righe (SQL Server) e
    //             23 (PostgreSQL) con data_elaborazione_propagazioni a NULL, alcune
    //             vecchie di giorni. Il motore non ha mai girato, su nessuno dei due.
    // INOLTRE     Se venisse chiamato cosi com'e, solleverebbe NullReferenceException
    //             alla prima riga utile: BackgroundCodeService lo costruisce con 4
    //             argomenti su 5, quindi _dbContextFactory resta null, e il metodo
    //             comincia con _dbContextFactory.CreateDbContext().
    // VERIFICATO  7/9/2026: forzato a mano dalla rotta /Diagnostica/Propaga sulla
    //             copia PostgreSQL, passandogli la factory. Ha elaborato le 23
    //             operazioni in attesa senza errori e registrato 0 propagazioni, che
    //             e il comportamento corretto: erano tutte di tipo login,
    //             syncPacchettoFoto e updateFoto, mentre il motore ramifica solo su
    //             revisione, cambioMeta e revisioneCampiOfferta. I tre rami che
    //             propagano davvero non sono ancora stati esercitati.
    // ATTENZIONE  Contiene OrderBy(o => o.Data_Esecuzione) su colonna nullable:
    //             su PostgreSQL i NULL vanno in fondo, su SQL Server in testa.
    //             Se un giorno si riattiva, l'ordine di elaborazione cambia.
    // AGGIUNTA 7/9/2026  Unico punto in tutta l'applicazione che costruisce ancora
//                     'new Edro21_DbContext2(stringa)'. Non convertito alla fabbrica
//                     proprio perche questa classe e deprecata: convertirlo avrebbe
//                     dato l'impressione che sia codice vivo. Il costruttore a stringa
//                     di Edro21_DbContext2 resta in piedi solo per lui.
// NON CANCELLARE: da valutare in un futuro lavoro di pulizia.
    // +---------------------------------------------------------------------------
    public class Propagatore
    {
        private edro21_dbContext? ctx;
        private Edro21_DbContext2? ctx2;
        public string conn_string = "";
        public string extarnalLibPath;
        public string extarnalSourcePath;
        public string ficoClientName;

        private bool isBusy=false;
        private readonly IDbContextFactory<edro21_dbContext> _dbContextFactory;
        private readonly IDbContextFactory<Edro21_DbContext2> _dbContextFactory2;
        public Propagatore(string conn_string, string external_lib = "", string external_source = "", string ficoClientName = "", IDbContextFactory<edro21_dbContext> dbContextFactory=null, IDbContextFactory<Edro21_DbContext2> dbContextFactory2 = null)
        {
            this._dbContextFactory2 = dbContextFactory2;
            this.conn_string = conn_string;
            this.extarnalLibPath = external_lib;
            this.extarnalSourcePath = external_source;
            this.ficoClientName = ficoClientName;

            this._dbContextFactory = dbContextFactory;
        }

        public async void ElaboraRegistro()
        {
            if (this.isBusy)
            {
                return;
            }

            isBusy = true;

            this.ctx = this._dbContextFactory.CreateDbContext();
            //this.ctx = new edro21_dbContext(this.conn_string);
            this.ctx2=this._dbContextFactory2.CreateDbContext();

            IstantaController icItem = new IstantaController(this.conn_string, this.extarnalLibPath, this.extarnalSourcePath, this._dbContextFactory);

            try
            {
                //Recupero delle azioni non ancora processate
                List<RegistroOperazioni> azioniDaElaborare = await this.ctx.RegistroOperazionis.Where(x => !x.DataElaborazionePropagazioni.HasValue).OrderBy(o => o.Data_Esecuzione).ToListAsync();

                Console.WriteLine($"Propagatore: trovate {azioniDaElaborare.Count} azioni da elaborare");

                if (azioniDaElaborare.Count > 0)
                {
                    "test".ToString();
                }

                Dictionary<string, List<PromoLavorazioniRecord>> cache = new Dictionary<string, List<PromoLavorazioniRecord>>();

                foreach (RegistroOperazioni azione in azioniDaElaborare)
                {
                    //azione.IdTracciato
                    //this.ctx2.PromoLavorazioniRecords.Where(x=>x.IdRecordTracciato)
                    //this.ctx2.PromoLavorazionis.Where(x => x.GuidPromo == azione.idPromoLavorazioniRecord.Value).ToList();
                    List<int> ids_lavorazioni = new List<int>();

                    Console.WriteLine($">>>> Azione {azione.Id}");

                    string guidAreaOrigine = "";
                    string guidCanaleOrigine = "";
                    int idLavorazioneOrigine = 0;
                    Dictionary<string, object>? recOrigine = null;

                    if (azione.idPromoLavorazioniRecord.HasValue)
                    {
                        try
                        {
                            Console.WriteLine($">>>> Azione {azione.Id}: recupero dati");

                            var origine = await this.ctx2.PromoLavorazioniRecords
                                .Include(inc => inc.IdPromoLavorazioniNavigation)
                                .Include(inc2 => inc2.IdPromoTracciatiRecordNavigation)
                                .Where(p => p.Id == azione.idPromoLavorazioniRecord)
                                .Select(s => new
                                {
                                    IdLavorazione = s.IdLavorazione,
                                    GuidArea = s.IdPromoLavorazioniNavigation.GuidArea,
                                    GuidCanale = s.IdPromoLavorazioniNavigation.GuidCanale,
                                    Rec = Utility.Main.getJsonObject(s.IdPromoTracciatiRecordNavigation.Dato!)

                                }).FirstOrDefaultAsync();

                            if (origine != null)
                            {
                                guidAreaOrigine = origine.GuidArea!;
                                guidCanaleOrigine = origine.GuidCanale!;
                                recOrigine = origine.Rec;
                                idLavorazioneOrigine = origine.IdLavorazione;
                            }
                        }
                        catch (Exception ex)
                        {
                            Console.WriteLine($">>>> Errore {ex.ToString()}");
                            ex.ToString();

                            //Se cadiamo qui, significa che qualcuno ha fatto una modifica su questa lavorazione
                            //POoi però il record di lavorazione è stato rimosso, magari per essere reimpaginato o semplicemente tagliato e copiato in un'altra pagina?
                            //Può accadere.
                            //Quindi intanto ci assicuriamo che DAVVERO non esista più
                            PromoTracciatiRecord? ptrItem = await this.ctx2.PromoTracciatiRecords.FirstOrDefaultAsync(t => t.IdTracciato == azione.IdTracciato && t.CodiceGruppo == azione.CodiceAssociato);
                            if (ptrItem != null)
                            {
                                recOrigine = Utility.Main.getJsonObject(ptrItem!.Dato!);
                                PromoTracciati? tracciatoItem = await this.ctx2.PromoTracciatis.FirstOrDefaultAsync(t => t.Id == ptrItem.IdTracciato);
                                guidCanaleOrigine = tracciatoItem!.guidCanale!;
                                guidAreaOrigine = tracciatoItem.guidArea!;

                                if (azione.idPromoLavorazione.HasValue)
                                    idLavorazioneOrigine = azione.idPromoLavorazione.Value;

                            }
                            else
                            {
                                //Se non trovo il record neppure nel tracciato la faccendo è più grave del previsto

                            }
                        }
                    }

                    if (azione.TipoOperazione == (Byte)tipoOperazione.revisione)
                    {
                        //Operazione di revisione eseguita quindi su archivio
                        //Al massimo fatta da revisione tracciato e quindi con id del tracciato MAI del record in lavorazione

                        Console.WriteLine($">>>> Azione di revisione");

                        //Recupero tutte le promo valide
                        List<string?> promoGuids = await this.ctx2.Promos.Where(p => p.DataScadenza > DateTime.Now).Select(s => s.guidID).ToListAsync();
                        ids_lavorazioni = await this.ctx2.PromoLavorazionis.Where(p => promoGuids.Contains(p.GuidPromo)).Select(s => s.Id).ToListAsync();

                    }
                    else
                    {
                        if (
                            azione.TipoOperazione == (Byte)tipoOperazione.cambioMeta ||
                            azione.TipoOperazione == (Byte)tipoOperazione.revisioneCampiOfferta
                            )
                        {
                            Console.WriteLine($">>>> Azione di cambio meta");

                            if (azione.idPromoLavorazioniRecord.HasValue)
                            {
                                //IL'azione arriva da InDesign
                                if (idLavorazioneOrigine > 0)
                                {
                                    PromoLavorazioni? pl = await this.ctx2.PromoLavorazioniRecords.Include(inc => inc.IdPromoLavorazioniNavigation).Where(p => p.Id == azione.idPromoLavorazioniRecord).Select(s => s.IdPromoLavorazioniNavigation).FirstOrDefaultAsync();
                                    if (pl != null)
                                    {
                                        //Recupero tutte le promo valide escludendo la lavorazione di origine
                                        ids_lavorazioni = await this.ctx2.PromoLavorazionis.Where(p => p.GuidPromo == pl.GuidPromo && p.Id != pl.Id).Select(s => s.Id).ToListAsync();
                                    }
                                }
                                else
                                {

                                }
                            }
                            else
                            {
                                //Il cambio strutturale è stato generato da alterazioni meta a seguito di un aggiornamento delle liste
                                //Recupero tutte le promo valide
                                List<string?> promoGuids = await this.ctx2.Promos.Where(p => p.DataScadenza > DateTime.Now).Select(s => s.guidID).ToListAsync();
                                ids_lavorazioni = await this.ctx2.PromoLavorazionis.Where(p => promoGuids.Contains(p.GuidPromo)).Select(s => s.Id).ToListAsync();

                            }
                        }

                    }

                    if (ids_lavorazioni.Count > 0)
                    {

                        string cacheId = String.Join(',', ids_lavorazioni.OrderBy(o => o).ToArray());

                        List<PromoLavorazioniRecord>? records = null;

                        if (!cache.ContainsKey(cacheId))
                        {
                            //Processo di ricerca delle referenze
                            records = await this.ctx2.PromoLavorazioniRecords
                                .Include(inc => inc.IdPromoTracciatiRecordNavigation)
                                .Include(inc2 => inc2.IdPromoLavorazioniNavigation)
                                .Where(p => ids_lavorazioni.Contains(p.IdLavorazione)).ToListAsync();
                            cache.Add(cacheId, records);
                        }
                        else
                        {
                            records = cache[cacheId];
                        }

                        List<PromoLavorazioniRecord> plrPotenziali = new List<PromoLavorazioniRecord>();
                        //Records dove cercare


                        //Prima vado per codice pilota
                        plrPotenziali.AddRange(records.Where(p => p.CodiceGruppo == azione.CodiceAssociato).ToList());


                        //Poi se il pilota è un gruppo
                        //Prendo i singoli e cerco per ogni singolo
                        string[]? codiciSingoli = azione.CodiceAssociato!.Split(',');
                        if (codiciSingoli.Length > 1)
                        {
                            foreach (string codSingolo in codiciSingoli)
                            {
                                plrPotenziali.AddRange(records.Where(p => p.Codice == codSingolo).ToList());
                            }

                            //Cerco i sottogruppi contenuti nel gruppo pilota
                            plrPotenziali.AddRange(records.Where(p => p.CodiceGruppo != p.Codice && azione.CodiceAssociato.Contains(p.CodiceGruppo!)).ToList());

                        }

                        Console.WriteLine($">>>> Interroghiamo agenzia");


                        //A questo punto possiamo chiedere all'agenzia il livello di gravità di ogni potenziale propagazione
                        foreach (PromoLavorazioniRecord itemPlr in plrPotenziali)
                        {
                            string func = "";

                            Dictionary<string, object> objParams = new Dictionary<string, object>();
                            if (azione.TipoOperazione == (Byte)tipoOperazione.cambioMeta)
                            {
                                objParams.Add("azione", JsonConvert.DeserializeObject<List<CambioMetaRecordTracciatoAzione>>(azione.FormData!)!);
                                func = "analizzaPropagazionePerCambioMeta";
                            }
                            else if (azione.TipoOperazione == (Byte)tipoOperazione.revisione)
                            {
                                objParams.Add("azione", JsonConvert.DeserializeObject<RevisioneDescrizione>(azione.FormData!)!);
                                func = "analizzaPropagazionePerRevisione";
                            }
                            else if (azione.TipoOperazione == (Byte)tipoOperazione.revisioneCampiOfferta)
                            {
                                objParams.Add("azione", JsonConvert.DeserializeObject<RevisioneCampiOffertaFromIndd>(azione.FormData!)!);
                                func = "analizzaPropagazionePerModificaCampiOfferta";
                            }


                            AnalisiPorpagazione analisi = new AnalisiPorpagazione();
                            //La destinazione c'è per forza
                            analisi.recDestinazione = Utility.Main.getJsonObject(itemPlr.IdPromoTracciatiRecordNavigation.Dato!);
                            analisi.canaleDestinazione = SingletonConfiguration.DBACPV!.canali.FirstOrDefault(c => c.guidID == itemPlr.IdPromoLavorazioniNavigation.GuidCanale);
                            analisi.areaDestinazione = SingletonConfiguration.DBACPV.aree.FirstOrDefault(c => c.guidID == itemPlr.IdPromoLavorazioniNavigation.GuidArea);

                            if (recOrigine != null)
                            {
                                analisi.canaleOrigine = SingletonConfiguration.DBACPV.canali.FirstOrDefault(c => c.guidID == guidCanaleOrigine);
                                analisi.areaOrigine = SingletonConfiguration.DBACPV.aree.FirstOrDefault(c => c.guidID == guidAreaOrigine);
                                analisi.recOrigine = recOrigine;
                            }

                            objParams.Add("analisiAzione", analisi);

                            PrioritaPropagazione prioritaAnalisi = PrioritaPropagazione.Warning;
                            try
                            {
                                AnalisiPorpagazioneResult? analisiResult = icItem.execLibFunction($"AgenziaLib.{this.ficoClientName}.{func}", objParams) as AnalisiPorpagazioneResult;


                                if (analisiResult!.priorita != PrioritaPropagazione.None)
                                {
                                    prioritaAnalisi = analisiResult.priorita;
                                }
                            }
                            catch (TargetInvocationException e)
                            {
                                if (e.InnerException is NotImplementedException nie)
                                {
                                    // Gestisci NotImplementedException
                                    //Console.WriteLine("NotImplementedException catturata: " + nie.Message);
                                    prioritaAnalisi = PrioritaPropagazione.Warning;
                                }
                                else
                                {
                                    // Gestisci altre eccezioni inaspettate
                                    //Console.WriteLine("Eccezione non gestita: " + e.InnerException.Message);
                                }
                            }
                            catch (Exception ex)
                            {
                                Type ty = ex.GetType();
                                //Console.WriteLine($"Errore in analisi propagazione: {ex.ToString()}");
                                prioritaAnalisi = PrioritaPropagazione.Safe;
                            }

                            if (prioritaAnalisi == PrioritaPropagazione.Warning ||
                                prioritaAnalisi == PrioritaPropagazione.Danger)
                            {
                                //Registro la propagazione
                                RegistroPropagazioni regProp = new RegistroPropagazioni();
                                regProp.DataRegistrazione = DateTime.Now;
                                regProp.IdRegistro = azione.Id;
                                regProp.IdPromoLavorazioniRecord = itemPlr.Id;
                                regProp.Stato = (Byte)StatoPropagazione.Segnalato;
                                regProp.Priorita = (Byte)prioritaAnalisi;

                                this.ctx.RegistroPropagazionis.Add(regProp);

                            }
                        }

                    }

                    azione.DataElaborazionePropagazioni = DateTime.Now;

                }

                this.ctx.SaveChanges();

                isBusy = false;
            }
            catch(Exception globalErr)
            {
                Console.WriteLine($">>>> Global error: {globalErr.ToString()}");
                isBusy = false;
            }

        }


    }
}
