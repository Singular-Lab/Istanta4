using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Dynamic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using IstantaLib;

namespace AgenziaLib.Tipi
{


    public static class GLOBAL_VARIABLES
    {
        public static readonly Byte maxSimultaneousOperationRequestOfElaboration = 1;//3;
        public static readonly Byte maxSimultaneousOperationRequestOfIO = 20;
        public static readonly Int16 updateToPercentageRange = 10;//Aggiornare le percentuali delle operazioni ogni 10%
        public static readonly String[] tracciatiExcelCellsTemplate = new String[] { "A:AREA", "B:INIZIATIVA", "C:DESCRIZIONE_INIZIATIVA", "D:SEZ_DATA_DA", "E:SEZ_DATA_A", "F:GRUPPO_SITI", "G:CODSCATTO", "H:REPARTO", "I:DESCRIZIONE_REPARTO", "J:SETTORE", "K:DESCRIZIONE_SETTORE", "L:PRODOTTO_MERCATO", "M:EAN", "N:NOME_FOTO", "O:CODRADICE", "P:CODVV", "Q:NOME" };//, "R:PESO_TOTALE", "S:UNITA_MISURA", "T:UNITA_FATT", "U:TEMA", "V:PREZZO_NORMALE", "W:PREZZO_PROM_MASS_MARKET", "X:PREZZO_PROM_FIDELITY", "Y:N_MASS_MARKET", "Z:M_MASS_MARKET", "AA:N_FIDELITY", "AB:M_FIDELITY", "AC:VALORE_SCONTO_MASS_MARKET", "AD:TIPO_SCONTO_MASS_MARKET", "AE:VALORE_SCONTO_FIDELITY", "AF:TIPO_SCONTO_FIDELITY", "AG:RANGE_1", "AH:PUNTI_1", "AI:RANGE_2", "AJ:PUNTI_2", "AK:TIPO_PUNTI", "AL:LIMITE_QTA", "AM:CONAD_CARD", "AN:PAGHI", "AO:ANZICHE", "AP:PREZZO_OFFERTA_KG_LT1", "AQ:PREZZO_BASE_KG_LT1", "AR:NOTA_CATEGORY", "AS:FOTO", "AT:NAZ", "AU:RUOLO", "AV:ESEMPIO", "AW:NUMERO_PAGINA", "AX:POSIZIONE_PAGINA", "AY:SCONTO_AG", "AZ:BRAND", "BA:TIPO_GUSTO", "BB:GRAMMATURA", "BC:MECCANICA", "BD:TIPO_VOLANTINO", "BE:TIPO_TEMA", "BF:FUORI_BANCO", "BG:CODICERAGMIXMATCH", "BH:SEGMENTO", "BI:TIPO_COMUNICAZIONE", "BJ:DESCRIZIONE_REGIONALE", "BK:UNITA_MISURA_COMUNICAZIONE", "BL:PREZZO_UNITA_MISURA_COMUNICAZIONE", "BM:ANZICHE_UNITA_MISURA_COMUNICAZIONE", "BN:DISTINTIVITA", "BO:SEZIONE_VOLANTINO", "BP:ID_PRESTAZIONE", "BQ:TIPO_RIGA", "BR:PROMOTION_PLAN", "BS:FILE_IMMAGINI", "BT:FLAG_PRENOTAZIONE", "BU:CODICE_ARTICOLO_POP" };

        //Chiavi da ricercare nei riferimento del dato json dinamico

        public static readonly string keyRef = "Referenza";
        public static readonly string keyRefCodice = "Referenza.Codice";
        public static readonly string keyRefEan = "Referenza.Ean";
        public static readonly string keyRefId = "Referenza.Id";

       public static readonly string keyCompiled = "Compiled";

        public static readonly string keyDescr1 = "Descrizioni.Descrizione1";
        public static readonly string keyDescr2 = "Descrizioni.Descrizione2";
        public static readonly string keyDescr3 = "Descrizioni.Descrizione3";
        public static readonly string keyDescr4 = "Descrizioni.Descrizione4";
        public static readonly string keyDescr1Tracciato = "Descrizioni.Descrizione1Tracciato";
        public static readonly string keyDescr2Tracciato = "Descrizioni.Descrizione2Tracciato";
        public static readonly string keyDescr3Tracciato = "Descrizioni.Descrizione3Tracciato";
        public static readonly string keyDescr4Tracciato = "Descrizioni.Descrizione4Tracciato";
        public static readonly string keyDescr1Gruppo = "Descrizioni.Descrizione1GruppoTracciato";
        public static readonly string keyDescr2Gruppo = "Descrizioni.Descrizione2GruppoTracciato";
        public static readonly string keyDescr3Gruppo = "Descrizioni.Descrizione3GruppoTracciato";
        public static readonly string keyDescr4Gruppo = "Descrizioni.Descrizione4GruppoTracciato";
        public static readonly string keyUmGruppo = "Descrizioni.UmGruppoTracciato";
        public static readonly string keyPesoGruppo = "Descrizioni.PesoGruppoTracciato";
        public static readonly string keyDescrIndd = "Descrizioni.DescrizioneIndd";


