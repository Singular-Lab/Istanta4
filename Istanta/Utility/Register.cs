using Istanta.Controllers;
using Istanta.Models;
using Istanta.Models_2;
using Microsoft.AspNetCore.JsonPatch.Operations;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;
using System.Collections.Generic;
using IstantaLib;
using Microsoft.EntityFrameworkCore;

namespace Istanta.Utility
{
    public class Register
    {
        private readonly edro21_dbContext ctx;
        private readonly Edro21_DbContext2 ctx2;
        private readonly IDbContextFactory<edro21_dbContext> _dbContextFactory;
        private readonly IDbContextFactory<Edro21_DbContext2> _dbContextFactory2;
        public Register(string conn_string, IDbContextFactory<edro21_dbContext> dbContextFactory, IDbContextFactory<Edro21_DbContext2> dbContextFactory2)
        {
            this._dbContextFactory2 = dbContextFactory2;
            this.ctx2 = this._dbContextFactory2.CreateDbContext();

            this._dbContextFactory = dbContextFactory;
            this.ctx = this._dbContextFactory.CreateDbContext();
            //this.ctx = new edro21_dbContext(conn_string);
        }

        public long addOperazione(RegistroOperazioni operazione, bool confirmed, string session, DateTime registerDate)
        {
            try
            {
                if (session == null || session.ToLower() == "no session")
                {
                    return 0;
                }
                operazione.Stato = (byte)(confirmed ? statoOperazioni.risolta : statoOperazioni.inAttesa);
                operazione.Esecutore = confirmed ? int.Parse(session) : null;
                operazione.Data_Registrazione = registerDate;//.ToString("dd/MM/yyyy HH:mm:ss"); ;
                if (operazione.Url == null)
                    operazione.Url = "";

                if (operazione.Stato == (byte)statoOperazioni.risolta)
                {
                    operazione.Data_Esecuzione = operazione.Data_Registrazione;
                }

                this.ctx.RegistroOperazionis.Add(operazione);
                this.ctx.SaveChanges();

                //Salvo i META
                if (operazione.FormData != null && operazione.idPromoLavorazioniRecord.HasValue)
                {
                    PromoLavorazioniRecord? plrItem = this.ctx2.PromoLavorazioniRecords.FirstOrDefault(f => f.Id == operazione.idPromoLavorazioniRecord.Value);
                    if (plrItem != null)
                    {
                        //Controllo se esiste il META altrimenti lo costruisco
                        RevisioneMetaPromoLavorazioni? storeField = new RevisioneMetaPromoLavorazioni();
                        if (plrItem.Meta != null)
                        {
                            //storeField = JsonConvert.DeserializeObject<List<RevisioneCampiOffertaFromIndd>>(plrItem.Meta);
                            storeField = MetaPromoLavorazioni.leggi(plrItem.Meta!);
                        }
                        else
                        {
                            storeField = new RevisioneMetaPromoLavorazioni();
                            storeField.campiOfferta = new List<RevisioneCampiOffertaFromIndd>();
                            storeField.foto = new List<RevisioneFotoFromIndd>();
                            storeField.ps = new List<RevisioneSelezioneFotoFromIndd>();
                        }

                        if (operazione.TipoOperazione == (Byte)tipoOperazione.revisioneCampiOfferta)
                        {
                            RevisioneCampiOffertaFromIndd? revField = JsonConvert.DeserializeObject<RevisioneCampiOffertaFromIndd>(operazione.FormData!);

                            var fieldGiaEsistente = storeField!.campiOfferta!.FirstOrDefault(s => s.label == revField!.label);
                            if (fieldGiaEsistente == null)
                            {
                                storeField.campiOfferta!.Add(revField!);
                            }
                            else
                            {
                                fieldGiaEsistente.valore = revField!.valore;
                                fieldGiaEsistente.valoreIndd = revField.valoreIndd;
                                fieldGiaEsistente.valoreInddSoloFondamentali = revField.valoreInddSoloFondamentali;
                                fieldGiaEsistente.labelUniversale = revField.labelUniversale;
                                fieldGiaEsistente.label = revField.label;
                            }
                        }
                        else if (operazione.TipoOperazione == (Byte)tipoOperazione.updateFoto || operazione.TipoOperazione == (Byte)tipoOperazione.eliminaFotoExtra)
                        {
                            RevisioneFotoFromIndd? upFotoField = JsonConvert.DeserializeObject<RevisioneFotoFromIndd>(operazione.FormData!);
                            if (upFotoField!.tipo == TipoFoto.Foto) //per ora le foto extra non si registrano nei meta, da correggere in futuro
                            {
                                var fieldGiaEsistente = storeField!.foto!.FirstOrDefault(s => s.codRef == upFotoField.codRef && s.tipo == upFotoField.tipo);
                                if (fieldGiaEsistente == null)
                                {
                                    storeField.foto!.Add(upFotoField);
                                }
                                else
                                {
                                    fieldGiaEsistente.nomeFoto = upFotoField.nomeFoto;
                                    fieldGiaEsistente.guidId = upFotoField.guidId;
                                }
                            }
                        }
                        else if (operazione.TipoOperazione == (Byte)tipoOperazione.updatePS)
                        {
                            List<RevisioneSelezioneFotoFromIndd>? upPSFieldList = MetaPromoLavorazioni.leggiSelezioniFoto(operazione.FormData!);
                            foreach (var upPSField in upPSFieldList!)
                            {
                                var fieldGiaEsistente = storeField!.ps!.FirstOrDefault(s => s.codRef == upPSField.codRef);

                                if (fieldGiaEsistente == null)
                                {
                                    storeField.ps!.Add(upPSField);
                                }
                                else
                                {
                                    fieldGiaEsistente.stato = upPSField.stato;
                                    fieldGiaEsistente.noRender = upPSField.noRender;
                                }
                            }
                        }
                        else if (operazione.TipoOperazione == (Byte)tipoOperazione.rimuoviMetaFoto)
                        {
                            RevisioneFotoFromIndd? upFotoField = JsonConvert.DeserializeObject<RevisioneFotoFromIndd>(operazione.FormData!);
                            var fieldGiaEsistente = storeField!.foto!.FirstOrDefault(s => s.codRef == upFotoField!.codRef && s.tipo == upFotoField.tipo);
                            if (fieldGiaEsistente != null)
                            {
                                storeField.foto!.Remove(fieldGiaEsistente);
                            }

                        }
                        plrItem.Meta = JsonConvert.SerializeObject(storeField);
                        this.ctx2.SaveChanges();
                    }
                    else
                    {
                        //Non dovremmo mai e poi mai trovarci qui. Salterebbe il controllo almeno due chiamate prima di questa
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine("Errore durante l'aggiunta dell'operazione: " + ex.ToString());
            }


            return operazione.Id;
        }

        public bool updateOperazione(int idOperazione, statoOperazioni stato, string session)
        {
            if (session == null || session.ToLower() == "no session")
            {
                return false;
            }
            var operazione = this.ctx.RegistroOperazionis.Where(f=>f.Id == idOperazione).FirstOrDefault();
            if (operazione == null)
            {
                return false;
            }
            operazione.Stato = (byte)stato;
            operazione.Esecutore = int.Parse(session);
            //var data = DateTime.Now;
            //string dataFormattata = data.ToString("dd/MM/yyyy HH:mm:ss");
            operazione.Data_Esecuzione = DateTime.Now;// dataFormattata;
            this.ctx.SaveChanges();
            return true;
        }

        public OperazioniResult getOperazioni(OperazioneQuery query)
        {
            var result = new OperazioniResult();

            try
            {
                var dbQuery = this.ctx.RegistroOperazionis.AsQueryable();

                dbQuery = dbQuery.Where(x => x.TipoOperazione == query.TipoOperazione);

                if (!string.IsNullOrEmpty(query.CodiceAssociato))
                {
                    dbQuery = dbQuery.Where(x => x.CodiceAssociato == query.CodiceAssociato);
                }

                if (query.IdTracciato.HasValue)
                {
                    dbQuery = dbQuery.Where(x => x.IdTracciato == query.IdTracciato.Value);
                }

                if (query.idPromoLavorazione.HasValue)
                {
                    dbQuery = dbQuery.Where(x => x.idPromoLavorazione == query.idPromoLavorazione.Value);
                }

                if (query.idPromoLavorazioniRecord.HasValue)
                {
                    dbQuery = dbQuery.Where(x => x.idPromoLavorazioniRecord == query.idPromoLavorazioniRecord.Value);
                }


                if (query.Area != null)
                {
                    dbQuery = dbQuery.Where(x => x.Area == query.Area);
                }
                else
                {
                    dbQuery = dbQuery.Where(x => x.Area == "");
                }


                if (query.Canale != null)
                {
                    dbQuery = dbQuery.Where(x => x.Canale == query.Canale);
                }
                else
                {
                    dbQuery = dbQuery.Where(x => x.Canale == "");
                }

                List<RegistroOperazioni> op = dbQuery.ToList();
                foreach (var item in op)
                {
                    operazioneUtente operazione = new operazioneUtente();
                    operazione.operazione = item;
                    if(item.Esecutore.HasValue)
                    {
                        operazione.nomeUtenteEsecutore = getNomeUtente(item.Esecutore.Value);
                    }
                    else
                    {
                        operazione.nomeUtenteEsecutore = getNomeUtente(item.Autore);
                    }

                    operazione.nomeUtenteRichiedente = getNomeUtente(item.Autore);
                    
                    result.operazioni.Add(operazione);
                }
                result.esito = true;
            }
            catch (Exception ex)
            {
                result.esito = false;
                result.errors.Add("Errore durante la ricerca: " + ex.Message);
                result.operazioni = new List<operazioneUtente>();
            }

            return result;
        }

        public string getNomeUtente(int id)
        {
            var utente = this.ctx.Utentis.Where(f => f.Id == id).FirstOrDefault();
            var nomeUtente = utente != null ? utente.NomeUtente: "Utente non trovato";
            return nomeUtente;

        }
    }
}
