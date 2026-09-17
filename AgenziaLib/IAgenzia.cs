using IstantaLib;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace AgenziaLib
{
    class AlterazioniRecFromIndd
    {
        public Int64 IdRec;//Riferito a ID Promo Record Tracciati del core
        public string codice;
        public string codiceGruppo;
        public Dictionary<string, object> indd;
        public Dictionary<string, object> requisiti;
    }

    class RisultatoAlterazioniTracciatoFromIndd
    {
        public List<AlterazioniRecFromIndd> alterazioniInIndd=new List<AlterazioniRecFromIndd>();
    }



    public interface IAgenzia
    {
        string importaTracciato(List<Dictionary<string, object>> tracciato, Dictionary<string,string> formRequest, List<FicoContextField> context, List<FicoContextField> contextPromo, string pathACPV, string pathOrdinamentoLista, string pathMeccaniche, string pathTraduttoreAC);
        //TracciatoResultKit esportaVolantino(List<FicoContextField> promoContext, List<FicoContextField> tracciatoContext, List<ArticoloInKit> tracciato, FicoCombinazioneKit kit, string pathNamingConvention, string pathACPV, string pathTipiDiExport, string pathOrdinamentoLista, string pathMeccaniche, string pathLoghiBolli, FicoCombinazioneKitReadMode readMode);
        TracciatoResultKit esportaVolantino(List<FicoContextField> promoContext, List<FicoContextField> tracciatoContext, List<ArticoloInKit> tracciato, FicoRuntimeKit kit, string pathNamingConvention, string pathACPV, string pathTipiDiExport, string pathOrdinamentoLista, string pathMeccaniche, string pathLoghiBolli, string pathMappaStili, FicoCombinazioneKitReadMode readMode);
        TracciatoResultKit esportaPoP(List<FicoContextField> promoContext, List<FicoContextField> tracciatoContext, List<ArticoloInKit> tracciato, FicoRuntimeKit kit, string pathNamingConvention, string pathACPV, string pathTipiDiExport, string pathOrdinamentoLista, string pathMeccaniche, string pathLoghiBolli, string pathFormati, string pathMappaStili, FicoCombinazioneKitReadMode readMode);

        string getAlterazioniTracciatoFromIndd(List<Dictionary<string, object>> gruppo, Dictionary<string, object> articoloIndd);
        string eseguiAutoSelezioneGruppo(List<Dictionary<string, object>> gruppo, List<Dictionary<string, object>> ghost);
        List<List<Dictionary<string, object>>> eseguiAutoSelezioneGruppoMassiva(List<List<Dictionary<string, object>>> gruppo, List<Dictionary<string, object>> ghost);
        //string confrontaListe(List<Dictionary<string, object>> primario, List<Dictionary<string, object>> secondario, bool controlloVersione, Dictionary<string, string> reqParams);
        AnalisiConfrontoResponse confrontaListe(AnalisiConfrontoTracciatoDetails primario, AnalisiConfrontoTracciatoDetails secondario, bool controlloVersione, Dictionary<string, string> reqParams);
        string confrontaListatoVolantino(List<Dictionary<string, object>> primario, Dictionary<string, string> reqParams);
        string ordinaLista(List<Dictionary<string, object>> listRecs, string pathOrdinamentoLista);

        AnalisiPorpagazioneResult analizzaPropagazionePerCambioMeta(AnalisiPorpagazione analisiAzione, List<CambioMetaRecordTracciatoAzione> azione);
        AnalisiPorpagazioneResult analizzaPropagazionePerModificaCampiOfferta(AnalisiPorpagazione analisiAzione, RevisioneCampiOffertaFromIndd azione);
        AnalisiPorpagazioneResult analizzaPropagazionePerRevisione(AnalisiPorpagazione analisiAzione, RevisioneDescrizione azione);

        List<q_records_per_getListaRevisione> specificaInOutVol(List<q_records_per_getListaRevisione> tracciatoSingoli, List<q_records_per_getListaRevisione> listaOrigine);

        List<colonnaReportImportazione> getColonneReportImportaziones();

        string callbackNamingConventionDynamicField(string campo, Dictionary<string, object> rec, List<FicoCombinazioniKitDeclinazioneProprieta> propsDeclinazione);

        List<Dictionary<string, object>> elaboraTracciatiRecords(List<Dictionary<string, object>> records, FicoRuntimeKit kit, string pathACPV);// string siglaAreaKit);

        Dictionary<string, object> elaboraRecordDaClonare(Dictionary<string, object> origin, Dictionary<string, object> chiaviEliminate, SampleKitDiDestinazioneClone sample, string codiceBox, string pathOrdinamentoLista);//codiceBox da InDesign ed è composto da regola CORE con <CODICE BOX CSS> ma a seguito del carattere "#" un aggiunta customm SE questa aggiunta è prevista
        List<CambioStrutturale> GetCambioStrutturalePath();//codiceBox da InDesign ed è composto da regola CORE con <CODICE BOX CSS> ma a seguito del carattere "#" un aggiunta customm SE questa aggiunta è prevista
        string MetaPerRevisione( List<Dictionary<string, object>> recordsGruppo, int idPromo, int idTracciato, string siglaTracciato);
        EsitoFirmaGarantita CheckFirmaGarantita(List<Dictionary<string, object>> recordsGruppo, string meta);
        string GetMetaPerRevisioneDaGruppiMultipli(WrapperPerGetGarante wrap);

        string GetMetaPerRevisioneDaGruppiMultipliBatch(WrapperBatchPerGetGarante batch);
        List<Dictionary<string, object>> FiltraRecordsPerConteggioRevisione(List<Dictionary<string, object>> records, string utente);
        string CheckFirmaPluginGarantitaBatch(WrapperBatchCheckFirmaPlugin batch);
    }
}