        public static readonly string keyDescrGruppo = "Descrizioni.Gruppo";
        public static readonly string keyDescrUm = "Descrizioni.Um";
        public static readonly string keyDescrPeso = "Descrizioni.Peso";

        //I20-1000: la chiave core che per edro21 ha sostituito la custom nome_foto. Le liste
        //vecchie portano ancora quella, le nuove questa, e per un po' girano insieme.
        public static readonly string keyFotoSelezioneDaTracciato = "Foto.SelezioneDaTracciato";
        public static readonly string keyDescrUmGruppo = "Descrizioni.UmGruppo";
        public static readonly string keyDescrPesoGruppo = "Descrizioni.PesoGruppo";

        public static readonly string keyScattoCodice = "Scatto.Codice";
        public static readonly string keyScattoCodiceGruppo = "Scatto.CodiceGruppo";
        public static readonly string keyScattoCodiceMultiplex = "Scatto.CodiceGruppoMultiplex";
        public static readonly string keyFuoriPoP = "FuoriPoP";
        public static readonly string codiceBox = "codiceBox";

        public static readonly string keyTracciatoFirma = "Tracciato.Firma";

        public static readonly string keyFotoNome = "Foto.Nome";
        public static readonly string keyIndiceOrdinamento = "IndiceOrdinamento";
        public static readonly string keyFotoExtraAuto = "Foto.ExtraAuto";        

        //Con queste combinazioni di chiave, si chiede al core di recuperare la descrizione dall'archivio per far uscire le ref indicate con questo attributo
        public static readonly string keyRequisitoPrezziDiversi = "PrezziDiversi";//Se true indica che i prezzi sono diversi
        public static readonly string keyRequisitoScontiDiversi = "ScontiDiversi";//Se true indica che i prezzi sono diversi
        public static readonly string keyRequisitoDescrizioneSingola = "DescrizioneSingola";//Richiesta descrizione singola
        public static readonly string keyRequisitoDescrizioneSottogruppo = "DescrizioneSottoGruppo";//Richiesta descrizione del sottogruppo di appartenenza
        public static readonly string keyRequisitoDescrizioneGruppo = "DescrizioneGruppo";//Richiesta descrizione del proprio gruppo
        public static readonly string keyRequisitoDescrizioneGruppoMultiplex = "DescrizioneGruppoMultiplex";//Richiesta descrizione del gruppo multiplex di appartenenza

        public static readonly string keyScattoCodiceSottogruppo = "Scatto.CodiceSottogruppo";
        public static readonly string keyXMLSelezione = "StatoSelezione";
        public static readonly string keyHasFoto = "HasFoto";
        public static readonly string keyXMLDescrizioneGruppo = "descrizione_gruppo";
        public static readonly string keySyncFromIndd = "SyncFromIndd";
        //public static readonly string keySelezioneMenabo = "selezione_menabo";
        public static readonly string keyFirmaGruppo = "firma_gruppo";
        public static readonly string keySiglaReparto = "sigla_reparto";
        public static readonly string combinazioneAssegnata = "combinazioneAssegnata";


    }
    public class DbAree
    {
        public List<AreaItem> source;
    }

    public class DbACPV
    {
        public List<Area> aree { get; set; }
        public List<Canale> canali { get; set; }

        public List<CombinazioneAreaCanale> combinazioni { get; set; }

    }
    public class CombinazioneAreaCanale
    {
        public string guidID { get; set; } = "";
        public string guidIDArea { get; set; } = "";
        public string guidIDCanale { get; set; } = "";
        public bool enabled { get; set; }

    }

    public class DbTipoDiExport
    {
        public List<TipoDiExport> source { get; set; } = new List<TipoDiExport>();
    }

    public class DbLoghiBolli
    {
        public List<LogoBollo> source { get; set; } = new List<LogoBollo>();
    }
    public class DbFormati
    {
        public List<Formato> source { get; set; } = new List<Formato>();
    }

    public class AreaItem
    {
        public int Id;
        public int GruppoSiti;
        public string Area;
        public string Canale;
    }
    public class DbMastro
    {
        public List<Mastro> source;
    }

    public class Mastro
    {
        public short Id;
        public string Nome;

    }


    public class DbOrdinamento
    {
        public List<Ordinamento> source;
        public List<SezioneOrdinamento> sezioni;
    }

    public class SezioneOrdinamento
    {
        public Int16 indice;
        public string nome;        
    }
    public class Ordinamento
    {
        public Int32 Id;
        public Int16 Indice;
        public Int16 GlobalIndice;
        //public Int16 NumeroReparto;
        //public Int16 NumeroSettore;
        public string Gruppo;
        public int numeroReparto;
        public int numeroSettore;
        public string CodiceSegmento;
        public bool Food;
        public bool NoFood;
        public bool Fluff;
    }

    public class DbOrdinamentoDocRoma
    {
        public List<OrdinamentoDocRoma> source;
    }

    public class OrdinamentoDocRoma
    {
        public string chiave;
        public string valore;
        public List<OrdinamentoDocRoma> sottochiavi;
    }

    public class Tracciato
    {
        public string NomeEsportazione;

        public string Area;
        public string Canale;
        public string guidArea;
        public string guidCanale;
        public DateTime DataDa;
        public DateTime DataA;
        public string DescrizioneIniziativa;
        public string Iniziativa;
        public Byte Tipo;
        public bool Promozione50Al50;

        public List<Dictionary<string, object>> Records=new List<Dictionary<string, object>>();
        public PopCombinazione combinazionePop;
    }

    public class ImportResult
    {
        public string errors = "";
        public List<Tracciato> liste = new List<Tracciato>();
    }

    public class ExportResult
    {
        public string errors = "";
        public List<Tracciato> liste = new List<Tracciato>();
    }

    public enum TipoImportazione
    {
        Vol = 1,
        PoP = 2,
        Manifesto = 3
    }

    public enum TipoSelezioneMenabo
    {
        Primaria = 1,
        Secondaria = 2,
        None = 3
    }

    public enum TipoLavorazione
    {
        Volantino = 1,
        PoP = 2
    }

    public enum AskFoto
    {
        noAsked = 0,
        FotoPresente = 1,
        FotoNonPresente = 2
    }

    public class DbMeccaniche
    {
        public List<Meccanica> source;
    }

    public partial class Meccanica
    {
        public short Id;
        public string NomeOrigine;
        public string NomeTraduzione;
        public string Mastro;
        public bool grafica_50_al_50;
    }

    public class PopMateriale
    {
        public int Id;
        public string Nome;
        public string Codice;
        public Byte Associazione;
        public int EreditaDa;
    }
    public class PopCategoria
    {
        public int Id;
        public string Nome;

    }

    public class PopFormato
    {
        public int Id;
        public string Nome;
    }

    public class DbPopCombinazioni
    {
        public List<PopMateriale> Materiali;
        public List<PopFormato> Formati;
        public List<PopCategoria> Categorie;
        public List<PopCombinazione> Combinazioni;
        public Dictionary<string, object> Options;
    }

    public class PopCombinazione
    {
        public int Id;
        public int IdMateriale;
        public int IdArea;
        public int IdCategoria;
        public int IdFormato;
        public bool Attivo;
        public Dictionary<string, object> Options=new Dictionary<string, object>();
    }


    class DynamicDictionaryWrapper : DynamicObject
    {
        protected readonly Dictionary<string, object> _source;

        public DynamicDictionaryWrapper(Dictionary<string, object> source)
        {
            _source = source;
        }

        public override bool TryGetMember(GetMemberBinder binder, out object result)
        {
            result = null;
            _source.TryGetValue(binder.Name, out result);
            if (result == null)
                result = "";
            return true;
        }
    }

    class csvDataset
    {
        public List<string> header = new List<string>();
        public List<string> headerField = new List<string>();
        public List<Dictionary<string,string>> records = new List<Dictionary<string, string>>();
    }

    class FieldTagContent
    {
        string val;
        public FieldTagContent(string tagStyle, string content)
        {
            if (tagStyle!="")
            {
                if (content == "" || content == null)
                {
                    val = "";
                }
                else
                {
                    val = $"<{tagStyle}>{content}</{tagStyle}>";
                }
            }
            else
            {
                val = content;
            }
        }

        public override string ToString()
        {
            return val.ToString();
        }
    }

}
