using DocumentFormat.OpenXml.Bibliography;
using Microsoft.AspNetCore.Mvc.ApiExplorer;
using Microsoft.VisualBasic;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using IstantaLib;
using DocumentFormat.OpenXml.Office2010.Excel;
using DocumentFormat.OpenXml.Wordprocessing;
using System.Reflection;
using Istanta.Utility;

namespace Istanta.Models
{

    public class ExternalSourceClass
    {
        private readonly string[] COMMANDS = new string[] { "getAree", "getMastro", "getGrammature", "getMeccaniche" };
        private string pathExternal;

        private Dictionary<string, JObject> Sources = new Dictionary<string, JObject>();

        public ExternalSourceClass(string pathExternalSource)
        {
            this.pathExternal = pathExternalSource;
        }
        public ExternalSourceClass(string pathExternalSource, string[] sources)
        {
            this.pathExternal = pathExternalSource;
            foreach (string s in sources)
            {
                JObject o1 = JObject.Parse(System.IO.File.ReadAllText($"{this.pathExternal}{s}.json"));
                Sources[s] = o1;
            }
        }

        private void RefreshSources()
        {
            foreach (string s in this.Sources.Keys)
            {
                JObject o1 = JObject.Parse(System.IO.File.ReadAllText($"{this.pathExternal}{s}.json"));
                Sources[s] = o1;
            }
        }

        public object Exec(string command)
        {
            if (COMMANDS.Contains(command))
            {
                switch (command)
                {
                    case "getAree":
                        return getAree();
                    case "getMastro":
                        return getMastro();
                    case "getMeccaniche":
                        return getMeccaniche();
                    default:
                        return "no command implemented";
                }
            }
            else
            {
                return "command not exist";
            }
        }

        #region FICO ACPV
        public DbACPV getACPV()
        {
            JObject? o1 = JObject.Parse(System.IO.File.ReadAllText(this.pathExternal + "Source" + DbACPV.dbSourceName));
            DbACPV? acpvDB = o1.ToObject<DbACPV>();
            acpvDB!.SetExternalPath(this.pathExternal);
            return acpvDB;
        }

        #endregion

        #region FICO Promo process
        public DbLabels getLabels()
        {
            JObject? o1 = JObject.Parse(System.IO.File.ReadAllText(this.pathExternal + "Source" + DbLabels.dbSourceName));
            DbLabels? lblDB = o1.ToObject<DbLabels>();
            return lblDB!;
        }

        public DbFormati getFormati()
        {
            if (!File.Exists(this.pathExternal + "Source" + DbFormati.dbSourceName))
            {
                DbFormati crea = new DbFormati();
                crea.SetExternalPath(this.pathExternal);
                crea.SaveChanges();
            }

            JObject? o1 = JObject.Parse(System.IO.File.ReadAllText(this.pathExternal + "Source" + DbFormati.dbSourceName));
            DbFormati? fmtDB = o1.ToObject<DbFormati>();
            fmtDB!.SetExternalPath(this.pathExternal);

            return fmtDB!;
        }

        public DbLoghiBolli getLoghiBolli()
        {
            if (!File.Exists(this.pathExternal + "Source" + DbLoghiBolli.dbSourceName))
            {
                DbLoghiBolli crea = new DbLoghiBolli();
                crea.SetExternalPath(this.pathExternal);
                crea.SaveChanges();
            }

            JObject? o1 = JObject.Parse(System.IO.File.ReadAllText(this.pathExternal + "Source" + DbLoghiBolli.dbSourceName));
            DbLoghiBolli? dbLB = o1.ToObject<DbLoghiBolli>();
            dbLB!.SetExternalPath(this.pathExternal);
            return dbLB!;
        }

        public DbTipoDiExport getTipiDiExport()
        {
            if (!File.Exists(this.pathExternal + "Source" + DbTipoDiExport.dbSourceName))
            {
                DbTipoDiExport crea = new DbTipoDiExport();
                crea.SetExternalPath(this.pathExternal);
                crea.SaveChanges();
            }

            JObject? o1 = JObject.Parse(System.IO.File.ReadAllText(this.pathExternal + "Source" + DbTipoDiExport.dbSourceName));
            DbTipoDiExport? fmtDB = o1.ToObject<DbTipoDiExport>();
            fmtDB!.SetExternalPath(this.pathExternal);
            return fmtDB;
        }

        public DbDeclinazioniKit getDeclinazioniKit()
        {
            if (!File.Exists(this.pathExternal + "Source" + DbDeclinazioniKit.dbSourceName))
            {
                DbDeclinazioniKit crea = new DbDeclinazioniKit();
                crea.SetExternalPath(this.pathExternal);
                crea.SaveChanges();
            }

            JObject? o1 = JObject.Parse(System.IO.File.ReadAllText(this.pathExternal + "Source" + DbDeclinazioniKit.dbSourceName));
            DbDeclinazioniKit? fmtDB = o1.ToObject<DbDeclinazioniKit>();
            fmtDB!.SetExternalPath(this.pathExternal);
            return fmtDB;
        }

        public DbNamingConvention getNamingConvention()
        {
            if (!File.Exists(this.pathExternal + "Source" + DbNamingConvention.dbSourceName))
            {
                DbNamingConvention crea = new DbNamingConvention();
                crea.SetExternalPath(this.pathExternal);
                crea.SaveChanges();
            }

            JObject? o1 = JObject.Parse(System.IO.File.ReadAllText(this.pathExternal + "Source" + DbNamingConvention.dbSourceName));
            DbNamingConvention? dbNC = o1.ToObject<DbNamingConvention>();
            dbNC!.SetExternalPath(this.pathExternal);
            return dbNC;
        }


        #endregion

        #region Aree

        public DbAree getAree()
        {
            JObject? o1 = JObject.Parse(System.IO.File.ReadAllText(this.pathExternal + "SourceAree.json"));
            DbAree? areeDB = o1.ToObject<DbAree>();
            return areeDB!;
        }
        public Aree getAreaById(int id)
        {
            var _source = getAree().source;
            return _source!.Find(m => m.Id == id)!;
        }
        public Aree getAreaByCombinazioneAreaCanale(string area, string canale)
        {
            var _source = getAree().source;
            return _source.Find(m => m.Area == area && m.Canale == canale)!;
        }

        public Aree getAreaByGruppoSiti(Int16 id)
        {
            var _source = getAree().source;
            return _source.Find(m => m.GruppoSiti == id)!;
        }
        public void addArea(Aree item)
        {
            var db = getAree();
            var _source = db.source;

            var _last = _source.OrderByDescending(o => o.Id).FirstOrDefault();
            item.Id = _last != null ? _last.Id + 1 : 1;

            _source.Add(item);

            saveAree(db);
        }

        public void editArea(Aree item)
        {
            var db = getAree();
            var itemDb = db.source.Find(m => m.Id == item.Id);
            itemDb!.Canale = item.Canale;
            itemDb.Area = item.Area;
            itemDb.GruppoSiti = item.GruppoSiti;

            saveAree(db);
        }

        public void deleteArea(Aree item)
        {
            var db = getAree();
            db.source.Remove(db.source.Find(m => m.Id == item.Id)!);

            saveAree(db);
        }

        void saveAree(DbAree db)
        {
            string jsonStr = JsonConvert.SerializeObject(db);

            using (StreamWriter sw = new StreamWriter(this.pathExternal + "SourceAree.json", false))
            {
                sw.WriteLine(jsonStr);
            }
        }

        #endregion

        #region Mastro
        public JObject getSource(string nomeSource)
        {
            return Sources[nomeSource];
        }

        public DbMastro getMastro()
        {
            JObject? o1 = JObject.Parse(System.IO.File.ReadAllText(this.pathExternal + "SourceMastro.json"));
            DbMastro? mastroDB = o1.ToObject<DbMastro>();

            return mastroDB!;
        }
        public DbMastroItem getMastroById(int id)
        {
            var _source = getMastro().source;
            return _source.Find(m => m.Id == id)!;
        }
        public DbMastroItem getMastroByName(string id)
        {
            var _source = getMastro().source;
            return _source.Find(m => m.Nome == id)!;
        }

        public DbMastroItem getMastroByNameAndFormato(string id, string formato)
        {
            var _source = getMastro().source;
            return _source.Find(m => m.Nome == id && m.Formato == formato)!;
        }

        public Int64 getLastMastroId()
        {
            var _last = getMastro().source.OrderByDescending(m => m.Id).FirstOrDefault();
            return (_last != null ? _last.Id + 1 : 1);
        }

        public void addMastro(DbMastroItem item)
        {
            var db = getMastro();
            var _source = db.source;

            var _last = _source.OrderByDescending(o => o.Id).FirstOrDefault();
            item.Id = _last != null ? _last.Id + 1 : 1;

            _source.Add(item);

            saveMastro(db);
        }

        public void editMastro(DbMastroItem item)
        {
            var db = getMastro();
            var dbItem = db.source.Find(m => m.Id == item.Id);


            dbItem!.Nome = item.Nome;
            dbItem.Formato = item.Formato;
            dbItem.MeccanicaDefault = item.MeccanicaDefault;
            dbItem.Active = item.Active;
            dbItem.Associazioni = item.Associazioni;

            saveMastro(db);
        }

        public void deleteMastro(DbMastroItem item)
        {
            var db = getMastro();
            var mastro = db.source.Find(m => m.Id == item.Id);
            //db.source.Remove(db.source.Find(m => m.Id == item.Id));
            mastro!.Active = false;
            saveMastro(db);
        }

        void saveMastro(DbMastro db)
        {
            string jsonStr = JsonConvert.SerializeObject(db);

            using (StreamWriter sw = new StreamWriter(this.pathExternal + "SourceMastro.json", false))
            {
                sw.WriteLine(jsonStr);
            }
        }

        #endregion

        #region Meccaniche

        public DbMeccaniche getMeccaniche()
        {
            JObject? o1 = JObject.Parse(System.IO.File.ReadAllText(this.pathExternal + "SourceMeccaniche.json"));
            DbMeccaniche? meccanicheDB = o1.ToObject<DbMeccaniche>();
            return meccanicheDB!;
        }

        public Meccaniche getMeccanicaById(int id)
        {
            var _source = getMeccaniche().source;
            return _source.Find(m => m.Id == id)!;
        }
        public Meccaniche getMeccanicaByName(string id)
        {
            var _source = getMeccaniche().source;
            return _source.Find(m => m.NomeOrigine == id)!;
        }

        public void addMeccanica(Meccaniche item)
        {
            var db = getMeccaniche();
            var _source = db.source;
            var _last = _source.OrderByDescending(o => o.Id).FirstOrDefault();
            item.Id = _last != null ? _last.Id + 1 : 1;
            _source.Add(item);

            saveMeccaniche(db);
        }

        public void editMeccanica(Meccaniche item)
        {
            var db = getMeccaniche();
            var itemDb = db.source.Find(m => m.Id == item.Id);
            itemDb!.NomeOrigine = item.NomeOrigine;
            itemDb.NomeTraduzione = item.NomeTraduzione;
            itemDb.Aree = item.Aree;
            itemDb.Formato = item.Formato;

            saveMeccaniche(db);
        }

        public void deleteMeccanica(Meccaniche item)
        {
            var db = getMeccaniche();
            db.source.Remove(db.source.Find(m => m.Id == item.Id)!);

            saveMeccaniche(db);
        }

        void saveMeccaniche(DbMeccaniche db)
        {
            string jsonStr = JsonConvert.SerializeObject(db);

            using (StreamWriter sw = new StreamWriter(this.pathExternal + "SourceMeccaniche.json", false))
            {
                sw.WriteLine(jsonStr);
            }
        }

        public string getFormatoMeccanica(string meccanica)
        {
            var db = getMeccaniche();
            var meccanicaItem = db.source.Where(f => f.NomeTraduzione == meccanica).FirstOrDefault();
            return (meccanicaItem != null ? meccanicaItem.Formato : "1x1")!;
        }

        public List<string> getAreeMeccanica(string meccanica)
        {
            var db = getMeccaniche();
            var meccanicaItem = db.source.Find(f => f.NomeTraduzione == meccanica);
            return (meccanicaItem != null ? meccanicaItem.Aree : new List<string>())!;
        }
        #endregion

        #region Combinazioni PoP

        public DbPopCombinazioni getCombinazioniPoP()
        {
            JObject? o1 = JObject.Parse(System.IO.File.ReadAllText(this.pathExternal + "SourceCombinazioniPoP.json"));
            DbPopCombinazioni? combDB = o1.ToObject<DbPopCombinazioni>();
            return combDB!;
        }

        public List<PopMateriale> getMateriali()
        {
            return getCombinazioniPoP().Materiali;
        }

        #endregion

        #region Regole Menabò
        public DbMenabo getRegoleMenabo()
        {
            JObject? o1 = JObject.Parse(System.IO.File.ReadAllText(this.pathExternal + "SourceMenabo.json")); // this.Sources["SourceMenabo"];
            DbMenabo? menaboDB = o1.ToObject<DbMenabo>();
            return menaboDB!;
        }

        public void addRegolaMenabo(DbMenaboItem item)
        {
            JObject o1 = this.Sources["SourceMenabo"];
            DbMenabo? menaboDB = o1.ToObject<DbMenabo>();

            var _last = menaboDB!.source.OrderByDescending(o => o.Id).FirstOrDefault();

            item.Id = _last != null ? _last.Id + 1 : 1;


            JObject? o2 = this.Sources["SourceMenaboPagine"];
            DbMenaboPagine? menaboPagDB = o2.ToObject<DbMenaboPagine>();

            var _lastSchemaPag = menaboPagDB!.source.OrderByDescending(o => o.Id).FirstOrDefault();

            DbMenaboPagineItem schemaPag = new DbMenaboPagineItem();
            schemaPag.Id = _lastSchemaPag != null ? _lastSchemaPag.Id + 1 : 1;
            schemaPag.Pagine = new List<DbMenaboPagineItemPagina>();
            schemaPag.Titolo = item.Titolo;

            menaboPagDB.source.Add(schemaPag);

            saveSchemaMenabo(menaboPagDB);


            item.IdMenaboPagine = schemaPag.Id;

            menaboDB.source.Add(item);


            saveMenabo(menaboDB);


        }


        public DbMenaboItem getMenaboById(int id)
        {
            DbMenabo menaboDB = getRegoleMenabo();
            return menaboDB.source.Where(m => m.Id == id).FirstOrDefault()!;
        }
        public bool editMenabo(DbMenaboItem item)
        {

            JObject? o2 = this.Sources["SourceMenabo"];
            DbMenabo? menaboDb = o2.ToObject<DbMenabo>();

            var dbExist = menaboDb!.source.Where(m => m.Id == item.Id).FirstOrDefault();
            if (dbExist != null)
            {
                dbExist.Aree = item.Aree;
                dbExist.Titolo = item.Titolo;
                saveMenabo(menaboDb);
                return true;
            }


            return false;
        }
        public void deleteMenabo(DbMenaboItem item)
        {
            var db = getRegoleMenabo();
            db.source.Remove(db.source.Find(m => m.Id == item.Id)!);
            saveMenabo(db);
        }


        public DbMenaboPagineItem getSchemaMenabo(Int64 id)
        {
            JObject? o1 = JObject.Parse(System.IO.File.ReadAllText(this.pathExternal + "SourceMenabo.json"));  //this.Sources["SourceMenabo"];
            DbMenabo? menaboDB = o1.ToObject<DbMenabo>();

            JObject? o2 = JObject.Parse(System.IO.File.ReadAllText(this.pathExternal + "SourceMenaboPagine.json")); //this.Sources["SourceMenaboPagine"];
            DbMenaboPagine? menaboPagineDb = o2.ToObject<DbMenaboPagine>();

            var mItem = menaboDB!.source.Where(m => m.IdMenaboPagine == id).FirstOrDefault();
            if (mItem != null)
            {
                var mpItem = menaboPagineDb!.source.Where(mp => mp.Id == mItem.IdMenaboPagine).FirstOrDefault();
                if (mpItem != null)
                {
                    return mpItem;
                }
                else
                {
                    throw new Exception("Schema pagine non trovato");
                }
            }
            else
            {
                throw new Exception("Menabo non trovato");
            }

        }


        public List<string> getFormatiPagina()
        {
            JObject? o1 = this.Sources["SourceMenabo"];
            DbMenabo? menaboDB = o1.ToObject<DbMenabo>();
            return menaboDB!.formatiMenaboPagina;
        }

        public void saveFormatiPagina(List<string> nuoviFormati)
        {
            JObject? o1 = this.Sources["SourceMenabo"];
            DbMenabo? menaboDB = o1.ToObject<DbMenabo>();
            menaboDB!.formatiMenaboPagina = nuoviFormati;
            saveMenabo(menaboDB);
        }

        public List<DbMenaboItem> getMenabos()
        {
            DbMenabo menaboDB = getRegoleMenabo();
            return menaboDB.source;
        }



        public bool addSchemaMenabo(DbMenaboPagineItem item)
        {
            item.Id = getIdMenaboSchemaProgressivo();

            JObject? o2 = this.Sources["SourceMenaboPagine"];
            DbMenaboPagine? menaboPagineDb = o2.ToObject<DbMenaboPagine>();


            menaboPagineDb!.source.Add(item);
            saveSchemaMenabo(menaboPagineDb);

            return true;
        }
        public bool editSchemaMenabo(DbMenaboPagineItem item)
        {

            JObject? o2 = this.Sources["SourceMenaboPagine"];
            DbMenaboPagine? menaboPagineDb = o2.ToObject<DbMenaboPagine>();

            var dbExist = menaboPagineDb!.source.Where(m => m.Id == item.Id).FirstOrDefault();
            if (dbExist != null)
            {
                dbExist.Pagine = item.Pagine;
                saveSchemaMenabo(menaboPagineDb);
                return true;
            }


            return false;
        }


        public Int64 getIdMenaboProgressivo()
        {
            JObject? o1 = this.Sources["SourceMenabo"];
            DbMenabo? _db = o1.ToObject<DbMenabo>();

            if (_db!.source.Count > 0)
            {
                return _db.source.OrderByDescending(s => s.Id).FirstOrDefault()!.Id + 1;
            }

            return 1;
        }
        public Int64 getIdMenaboSchemaProgressivo()
        {
            JObject? o1 = this.Sources["SourceMenaboPagine"];
            DbMenaboPagine? _db = o1.ToObject<DbMenaboPagine>();

            if (_db!.source.Count > 0)
            {
                return _db.source.OrderByDescending(s => s.Id).FirstOrDefault()!.Id + 1;
            }

            return 1;
        }

        public void saveMenabo(DbMenabo db)
        {
            string jsonStr = JsonConvert.SerializeObject(db);

            using (StreamWriter sw = new StreamWriter(this.pathExternal + "SourceMenabo.json", false))
            {
                sw.WriteLine(jsonStr);
            }

            this.RefreshSources();
        }

        public void saveSchemaMenabo(DbMenaboPagine db)
        {
            string jsonStr = JsonConvert.SerializeObject(db);

            using (StreamWriter sw = new StreamWriter(this.pathExternal + "SourceMenaboPagine.json", false))
            {
                sw.WriteLine(jsonStr);
            }

            this.RefreshSources();
        }

        #endregion

        #region Ordinamento universale
        public JsonDbClassificazioneUniversale getClassificazioneUniversale()
        {
            try
            {
                JObject? o1 = JObject.Parse(System.IO.File.ReadAllText(this.pathExternal + "SourceOrdinamentoLista.json"));
                JsonDbClassificazioneUniversale? DB = o1.ToObject<JsonDbClassificazioneUniversale>();
                return DB!;
            }
            catch
            {
                var classUniversale = new JsonDbClassificazioneUniversale();
                classUniversale.universale = false;
                classUniversale.bindings = new ClassificazioneBinding();
                classUniversale.bindings.area = new BindingItem();
                classUniversale.bindings.categoria = new BindingItem();
                classUniversale.bindings.reparto = new BindingItem();
                classUniversale.bindings.settore = new BindingItem();
                return classUniversale;
            }
        }
        public int addRuleToClassificatore(string bindingName, string definizione, string valoriDaCercare)
        {
            var db = getClassificazioneUniversale();
            BindingItemRule ruleItem = new BindingItemRule();
            ruleItem.definizione = definizione;
            ruleItem.valoridaRicercare = valoriDaCercare.Split(',').ToList();
            db.IdProg += 1;
            ruleItem.id = db.IdProg;
            if (bindingName == "area")
            {
                db.bindings!.area!.rules.Add(ruleItem);
            }
            else if (bindingName == "settore")
            {
                db.bindings!.settore!.rules.Add(ruleItem);
            }
            else if (bindingName == "reparto")
            {
                db.bindings!.reparto!.rules.Add(ruleItem);
            }


            saveClassificazioneUniversale(db);

            return db.IdProg;
        }
        public void deleteRuleOfClassificatore(string bindingName, int id)
        {
            var db = getClassificazioneUniversale();
            //db.bindings.Remove(db.bindings.Find(m => m.Id == id));
            if (bindingName == "area")
            {
                db.bindings!.area!.rules.Remove(db.bindings.area.rules.Find(m => m.id == id)!);
            }
            else if (bindingName == "settore")
            {
                db.bindings!.settore!.rules.Remove(db.bindings.settore.rules.Find(m => m.id == id)!);

            }
            else if (bindingName == "reparto")
            {
                db.bindings!.reparto!.rules.Remove(db.bindings.reparto.rules.Find(m => m.id == id)!);
            }

            saveClassificazioneUniversale(db);
        }
        public void editRuleOfClassificatore(string bindingName, int id, string valoriDaCercare)
        {
            var db = getClassificazioneUniversale();
            //db.bindings.Remove(db.bindings.Find(m => m.Id == id));
            if (bindingName == "area")
            {
                var item = db.bindings!.area!.rules.Find(m => m.id == id);
                item!.valoridaRicercare = valoriDaCercare.Split(',').ToList();
            }
            else if (bindingName == "settore")
            {
                var item = db.bindings!.settore!.rules.Find(m => m.id == id);
                item!.valoridaRicercare = valoriDaCercare.Split(',').ToList();

            }
            else if (bindingName == "reparto")
            {
                var item = db.bindings!.reparto!.rules.Find(m => m.id == id);
                item!.valoridaRicercare = valoriDaCercare.Split(',').ToList();
            }

            saveClassificazioneUniversale(db);
        }

        public void editOrdinamento(int areaIndex, int settoreIndex, int repartoIndex, int newGlobalOrderIndex)
        {
            var db = getClassificazioneUniversale();
            var itemDb = db.lista.Where(l => l.areaIndex == areaIndex && l.settoreIndex == settoreIndex && l.repartoIndex == repartoIndex).FirstOrDefault();
            if (itemDb != null)
            {
                itemDb.orderIndex = newGlobalOrderIndex;
            }

            saveClassificazioneUniversale(db);
        }

        public void addOrdinamento(string area, string settore, string reparto)
        {
            var db = getClassificazioneUniversale();
            var itemDb = db.lista.Where(l => l.area == area && l.settore == settore && l.reparto == reparto).FirstOrDefault();
            if (itemDb == null)
            {
                itemDb = new ClassificazioneUniversale();
                itemDb.area = area;
                itemDb.settore = settore;
                itemDb.reparto = reparto;

                var validItems = db.lista.Where(f => f.area == area).ToList();

                if (validItems.Count > 0)
                {
                    itemDb.areaIndex = validItems[0].areaIndex;
                    validItems = validItems.Where(f => f.settore == settore).ToList();

                    if (validItems.Count > 0)
                    {
                        itemDb.settoreIndex = validItems[0].settoreIndex;
                        itemDb.repartoIndex = validItems.Max(y => y.repartoIndex) + 1;
                    }
                    else
                    {
                        itemDb.settoreIndex = validItems.Max(y => y.settoreIndex) + 1;
                        itemDb.repartoIndex = 1;
                    }
                }
                else
                {
                    itemDb.areaIndex = db.lista.Max(y => y.areaIndex) + 1;
                    itemDb.settoreIndex = 1;
                    itemDb.repartoIndex = 1;
                }

                itemDb.orderIndex = db.lista.Max(y => y.orderIndex) + 1;

                db.lista.Add(itemDb);
            }

            saveClassificazioneUniversale(db);
        }

        public void saveClassificazioneUniversale(JsonDbClassificazioneUniversale db)
        {
            string jsonStr = JsonConvert.SerializeObject(db);

            using (StreamWriter sw = new StreamWriter(this.pathExternal + "SourceOrdinamentoLista.json", false))
            {
                sw.WriteLine(jsonStr);
            }
        }

        public DbOrdinamentoLista getOrdinamentoListaFreeSource()
        {
            DbOrdinamentoLista oDB = new DbOrdinamentoLista();
            try
            {

                oDB.freeSource = System.IO.File.ReadAllText(this.pathExternal + "SourceOrdinamentoLista.json");

            }
            catch
            {
                //Non trovata
                oDB.freeSource = "";

            }
            oDB.SetExternalPath(this.pathExternal);

            return oDB;
        }

        #endregion

        #region Etichette

        public DbEtichetta getEtichette()
        {
            JObject? o1 = JObject.Parse(System.IO.File.ReadAllText(this.pathExternal + "SourceEtichetteRef.json"));
            DbEtichetta? etichetteDB = o1.ToObject<DbEtichetta>();
            for (int i = 0; i < etichetteDB!.source.Count; i++)
            {
                var item = etichetteDB.source[i];
                if (item.Raccolta == null)
                {
                    item.Raccolta = "";
                }
            }

            etichetteDB.SetExternalPath(this.pathExternal);
            return etichetteDB;
        }

        public EtichettaItem getEtichettaById(int id)
        {
            var _source = getEtichette().source;
            return _source.Find(m => m.Id == id)!;
        }
        public EtichettaItem geEtichettaByName(string name)
        {
            var _source = getEtichette().source;
            return _source.Find(m => m.Etichetta == name)!;
        }

        public void addEtichetta(EtichettaItem item)
        {
            var db = getEtichette();
            var _source = db.source;
            var _last = _source.OrderByDescending(o => o.Id).FirstOrDefault();
            item.Id = _last != null ? _last.Id + 1 : 1;
            _source.Add(item);

            saveEtichette(db);
        }

        public void editEtichetta(EtichettaItem item)
        {
            var db = getEtichette();
            var itemDb = db.source.Find(m => m.Id == item.Id);
            itemDb!.Etichetta = item.Etichetta;
            itemDb.Visual = item.Visual;
            itemDb.Regole = item.Regole;
            itemDb.Raccolta = item.Raccolta;
            saveEtichette(db);
        }

        public void deleteEtichetta(EtichettaItem item)
        {
            var db = getEtichette();
            db.source.Remove(db.source.Find(m => m.Id == item.Id)!);

            saveEtichette(db);
        }

        void saveEtichette(DbEtichetta db)
        {
            string jsonStr = JsonConvert.SerializeObject(db);

            using (StreamWriter sw = new StreamWriter(this.pathExternal + "SourceEtichetteRef.json", false))
            {
                sw.WriteLine(jsonStr);
            }
        }
        #endregion

        #region Declinazione meccanica
        public DbDeclinazioneMeccaniche getDeclinazioneMeccaniche()
        {
            JObject? o1 = JObject.Parse(System.IO.File.ReadAllText(this.pathExternal + "SourceDeclinazioneMeccaniche.json"));
            DbDeclinazioneMeccaniche? meccanicheDB = o1.ToObject<DbDeclinazioneMeccaniche>();
            meccanicheDB!.source = meccanicheDB.source ?? new List<DeclinazioneMeccanica>();
            meccanicheDB.combinazioniMeccaniche = meccanicheDB.combinazioniMeccaniche ?? new List<CombinazioniMeccaniche>();
            meccanicheDB.meccanicheAvanzate = meccanicheDB.meccanicheAvanzate ?? new List<DeclinazioneMeccanicaAvanzata>();
            meccanicheDB.meccanicheInRimozione = meccanicheDB.meccanicheInRimozione ?? new List<RimozioneDeclinazioneMeccanica>();
            meccanicheDB.meccanicheInvalidate = meccanicheDB.meccanicheInvalidate ?? new List<String>();

            meccanicheDB.SetExternalPath(this.pathExternal);

            return meccanicheDB;
        }

        public DeclinazioneMeccanica getDeclinazioneMeccanicaById(int id)
        {
            var _source = getDeclinazioneMeccaniche().source;
            if (_source == null)
                return new DeclinazioneMeccanica();
            return _source.Find(m => m.Id == id)!;
        }
        public DeclinazioneMeccanica getDeclinazioneMeccanicaByName(string name)
        {
            var _source = getDeclinazioneMeccaniche().source;
            if (_source == null)
                return new DeclinazioneMeccanica();
            return _source.Find(m => m.Nome == name)!;
        }
        public CombinazioniMeccaniche getCombinazioneMeccanicaById(int id)
        {
            var _comb = getDeclinazioneMeccaniche().combinazioniMeccaniche;
            if (_comb == null)
                return new CombinazioniMeccaniche();
            return _comb.Find(m => m.Id == id)!;
        }
        public CombinazioniMeccaniche getCombinazioneMeccanicaByName(string name)
        {
            var _comb = getDeclinazioneMeccaniche().combinazioniMeccaniche;
            if (_comb == null)
                return new CombinazioniMeccaniche();
            return _comb.Find(m => m.NomeCombinazione == name)!;
        }

        public void addDeclinazioneMeccanica(DeclinazioneMeccanica item)
        {
            var db = getDeclinazioneMeccaniche();
            var _source = db.source;
            var _lastAvanzate = db.meccanicheAvanzate != null
                ? db.meccanicheAvanzate.OrderByDescending(o => o.Id).FirstOrDefault()
                : null;
            var _lastRimozioneAvanzate = db.meccanicheInRimozione != null
                ? db.meccanicheInRimozione.OrderByDescending(o => o.Id).FirstOrDefault()
                : null;
            var _last = db.source != null
                ? db.source.OrderByDescending(o => o.Id).FirstOrDefault()
                : null;
            List<int> arrayMaxId = new List<int>();
            if (_last != null)
            {
                arrayMaxId.Add((int)_last.Id);
            }
            if (_lastAvanzate != null)
            {
                arrayMaxId.Add((int)_lastAvanzate.Id);
            }
            if (_lastRimozioneAvanzate != null)
            {
                arrayMaxId.Add((int)_lastRimozioneAvanzate.Id);
            }

            if (arrayMaxId.Count == 0)
            {
                arrayMaxId.Add(0);
            }

            item.Id = arrayMaxId.Max() + 1;
            _source.Add(item);
            db.source = _source.OrderBy(o => o.Livello).ToList();
            saveDeclinazioneMeccanica(db);
        }

        public void addCombinazioneMeccanica(CombinazioniMeccaniche item)
        {
            var db = getDeclinazioneMeccaniche();
            var _comb = db.combinazioniMeccaniche;
            var _last = _comb.OrderByDescending(o => o.Id).FirstOrDefault();
            item.Id = _last != null ? _last.Id + 1 : 1;
            _comb.Add(item);

            saveDeclinazioneMeccanica(db);
        }

        public void editDeclinazioneMeccanica(DeclinazioneMeccanica item)
        {
            var db = getDeclinazioneMeccaniche();
            var itemDb = db.source.Find(m => m.Id == item.Id);
            itemDb!.Nome = item.Nome;
            itemDb.Livello = item.Livello;
            itemDb.Formato = item.Formato;
            itemDb.Regole = item.Regole;

            saveDeclinazioneMeccanica(db);
        }

        public void editCombinazioneMeccanica(CombinazioniMeccaniche item)
        {
            var db = getDeclinazioneMeccaniche();
            var itemDb = db.combinazioniMeccaniche.Find(m => m.Id == item.Id);
            itemDb!.NomeCombinazione = item.NomeCombinazione;
            itemDb.Formato = item.Formato;

            saveDeclinazioneMeccanica(db);
        }

        public void deleteDeclinazioneMeccanica(DeclinazioneMeccanica item)
        {
            var db = getDeclinazioneMeccaniche();
            db.source.Remove(db.source.Find(m => m.Id == item.Id)!);

            saveDeclinazioneMeccanica(db);
        }

        public void deleteCombinazioneMeccanica(CombinazioniMeccaniche item)
        {
            var db = getDeclinazioneMeccaniche();
            db.combinazioniMeccaniche.Remove(db.combinazioniMeccaniche.Find(m => m.Id == item.Id)!);

            saveDeclinazioneMeccanica(db);
        }

        void saveDeclinazioneMeccanica(DbDeclinazioneMeccaniche db)
        {
            string jsonStr = JsonConvert.SerializeObject(db);

            using (StreamWriter sw = new StreamWriter(this.pathExternal + "SourceDeclinazioneMeccaniche.json", false))
            {
                sw.WriteLine(jsonStr);
            }
        }

        public string getFormatoCombinazioneMeccanica(string formatoCombinazione)
        {
            var db = getDeclinazioneMeccaniche();
            if (db.combinazioniMeccaniche == null)
                return "1x1";
            var corrispondenza = db.combinazioniMeccaniche.Find(f => f.NomeCombinazione == formatoCombinazione);
            if (corrispondenza != null)
            {
                return corrispondenza.Formato;
            }
            else
            {
                var livelliMeccanica = formatoCombinazione.Split("_");
                for (int i = livelliMeccanica.Length - 1; i >= 0; i--)
                {
                    var levelName = livelliMeccanica[i];
                    var livelloTrovato = db.source.Find(f => f.Nome == levelName);
                    if (livelloTrovato != null && livelloTrovato.Formato != null && livelloTrovato.Formato != "")
                    {
                        return livelloTrovato.Formato;
                    }
                }
            }
            return "1x1";
        }


        public DeclinazioneMeccanicaAvanzata getDeclinazioneMeccanicaAvanzataById(int id)
        {
            var _source = getDeclinazioneMeccaniche().meccanicheAvanzate;
            if (_source == null)
                return new DeclinazioneMeccanicaAvanzata();
            return _source.Find(m => m.Id == id)!;
        }
        public DeclinazioneMeccanicaAvanzata getDeclinazioneMeccanicaAvanzataByName(string name, float livelloEsterno)
        {
            var _source = getDeclinazioneMeccaniche().meccanicheAvanzate;
            if (_source == null)
                return new DeclinazioneMeccanicaAvanzata();
            return _source.Find(m => m.Nome == name && m.LivelloEsternoMeccanicaAvanzata == livelloEsterno)!;
        }
        public void addDeclinazioneMeccanicaAvanzata(DeclinazioneMeccanicaAvanzata item)
        {
            var db = getDeclinazioneMeccaniche();
            var _source = db.meccanicheAvanzate;
            var _lastAvanzate = db.meccanicheAvanzate != null
                ? db.meccanicheAvanzate.OrderByDescending(o => o.Id).FirstOrDefault()
                : null;
            var _lastRimozioneAvanzate = db.meccanicheInRimozione != null
                ? db.meccanicheInRimozione.OrderByDescending(o => o.Id).FirstOrDefault()
                : null;
            var _last = db.source != null
                ? db.source.OrderByDescending(o => o.Id).FirstOrDefault()
                : null;

            List<int> arrayMaxId = new List<int>();
            if (_last != null)
            {
                arrayMaxId.Add((int)_last.Id);
            }
            if (_lastAvanzate != null)
            {
                arrayMaxId.Add((int)_lastAvanzate.Id);
            }
            if (_lastRimozioneAvanzate != null)
            {
                arrayMaxId.Add((int)_lastRimozioneAvanzate.Id);
            }

            if (arrayMaxId.Count == 0)
            {
                arrayMaxId.Add(0);
            }

            item.Id = arrayMaxId.Max() + 1;
            _source.Add(item);
            db.meccanicheAvanzate = _source.OrderBy(o => o.LivelloMeccanica).ToList();
            saveDeclinazioneMeccanica(db);
        }
        public void editDeclinazioneMeccanicaAvanzata(DeclinazioneMeccanicaAvanzata item)
        {
            var db = getDeclinazioneMeccaniche();
            var itemDb = db.meccanicheAvanzate.Find(m => m.Id == item.Id);
            itemDb!.Nome = item.Nome;
            itemDb.LivelloMeccanica = item.LivelloMeccanica;
            itemDb.LivelloEsternoMeccanicaAvanzata = item.LivelloEsternoMeccanicaAvanzata;
            itemDb.Formato = item.Formato;
            itemDb.Regole = item.Regole;

            saveDeclinazioneMeccanica(db);
        }
        public void deleteDeclinazioneMeccanicaAvanzata(DeclinazioneMeccanicaAvanzata item)
        {
            var db = getDeclinazioneMeccaniche();
            db.meccanicheAvanzate.Remove(db.meccanicheAvanzate.Find(m => m.Id == item.Id)!);

            saveDeclinazioneMeccanica(db);
        }




        public RimozioneDeclinazioneMeccanica getRimozioneMeccanicaAvanzataById(int id)
        {
            var _source = getDeclinazioneMeccaniche().meccanicheInRimozione;
            if (_source == null)
                return new RimozioneDeclinazioneMeccanica();
            return _source.Find(m => m.Id == id)!;
        }
        public RimozioneDeclinazioneMeccanica getRimozioneMeccanicaAvanzataByName(string name, float livelloEsterno)
        {
            var _source = getDeclinazioneMeccaniche().meccanicheInRimozione;
            if (_source == null)
                return new RimozioneDeclinazioneMeccanica();
            return _source.Find(m => m.Nome == name && m.LivelloEsternoMeccanicaAvanzata == livelloEsterno)!;
        }
        public void addRimozioneMeccanicaAvanzata(RimozioneDeclinazioneMeccanica item)
        {
            var db = getDeclinazioneMeccaniche();
            var _source = db.meccanicheInRimozione;
            var _lastAvanzate = db.meccanicheAvanzate != null
                ? db.meccanicheAvanzate.OrderByDescending(o => o.Id).FirstOrDefault()
                : null;
            var _lastRimozioneAvanzate = db.meccanicheInRimozione != null
                ? db.meccanicheInRimozione.OrderByDescending(o => o.Id).FirstOrDefault()
                : null;
            var _last = db.source != null
                ? db.source.OrderByDescending(o => o.Id).FirstOrDefault()
                : null;
            List<int> arrayMaxId = new List<int>();
            if (_last != null)
            {
                arrayMaxId.Add((int)_last.Id);
            }
            if (_lastAvanzate != null)
            {
                arrayMaxId.Add((int)_lastAvanzate.Id);
            }
            if (_lastRimozioneAvanzate != null)
            {
                arrayMaxId.Add((int)_lastRimozioneAvanzate.Id);
            }

            if (arrayMaxId.Count == 0)
            {
                arrayMaxId.Add(0);
            }

            item.Id = arrayMaxId.Max() + 1;
            _source.Add(item);
            db.meccanicheInRimozione = _source.OrderBy(o => o.LivelloMeccanica).ToList();
            saveDeclinazioneMeccanica(db);
        }
        public void editRimozioneMeccanicaAvanzata(RimozioneDeclinazioneMeccanica item)
        {
            var db = getDeclinazioneMeccaniche();
            var itemDb = db.meccanicheInRimozione.Find(m => m.Id == item.Id);
            itemDb!.Nome = item.Nome;
            itemDb.LivelloMeccanica = item.LivelloMeccanica;
            itemDb.LivelloEsternoMeccanicaAvanzata = item.LivelloEsternoMeccanicaAvanzata;
            itemDb.Regole = item.Regole;
            itemDb.timeToApply = item.timeToApply;

            saveDeclinazioneMeccanica(db);
        }
        public void deleteRimozioneMeccanicaAvanzata(RimozioneDeclinazioneMeccanica item)
        {
            var db = getDeclinazioneMeccaniche();
            db.meccanicheInRimozione.Remove(db.meccanicheInRimozione.Find(m => m.Id == item.Id)!);

            saveDeclinazioneMeccanica(db);
        }

        #endregion

        #region Regole Mastro
        public DbRegoleMastro getDbRegoleMastro()
        {
            JObject? o1 = JObject.Parse(System.IO.File.ReadAllText(this.pathExternal + "SourceRegoleMastro.json"));
            DbRegoleMastro? mastroDB = o1.ToObject<DbRegoleMastro>();
            return mastroDB!;
        }

        public RegoleMastro getRegoleMastroById(int id)
        {
            var _source = getDbRegoleMastro().source;
            return _source.Find(m => m.Id == id)!;
        }
        public RegoleMastro getRegoleMastroByName(string name)
        {
            var _source = getDbRegoleMastro().source;
            return _source.Find(m => m.Nome == name)!;
        }

        public void addRegoleMastro(RegoleMastro item)
        {
            var db = getDbRegoleMastro();
            var _source = db.source;
            var _last = _source.OrderByDescending(o => o.Id).FirstOrDefault();
            item.Id = _last != null ? _last.Id + 1 : 1;
            _source.Add(item);
            saveRegoleMastro(db);
        }

        public void editRegoleMastro(RegoleMastro item)
        {
            var db = getDbRegoleMastro();
            var itemDb = db.source.Find(m => m.Id == item.Id);
            itemDb!.Nome = item.Nome;
            itemDb.Specifiche = item.Specifiche;
            itemDb.Regole = item.Regole;

            saveRegoleMastro(db);
        }

        public void deleteRegoleMastro(RegoleMastro item)
        {
            var db = getDbRegoleMastro();
            db.source.Remove(db.source.Find(m => m.Id == item.Id)!);

            saveRegoleMastro(db);
        }

        void saveRegoleMastro(DbRegoleMastro db)
        {
            string jsonStr = JsonConvert.SerializeObject(db);

            using (StreamWriter sw = new StreamWriter(this.pathExternal + "SourceRegoleMastro.json", false))
            {
                sw.WriteLine(jsonStr);
            }
        }
        #endregion

        #region Framework css
        //public DbFrameworkCss getFrameworkCss()
        //{
        //    JObject o1 = JObject.Parse(System.IO.File.ReadAllText(this.pathExternal + "SourceFrameworkCss.json"));
        //    DbFrameworkCss frameworkDB = o1.ToObject<DbFrameworkCss>();
        //    if (frameworkDB.livelli == null)
        //    {
        //        frameworkDB.livelli = new List<livelloCssFramework>();
        //    }
        //    for (int i = 0; i < frameworkDB.livelli.Count; i++)
        //    {
        //        var item = frameworkDB.livelli[i].definizioni;
        //        if (item == null)
        //        {
        //            item = new List<DefinizioniCssFramework>();
        //        }
        //        else
        //        {
        //            for (int j = 0; j < item.Count; j++)
        //            {
        //                var regole = item[j].regole;
        //                if (regole == null)
        //                {
        //                    regole = new List<List<regolaCssFramework>>();
        //                }

        //            }
        //        }
        //    }
        //    return frameworkDB;
        //}

        //public DbFrameworkCss getFrameworkCss()
        //{
        //    JObject o1 = JObject.Parse(System.IO.File.ReadAllText(this.pathExternal + "SourceFrameworkCss.json"));
        //    DbFrameworkCss frameworkDB = o1.ToObject<DbFrameworkCss>();
        //    if (frameworkDB.livelli == null)
        //    {
        //        frameworkDB.livelli = new List<livelloCssFramework>();
        //    }
        //    for (int i = 0; i < frameworkDB.livelli.Count; i++)
        //    {
        //        var item = frameworkDB.livelli[i].definizioni;
        //        if (item == null)
        //        {
        //            item = new List<DefinizioniCssFramework>();
        //        }
        //        else
        //        {
        //            for (int j = 0; j < item.Count; j++)
        //            {
        //                var regole = item[j].regole;
        //                if (regole == null)
        //                {
        //                    regole = new List<macroRegolaCssFramework>();
        //                }

        //            }
        //        }
        //    }

        //    frameworkDB.SetExternalPath(this.pathExternal);

        //    return frameworkDB;
        //}

        public DbFrameworkCss getFrameworkCss()
        {
            var db = DbFrameworkCss.Load(this.pathExternal);
            db.SetExternalPath(this.pathExternal); // per sicurezza
                                                   // Sanitizzazione compatibilità
            if (db.livelli == null) db.livelli = new List<livelloCssFramework>();
            foreach (var liv in db.livelli)
            {
                liv.definizioni ??= new List<DefinizioniCssFramework>();
                foreach (var def in liv.definizioni)
                    def.regole ??= new List<macroRegolaCssFramework>();
            }
            return db;
        }
        public DbMappaStili getMappaStili()
        {
            DbMappaStili msDB = new DbMappaStili();
            try
            {

                msDB.freeSource = System.IO.File.ReadAllText(this.pathExternal + "SourceMappaStili.json");

            }
            catch
            {
                //Non trovata
                msDB.freeSource = "";

            }
            msDB.SetExternalPath(this.pathExternal);

            return msDB;
        }


        public DefinizioniCssFramework getDefinizioneById(int id)
        {
            var _source = getFrameworkCss().livelli;
            var livello = _source.Find(m => m.definizioni.Find(f2 => f2.id == id) != null);
            if (livello == null)
                return new DefinizioniCssFramework();
            else
                return livello.definizioni.Find(f2 => f2.id == id)!;
        }

        public livelloCssFramework getLivelloById(int id)
        {
            var _source = getFrameworkCss().livelli;
            var livello = _source.Find(m => m.id == id);
            return livello!;
        }

        public List<DefinizioniCssFramework> getDefinizioneByName(string name)
        {
            var _source = getFrameworkCss().livelli;
            List<DefinizioniCssFramework> definizioniInteressate = new List<DefinizioniCssFramework>();
            foreach (var liv in _source)
            {
                if (liv.definizioni.Find(f => f.result == name) != null)
                {
                    definizioniInteressate.AddRange(liv.definizioni.Where(f => f.result == name).ToList());
                }
            }
            return definizioniInteressate;
        }

        public livelloCssFramework getLivelloByDefinizioneId(int id)
        {
            var _source = getFrameworkCss().livelli;
            var livello = _source.Find(m => m.definizioni.Find(f2 => f2.id == id) != null);
            return livello!;
        }

        public List<livelloCssFramework> getLivelloyNameDefinizione(string name)
        {
            var _source = getFrameworkCss().livelli;
            List<livelloCssFramework> livelliInteressati = new List<livelloCssFramework>();
            foreach (var liv in _source)
            {
                if (liv.definizioni.Find(f => f.result == name) != null)
                {
                    livelliInteressati.Add(liv);
                }
            }
            return livelliInteressati;
        }

        public BoolResult addLivello(livelloCssFramework item)
        {
            BoolResult res = new BoolResult();
            try
            {
                var db = getFrameworkCss();
                var _source = db.livelli;
                var _last = _source.OrderByDescending(o => o.ordine).FirstOrDefault();
                bool ordineRichiesto = false;
                int newOrder = item.ordine;
                if (item.ordine != 0)
                {
                    ordineRichiesto = true;
                }

                item.ordine = _last != null ? _last.ordine + 1 : 1;

                item.id = _last != null ? _last.id + 1 : 1;
                if (item.definizioni == null)
                {
                    item.definizioni = new List<DefinizioniCssFramework>();
                }
                _source.Add(item);
                if (ordineRichiesto)
                {
                    db = editOrdineLivello(item.id, newOrder, db);
                }

                saveFrameworkCss(db);
                res.Esito = true;
                return res;
            }
            catch (Exception ex)
            {
                res.error = ex.ToString();
                res.Esito = false;
                return res;
            }
        }

        public BoolResult editOrdineLivello(int id, int nuovoOrdine)
        {
            BoolResult res = new BoolResult();
            try
            {
                var db = getFrameworkCss();
                var itemDb = db.livelli.Find(m => m.id == id);
                int vecchioOrdine = itemDb!.ordine;

                // Cambiamo l'ordine dell'elemento selezionato
                int maxOrdine = db.livelli.Count;
                if (nuovoOrdine > maxOrdine)
                {
                    nuovoOrdine = maxOrdine;
                }

                int minOrdine = 1;
                if (nuovoOrdine < minOrdine)
                {
                    nuovoOrdine = minOrdine;
                }
                itemDb.ordine = nuovoOrdine;

                // Spostiamo gli altri elementi per mantenere la continuità
                if (nuovoOrdine > vecchioOrdine)
                {
                    // Stiamo spostando l'elemento "in avanti", quindi dobbiamo decrementare l'ordine degli altri elementi compresi tra vecchioOrdine e nuovoOrdine
                    foreach (var item in db.livelli)
                    {
                        if (item.id != id && item.ordine > vecchioOrdine && item.ordine <= nuovoOrdine)
                        {
                            item.ordine--;
                        }
                    }
                }
                else if (nuovoOrdine < vecchioOrdine)
                {
                    // Stiamo spostando l'elemento "indietro", quindi dobbiamo incrementare l'ordine degli altri elementi compresi tra nuovoOrdine e vecchioOrdine
                    foreach (var item in db.livelli)
                    {
                        if (item.id != id && item.ordine >= nuovoOrdine && item.ordine < vecchioOrdine)
                        {
                            item.ordine++;
                        }
                    }
                }
                saveFrameworkCss(db);
                res.Esito = true;
                return res;
            }
            catch (Exception ex)
            {
                res.error = ex.ToString();
                res.Esito = false;
                return res;
            }

        }


        public DbFrameworkCss editOrdineLivello(int id, int nuovoOrdine, DbFrameworkCss db)
        {
            var itemDb = db.livelli.Find(m => m.id == id);
            int vecchioOrdine = itemDb!.ordine;

            // Cambiamo l'ordine dell'elemento selezionato
            int maxOrdine = db.livelli.Count;
            if (nuovoOrdine > maxOrdine)
            {
                nuovoOrdine = maxOrdine;
            }

            int minOrdine = 1;
            if (nuovoOrdine < minOrdine)
            {
                nuovoOrdine = minOrdine;
            }

            itemDb.ordine = nuovoOrdine;
            // Spostiamo gli altri elementi per mantenere la continuità
            if (nuovoOrdine > vecchioOrdine)
            {
                // Stiamo spostando l'elemento "in avanti", quindi dobbiamo decrementare l'ordine degli altri elementi compresi tra vecchioOrdine e nuovoOrdine
                foreach (var item in db.livelli)
                {
                    if (item.id != id && item.ordine > vecchioOrdine && item.ordine <= nuovoOrdine)
                    {
                        item.ordine--;
                    }
                }
            }
            else if (nuovoOrdine < vecchioOrdine)
            {
                // Stiamo spostando l'elemento "indietro", quindi dobbiamo incrementare l'ordine degli altri elementi compresi tra nuovoOrdine e vecchioOrdine
                foreach (var item in db.livelli)
                {
                    if (item.id != id && item.ordine >= nuovoOrdine && item.ordine < vecchioOrdine)
                    {
                        item.ordine++;
                    }
                }
            }
            return db;
        }

        public BoolResult addDefinizioneCssFramework(DefinizioniCssFramework def, int idLiv)
        {
            BoolResult res = new BoolResult();
            try
            {
                var liv = getLivelloById(idLiv);
                var db = getFrameworkCss();
                DefinizioniCssFramework? _last = null;
                //liv.definizioni.Add(def);
                foreach (var livello in db.livelli)
                {
                    if (livello.definizioni.Count == 0)
                    {
                        continue;
                    }
                    var _lastLivello = livello.definizioni.OrderByDescending(o => o.id).FirstOrDefault();

                    if (_last == null)
                    {
                        _last = _lastLivello;
                    }
                    if (_lastLivello!.id > _last!.id)
                    {
                        _last = _lastLivello;
                    }
                }

                DefinizioniCssFramework? _lastOrdine = null;

                foreach (var livello in db.livelli)
                {
                    if (livello.definizioni.Count == 0)
                    {
                        continue;
                    }
                    var _lastLivello = livello.definizioni.OrderByDescending(o => o.ordine).FirstOrDefault();

                    if (_lastOrdine == null)
                    {
                        _lastOrdine = _lastLivello;
                    }
                    if (_lastLivello!.id > _last!.id)
                    {
                        _lastOrdine = _lastLivello;
                    }
                }

                bool ordineRichiesto = false;
                int newOrder = def.ordine;
                if (def.ordine != 0)
                {
                    ordineRichiesto = true;
                }

                def.ordine = _lastOrdine != null ? _lastOrdine.ordine + 1 : 1;

                def.id = _last != null ? _last.id + 1 : 1;
                if (def.regole == null)
                {
                    def.regole = new List<macroRegolaCssFramework>();
                }
                if (def.descrizione == null)
                {
                    def.descrizione = "";
                }
                liv.definizioni.Add(def);

                if (ordineRichiesto)
                {
                    liv = editOrdineDefinizioni(def.id, newOrder, liv);
                }

                //var dbLiv = db.livelli.Find(f => f.id == liv.id);
                //dbLiv = liv;
                //saveFrameworkCss(db);

                int index = db.livelli.FindIndex(f => f.id == liv.id);
                if (index != -1)
                {
                    db.livelli[index] = liv; // Sostituisce l'elemento con quello aggiornato
                    saveFrameworkCss(db);
                }


                res.Esito = true;
                return res;
            }
            catch (Exception ex)
            {
                res.error = ex.ToString();
                res.Esito = false;
                return res;
            }
        }

        public BoolResult editOrdineDefinizioni(int id, int nuovoOrdine)
        {
            BoolResult res = new BoolResult();
            try
            {
                var liv = getLivelloByDefinizioneId(id);
                var item = liv.definizioni.Find(f => f.id == id);
                if (item == null)
                {
                    res.error = "Id definizione non trovato nel DB";
                    res.Esito = false;
                    return res;
                }

                int vecchioOrdine = item.ordine;

                // Cambiamo l'ordine dell'elemento selezionato
                int maxOrdine = liv.definizioni.Count;
                if (nuovoOrdine > maxOrdine)
                {
                    nuovoOrdine = maxOrdine;
                }

                int minOrdine = 1;
                if (nuovoOrdine < minOrdine)
                {
                    nuovoOrdine = minOrdine;
                }

                item.ordine = nuovoOrdine;
                // Spostiamo gli altri elementi per mantenere la continuità
                if (nuovoOrdine > vecchioOrdine)
                {
                    // Stiamo spostando l'elemento "in avanti", quindi dobbiamo decrementare l'ordine degli altri elementi compresi tra vecchioOrdine e nuovoOrdine
                    foreach (var itemLiv in liv.definizioni)
                    {
                        if (itemLiv.id != id && itemLiv.ordine > vecchioOrdine && itemLiv.ordine <= nuovoOrdine)
                        {
                            itemLiv.ordine--;
                        }
                    }
                }
                else if (nuovoOrdine < vecchioOrdine)
                {
                    // Stiamo spostando l'elemento "indietro", quindi dobbiamo incrementare l'ordine degli altri elementi compresi tra nuovoOrdine e vecchioOrdine
                    foreach (var itemLiv in liv.definizioni)
                    {
                        if (itemLiv.id != id && itemLiv.ordine >= nuovoOrdine && itemLiv.ordine < vecchioOrdine)
                        {
                            itemLiv.ordine++;
                        }
                    }
                }

                var db = getFrameworkCss();
                //var dbLiv = db.livelli.Find(f => f.id == liv.id);
                //dbLiv = liv;
                //saveFrameworkCss(db);

                int index = db.livelli.FindIndex(f => f.id == liv.id);
                if (index != -1)
                {
                    db.livelli[index] = liv; // Sostituisce l'elemento con quello aggiornato
                    saveFrameworkCss(db);
                }
                res.Esito = true;

                return res;
            }
            catch (Exception ex)
            {
                res.error = ex.ToString();
                res.Esito = false;
                return res;
            }
        }

        public BoolResult editNomeDefinizioni(int id, string nome)
        {
            BoolResult res = new BoolResult();
            try
            {
                if (nome == null || nome == "")
                {
                    throw new Exception("Nome non specificato");
                }
                var liv = getLivelloByDefinizioneId(id);
                var item = liv.definizioni.Find(f => f.id == id);
                if (item == null)
                {
                    res.error = "Id definizione non trovato nel DB";
                    res.Esito = false;
                    return res;
                }

                item.result = nome;

                var db = getFrameworkCss();

                int index = db.livelli.FindIndex(f => f.id == liv.id);
                if (index != -1)
                {
                    db.livelli[index] = liv; // Sostituisce l'elemento con quello aggiornato
                    saveFrameworkCss(db);
                }
                res.Esito = true;

                return res;
            }
            catch (Exception ex)
            {
                res.error = ex.ToString();
                res.Esito = false;
                return res;
            }
        }

        public BoolResult editDescrizioneDefinizioni(int id, string descrizione)
        {
            BoolResult res = new BoolResult();
            try
            {
                var liv = getLivelloByDefinizioneId(id);
                var item = liv.definizioni.Find(f => f.id == id);
                if (item == null)
                {
                    res.error = "Id definizione non trovato nel DB";
                    res.Esito = false;
                    return res;
                }

                item.descrizione = descrizione;

                var db = getFrameworkCss();

                int index = db.livelli.FindIndex(f => f.id == liv.id);
                if (index != -1)
                {
                    db.livelli[index] = liv; // Sostituisce l'elemento con quello aggiornato
                    saveFrameworkCss(db);
                }
                res.Esito = true;

                return res;
            }
            catch (Exception ex)
            {
                res.error = ex.ToString();
                res.Esito = false;
                return res;
            }
        }

        public livelloCssFramework editOrdineDefinizioni(int id, int nuovoOrdine, livelloCssFramework liv)
        {
            var itemLiv = liv.definizioni.Find(m => m.id == id);
            int vecchioOrdine = itemLiv!.ordine;

            // Cambiamo l'ordine dell'elemento selezionato
            int maxOrdine = liv.definizioni.Count;
            if (nuovoOrdine > maxOrdine)
            {
                nuovoOrdine = maxOrdine;
            }

            int minOrdine = 1;
            if (nuovoOrdine < minOrdine)
            {
                nuovoOrdine = minOrdine;
            }
            itemLiv.ordine = nuovoOrdine;

            // Spostiamo gli altri elementi per mantenere la continuità
            if (nuovoOrdine > vecchioOrdine)
            {
                // Stiamo spostando l'elemento "in avanti", quindi dobbiamo decrementare l'ordine degli altri elementi compresi tra vecchioOrdine e nuovoOrdine
                foreach (var item in liv.definizioni)
                {
                    if (item.id != id && item.ordine > vecchioOrdine && item.ordine <= nuovoOrdine)
                    {
                        item.ordine--;
                    }
                }
            }
            else if (nuovoOrdine < vecchioOrdine)
            {
                // Stiamo spostando l'elemento "indietro", quindi dobbiamo incrementare l'ordine degli altri elementi compresi tra nuovoOrdine e vecchioOrdine
                foreach (var item in liv.definizioni)
                {
                    if (item.id != id && item.ordine >= nuovoOrdine && item.ordine < vecchioOrdine)
                    {
                        item.ordine++;
                    }
                }
            }
            return liv;
        }

        public BoolResult editRegoleDefinizione(List<macroRegolaCssFramework> regole, int idDefinizione, string percorso)
        {
            BoolResult res = new BoolResult();
            try
            {
                var liv = getLivelloByDefinizioneId(idDefinizione);
                var item = liv.definizioni.Find(f => f.id == idDefinizione);
                if (item == null)
                {
                    res.error = "Id definizione non trovato nel DB";
                    res.Esito = false;
                    return res;
                }

                var percorsoEl = percorso.Split("$").Where(f => f != "").ToList();
                macroRegolaCssFramework? setRegola = null;

                foreach (var perc in percorsoEl)
                {
                    var id = int.Parse(perc);
                    setRegola = item.regole.Find(f => f.id == id);
                }

                if (setRegola != null)
                {
                    int deepness = percorsoEl.Count;
                    setRegola.regoleAnnidate = regole != null ? regole : new List<macroRegolaCssFramework>();
                    int counter = 1;
                    foreach (var itemSet in setRegola.regoleAnnidate)
                    {
                        itemSet.id = counter;
                        itemSet.deepness = deepness;
                        counter++;
                    }
                }
                else
                {
                    item.regole = regole != null ? regole : new List<macroRegolaCssFramework>();
                    int counter = 1;
                    foreach (var itemSet in item.regole)
                    {
                        itemSet.id = counter;
                        itemSet.deepness = 0;
                        counter++;
                    }
                }


                var db = getFrameworkCss();

                int index = db.livelli.FindIndex(f => f.id == liv.id);
                if (index != -1)
                {
                    db.livelli[index] = liv; // Sostituisce l'elemento con quello aggiornato
                    saveFrameworkCss(db);
                }

                res.Esito = true;
                return res;
            }
            catch (Exception ex)
            {
                res.error = ex.ToString();
                res.Esito = false;
                return res;
            }
        }


        public BoolResult deleteLivello(int id)
        {
            BoolResult res = new BoolResult();
            try
            {
                var db = getFrameworkCss();
                var itemToDelete = db.livelli.Find(m => m.id == id);

                if (itemToDelete == null)
                {
                    res.Esito = false;
                    res.error = "Livello non presente nel DB";
                    return res; // L'elemento non esiste
                }

                // Rimuoviamo l'elemento selezionato
                db.livelli.Remove(itemToDelete);

                // Aggiorniamo gli ordini dei rimanenti elementi
                foreach (var item in db.livelli)
                {
                    if (item.ordine > itemToDelete.ordine)
                    {
                        item.ordine--;
                    }
                }

                // Salviamo il database aggiornato
                saveFrameworkCss(db);

                res.Esito = true;
                return res;
            }
            catch (Exception ex)
            {
                res.error = ex.ToString();
                res.Esito = false;
                return res;
            }
        }

        public BoolResult deleteDefinizioneById(int id)
        {
            BoolResult res = new BoolResult();
            try
            {
                var db = getFrameworkCss();
                var liv = db.livelli.Find(f => f.definizioni.Find(f2 => f2.id == id) != null);
                if (liv != null)
                {
                    var itemToDelete = liv.definizioni.Find(f => f.id == id)!;

                    liv.definizioni.Remove(itemToDelete);

                    foreach (var item in liv.definizioni)
                    {
                        if (item.ordine > itemToDelete.ordine)
                        {
                            item.ordine--;
                        }
                    }
                }
                else
                {
                    res.Esito = false;
                    res.error = "Definizione non presente nel DB";
                    return res; // L'elemento non esiste
                }


                saveFrameworkCss(db);

                res.Esito = true;
                return res;
            }
            catch (Exception ex)
            {
                res.error = ex.ToString();
                res.Esito = false;
                return res;
            }
        }

        //void saveFrameworkCss(DbFrameworkCss db)
        //{
        //    string jsonStr = JsonConvert.SerializeObject(db);

        //    using (StreamWriter sw = new StreamWriter(this.pathExternal + "SourceFrameworkCss.json", false))
        //    {
        //        sw.WriteLine(jsonStr);
        //    }
        //}

        void saveFrameworkCss(DbFrameworkCss db)
        {
            if (db == null)
                throw new ArgumentNullException(nameof(db));

            // Assicura che la directory esista
            //var dir = Path.Combine(this.pathExternal, "Source");
            //if (!Directory.Exists(dir))
            //    Directory.CreateDirectory(dir);

            var fullPath = Path.Combine(this.pathExternal, DbFrameworkCss.dbSourceName);

            // Serializza una sola volta, formattazione compatta
            var jsonStr = JsonConvert.SerializeObject(db, Formatting.None);

            // Scrive in modo atomico e sicuro
            using (var sw = new StreamWriter(fullPath, false))
            {
                sw.WriteLine(jsonStr);
            }
        }


        #endregion

        #region Confronti
        public DbConfronto getConfronto()
        {
            JObject? o1 = JObject.Parse(System.IO.File.ReadAllText(this.pathExternal + "Source" + DbConfronto.dbSourceName));
            DbConfronto? confDB = o1.ToObject<DbConfronto>();
            confDB!.SetExternalPath(this.pathExternal);
            return confDB;
        }

        #endregion

        #region customPlugin
        public DbCustomPlugin getCustomPluginAgenzia()
        {
            var db = DbCustomPlugin.Load(this.pathExternal);
            db.SetExternalPath(this.pathExternal); // per sicurezza
            return db;
        }


        #endregion

        //public DbAllineamenti getDbAllineamentiSource()
        //{
        //    DbAllineamenti msDB = new DbAllineamenti();
        //    try
        //    {

        //        msDB.freeSource = System.IO.File.ReadAllText(this.pathExternal + "SourceAllineamenti.json");

        //    }
        //    catch
        //    {
        //        //Non trovata
        //        msDB.freeSource = "";

        //    }
        //    msDB.SetExternalPath(this.pathExternal);

        //    return msDB;


        //}

        public DbRidimensionamentiAllineamenti getDbAllineamentiSource()
        {
            var root = DbFrameworkCss.Load(this.pathExternal);
            root.SetExternalPath(this.pathExternal);
            return root.dbRidimensionamentiAllineamenti ?? new DbRidimensionamentiAllineamenti();
        }
    }



    #region FICO Area/Canale/PV

    public class DbACPV
    {
        public static readonly string dbSourceName = "ACPV.json";

        private string pathExternalSource  = "";
        public List<Area> aree { get; set; } = new List<Area>();
        public List<Canale> canali { get; set; } = new List<Canale>();
        public List<CombinazioneAreaCanale> combinazioni { get; set; } = new List<CombinazioneAreaCanale>();
        public List<PV> pv { get; set; } = new List<PV>();

        public void SetExternalPath(string pathExternalSource)
        {
            this.pathExternalSource = pathExternalSource + "Source" + DbACPV.dbSourceName;
        }

        public BoolResult SetJsonSource(string jsonStr)
        {
            BoolResult br = new BoolResult();
            try
            {
                var db = JsonConvert.DeserializeObject<DbACPV>(jsonStr);
                this.aree = db!.aree;
                this.canali = db.canali;
                this.combinazioni = db.combinazioni;
                this.pv = db.pv;
                this.SaveChanges();

                br.Esito = true;
            }
            catch (Exception ex)
            {
                br.Esito = false;
                br.error = ex.ToString();
                return br;
            }

            return br;
        }

        public bool SaveChanges()
        {
            string jsonStr = JsonConvert.SerializeObject(this);

            using (StreamWriter sw = new StreamWriter(this.pathExternalSource, false))
            {
                sw.WriteLine(jsonStr);
            }

            return true;
        }


    }

    public class CombinazioneAreaCanale
    {
        public string guidID { get; set; } = "";
        public string guidIDArea { get; set; } = "";
        public string guidIDCanale { get; set; } = "";
        public bool enabled { get; set; }

    }

    public class PV
    {
        public string guidID { get; set; } = "";
        public string nome { get; set; } = "";
        public string indirizzo { get; set; } = "";
        public string citta { get; set; } = "";
        public string cap { get; set; } = "";
        public double lat { get; set; }
        public double lon { get; set; }
        public string guidIDCombinazione { get; set; } = "";
    }

    public class ACPVFicoOperationResult
    {
        public bool esito { get; set; }
        public string error { get; set; } = "";
    }


    #endregion

    #region FICO flusso promo
    public class DbLabels
    {
        public static readonly string dbSourceName = "Labels.json";

        private string pathExternalSource="";
        public List<Label> source { get; set; }= new List<Label>();

        public void SetExternalPath(string pathExternalSource)
        {
            this.pathExternalSource = pathExternalSource + "Source" + DbACPV.dbSourceName;
        }

        public bool SaveChanges()
        {
            string jsonStr = JsonConvert.SerializeObject(this);

            using (StreamWriter sw = new StreamWriter(this.pathExternalSource, false))
            {
                sw.WriteLine(jsonStr);
            }

            return true;
        }


    }
    public class Label
    {
        public Int16 Id { get; set; }
        public string Codice { get; set; } = "";
        public string Nome { get; set; } = "";
    }
    public class DbFormati
    {
        public static readonly string dbSourceName = "Formati.json";

        private string pathExternalSource="";
        public List<Formato> source { get; set; } = new List<Formato>();

        public void SetExternalPath(string pathExternalSource)
        {
            this.pathExternalSource = pathExternalSource + "Source" + DbFormati.dbSourceName;
        }

        public bool SaveChanges()
        {
            string jsonStr = JsonConvert.SerializeObject(this);

            using (StreamWriter sw = new StreamWriter(this.pathExternalSource, false))
            {
                sw.WriteLine(jsonStr);
            }

            return true;
        }
        public BoolResult SetJsonSource(string jsonStr)
        {
            BoolResult br = new BoolResult();
            try
            {
                if (jsonStr == null || jsonStr.Trim() == "")
                {
                    br.Esito = false;
                    br.error = "Il JSON fornito è vuoto o nullo.";
                    return br;
                }


                this.freeSource = jsonStr.Replace("\n", "").Replace("\t", "").Replace("\t", "");

                using (StreamWriter sw = new StreamWriter(this.pathExternalSource, false))
                {
                    sw.WriteLine(this.freeSource);
                }

                this.source.ToString();
                this.source = JsonConvert.DeserializeObject<DbFormati>(this.freeSource)!.source;
                
                this.SaveChanges();

                br.Esito = true;
            }
            catch (Exception ex)
            {
                br.Esito = false;
                br.error = ex.ToString();
                return br;
            }

            return br;
        }

        public string freeSource { get; set; } = "";

    }
    public class DbTipoDiExport
    {
        public static readonly string dbSourceName = "TipiDiExport.json";

        private string pathExternalSource="";
        public List<TipoDiExport> source { get; set; } = new List<TipoDiExport>();

        public void SetExternalPath(string pathExternalSource)
        {
            this.pathExternalSource = pathExternalSource + "Source" + DbTipoDiExport.dbSourceName;
        }

        public bool SaveChanges()
        {
            string jsonStr = JsonConvert.SerializeObject(this);

            using (StreamWriter sw = new StreamWriter(this.pathExternalSource, false))
            {
                sw.WriteLine(jsonStr);
            }

            return true;
        }

        public BoolResult SetJsonSource(string jsonStr)
        {
            BoolResult br = new BoolResult();
            try
            {
                if (jsonStr == null || jsonStr.Trim() == "")
                {
                    br.Esito = false;
                    br.error = "Il JSON fornito è vuoto o nullo.";
                    return br;
                }


                this.freeSource = jsonStr.Replace("\n", "").Replace("\t", "").Replace("\t", "");

                using (StreamWriter sw = new StreamWriter(this.pathExternalSource, false))
                {
                    sw.WriteLine(this.freeSource);
                }

                br.Esito = true;
            }
            catch (Exception ex)
            {
                br.Esito = false;
                br.error = ex.ToString();
                return br;
            }

            return br;
        }

        public string freeSource { get; set; } = "";


    }

    public class DbDeclinazioniKit
    {
        public static readonly string dbSourceName = "DeclinazioniKit.json";

        private string pathExternalSource="";
        public List<FicoDeclinazioneKit> source { get; set; } = new List<FicoDeclinazioneKit>();

        public void SetExternalPath(string pathExternalSource)
        {
            this.pathExternalSource = pathExternalSource + "Source" + DbDeclinazioniKit.dbSourceName;
        }

        public bool SaveChanges()
        {
            string jsonStr = JsonConvert.SerializeObject(this);

            using (StreamWriter sw = new StreamWriter(this.pathExternalSource, false))
            {
                sw.WriteLine(jsonStr);
            }

            return true;
        }


    }

    public class DbLoghiBolli
    {
        public static readonly string dbSourceName = "LoghiBolli.json";
        private string pathExternalSource="";
        public List<LogoBollo> source { get; set; } = new List<LogoBollo>();

        public void SetExternalPath(string pathExternalSource)
        {
            this.pathExternalSource = pathExternalSource + "Source" + DbLoghiBolli.dbSourceName;
        }

        public bool SaveChanges()
        {
            string jsonStr = JsonConvert.SerializeObject(this);

            using (StreamWriter sw = new StreamWriter(this.pathExternalSource, false))
            {
                sw.WriteLine(jsonStr);
            }

            return true;
        }
    }

    public class InputFotoSync
    {
        public IFormFile? file { get; set; }

    }

    // Istanta4 - caricamento manuale di una foto da Archivio (vedi ArchivioController.caricaFotoManuale)
    public class InputFotoArchivio
    {
        public IFormFile? file { get; set; }
        public string? codice { get; set; }
        public string? area { get; set; }
        public string? canale { get; set; }
    }
    public class ScanResult
    {
        public string filename { get; set; } = "";
        public string error { get; set; } = "";
    }


    public class InputLogoBollo
    {
        public string Id { get; set; } = "";//Olympus ID
        public string Sigla { get; set; } = "";
        public TipoFoto Tipo { get; set; } = TipoFoto.Foto;
        public IFormFile? file { get; set; }

    }

    public class LogoBolloOperationResult
    {
        public LogoBollo? item { get; set; }
        public bool esito { get; set; }
        public string error { get; set; } = "";
    }




    #endregion

    #region FICO NamingConvention
    public class DbNamingConvention
    {
        public static readonly string dbSourceName = "NamingConvention.json";

        private string pathExternalSource="";
        public List<FicoNamingConventionComponent> components { get; set; }= new List<FicoNamingConventionComponent>();
        public List<FicoNamingConventionCombinazione> combinazioni { get; set; } = new List<FicoNamingConventionCombinazione>();

        public void SetExternalPath(string pathExternalSource)
        {
            this.pathExternalSource = pathExternalSource + "Source" + DbNamingConvention.dbSourceName;
        }

        public bool SaveChanges()
        {
            string jsonStr = JsonConvert.SerializeObject(this);

            using (StreamWriter sw = new StreamWriter(this.pathExternalSource, false))
            {
                sw.WriteLine(jsonStr);
            }

            return true;
        }

        public BoolResult SetJsonSource(string jsonStr)
        {
            BoolResult br = new BoolResult();
            try
            {
                if (jsonStr == null || jsonStr.Trim() == "")
                {
                    br.Esito = false;
                    br.error = "Il JSON fornito è vuoto o nullo.";
                    return br;
                }


                this.freeSource = jsonStr.Replace("\n", "").Replace("\t", "").Replace("\t", "");

                using (StreamWriter sw = new StreamWriter(this.pathExternalSource, false))
                {
                    sw.WriteLine(this.freeSource);
                }

                br.Esito = true;
            }
            catch (Exception ex)
            {
                br.Esito = false;
                br.error = ex.ToString();
                return br;
            }

            return br;
        }

        public string freeSource { get; set; } = "";

    }

    #endregion

    #region Confronti

    public class DbConfronto
    {
        public static readonly string dbSourceName = "Confronto.json";

        private string pathExternalSource="";
        public List<DbConfrontoCampoDiControllo> campiDiControllo { get; set; } = new List<DbConfrontoCampoDiControllo>();

        public void SetExternalPath(string pathExternalSource)
        {
            this.pathExternalSource = pathExternalSource + "Source" + DbConfronto.dbSourceName;
        }

        public BoolResult SetJsonSource(string jsonStr)
        {
            BoolResult br = new BoolResult();
            try
            {
                var db = JsonConvert.DeserializeObject<DbConfronto>(jsonStr);
                this.campiDiControllo = db!.campiDiControllo;
                this.SaveChanges();

                br.Esito = true;
            }
            catch (Exception ex)
            {
                br.Esito = false;
                br.error = ex.ToString();
                return br;
            }

            return br;
        }

        public bool SaveChanges()
        {
            string jsonStr = JsonConvert.SerializeObject(this);

            using (StreamWriter sw = new StreamWriter(this.pathExternalSource, false))
            {
                sw.WriteLine(jsonStr);
            }

            return true;
        }


    }

    #endregion


    public partial class Aree
    {
        public Int64 Id { get; set; }
        public string Area { get; set; } = null!;
        public string Canale { get; set; } = null!;
        public string? Descrizione { get; set; }
        public short GruppoSiti { get; set; }
        public byte? IndiceVisualizzazione { get; set; }
        public byte? IndiceCombo { get; set; }

    }


    public class DbAree
    {
        public List<Aree> source=new List<Aree>();
    }

    public class DbMenabo
    {
        public string libAutoSelezione="";
        public string libOrdinamentoLista="";
        public string libAutoImpaginazioneMeccanica = "";
        public List<string> formatiMenaboPagina = new List<string>();
        public List<DbMenaboItem> source = new List<DbMenaboItem>();
        public List<listaSetRegole> automatismo = new List<listaSetRegole>();
    }
    public class DbMenaboItem
    {
        public Int64 Id;
        public string Titolo="";
        public List<string> Aree=new List<string>();
        public Int64 IdMenaboPagine;

        public string ToAreeString()
        {
            return String.Join(",", this.Aree);
        }
    }

    public class DbMenaboPagine
    {
        public List<DbMenaboPagineItem> source=new List<DbMenaboPagineItem>();
    }

    public class DbMenaboPagineItem
    {
        public Int64 Id;
        public string Titolo="";
        public List<DbMenaboPagineItemPagina> Pagine =  new List<DbMenaboPagineItemPagina>();
    }
    public class DbMenaboPagineItemPagina
    {
        public Int16 Numero { get; set; }
        public Int16 IdMastro { get; set; }
    }

    public class DbMastro
    {
        public List<DbMastroItem> source=new List<DbMastroItem>();
    }
    public class DbMastroItem
    {
        public Int64 Id;
        public string Nome="";
        public string Formato="";
        public List<string> Associazioni = new List<string>();
        public string MeccanicaDefault="";
        public bool Active = true;
    }

    public class DbCustomPlugin
    {
        public static readonly string dbSourceName = "SourceCustomPlugin.json";

        [JsonIgnore] private string _basePath = "";
        [JsonIgnore] private string _fullPath => Path.Combine(_basePath ?? "", dbSourceName);

        public AgenziaCustomPlugin DB = new AgenziaCustomPlugin();

        public static DbCustomPlugin Load(string basePath)
        {
            var db = new DbCustomPlugin();
            db.SetExternalPath(basePath);

            var fullPath = Path.Combine(basePath ?? "", dbSourceName);
            if (!File.Exists(fullPath))
            {
                // Migrazione opzionale da file legacy (se presenti)
                //db.TryMigrateLegacy(basePath);
                db.SaveChanges(); // crea il file unificato
                return db;
            }

            var json = File.ReadAllText(fullPath);
            var loaded = JsonConvert.DeserializeObject<AgenziaCustomPlugin>(json) ?? new AgenziaCustomPlugin();
            db.DB = loaded;
            return db;
        }

        public void SetExternalPath(string pathExternalSource)
        {
            this._basePath = pathExternalSource;
        }

        public void SaveChanges()
        {
            if (string.IsNullOrWhiteSpace(_basePath))
                throw new InvalidOperationException("BasePath non impostato via SetExternalPath.");

            //var dir = Path.Combine(_basePath, "Source");
            //if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);

            var jsonStr = JsonConvert.SerializeObject(this.DB);
            using (var sw = new StreamWriter(_fullPath))
            {
                sw.WriteLine(jsonStr);
            }
        }

        public BoolResult SetJsonSource(string jsonStr)
        {
            BoolResult br = new BoolResult();
            try
            {
                var db = JsonConvert.DeserializeObject<AgenziaCustomPlugin>(jsonStr);
                this.DB = db;
                this.SaveChanges();

                br.Esito = true;
            }
            catch (Exception ex)
            {
                br.Esito = false;
                br.error = ex.ToString();
                return br;
            }

            return br;
        }
    }

    public class MastroAssociazioni
    {
        public List<string> Associazioni { get; set; }=new List<string>();
    }

    public class DbUnitaItem
    {
        public int id;
        public string path = "";
        public int priorita;
        public bool syncFolder;
        public bool webFolder;
        public bool exportFolder;
        public string credentials = "";
        public List<DbUnitaRule> rules=new List<DbUnitaRule>();
    }
    public class DbUnitaRule
    {
        public string splitChar = "";
        public DbUnitaRuleField? bindField;
    }
    public class DbUnitaRuleField
    {
        public string name = "";
        public int index;
        public string[] regex=new string[] { };
        public string[] ignoringKeys= new string[] { };
    }
    public class DbUnita
    {
        public List<DbUnitaItem> source=new List<DbUnitaItem>();
    }
    public class DbMeccaniche
    {
        public List<Meccaniche> source=new List<Meccaniche>();
    }
    public class Meccaniche
    {
        public Int64 Id { get; set; }
        public string NomeOrigine { get; set; } = null!;
        public string NomeTraduzione { get; set; } = null!;
        //public string? Mastro { get; set; }
        public string? Formato { get; set; }
        public List<string>? Aree { get; set; }
        public List<regoleMeccanica> Regole { get; set; } = new List<regoleMeccanica>();
    }

    public class DbConfrontoCampoDiControllo
    {
        public string nome = "";
        public string[] rules = new string[] { };//Per ora mettiamolo come array di stringhe poi vedremo come definirlo
    }

    public class regoleMeccanica //deprecato
    {
        public List<string> Value { get; set; } = new List<string>();
        public string Campo { get; set; } = "";
        public string Operatore { get; set; } = "";
    }

    public class DbDeclinazioneMeccaniche
    {
        public List<DeclinazioneMeccanica> source=new List<DeclinazioneMeccanica>();
        public List<CombinazioniMeccaniche> combinazioniMeccaniche=new List<CombinazioniMeccaniche>();
        public List<DeclinazioneMeccanicaAvanzata> meccanicheAvanzate=new List<DeclinazioneMeccanicaAvanzata>();
        public List<RimozioneDeclinazioneMeccanica> meccanicheInRimozione=new List<RimozioneDeclinazioneMeccanica>();
        public List<string> meccanicheInvalidate = new List<string>();
        public string meccanicaDefault="";

        public static readonly string dbSourceName = "DeclinazioneMeccaniche.json";
        private string pathExternalSource="";

        public void SetExternalPath(string pathExternalSource)
        {
            this.pathExternalSource = pathExternalSource + "Source" + DbDeclinazioneMeccaniche.dbSourceName;
        }

        public BoolResult SetJsonSource(string jsonStr)
        {
            BoolResult br = new BoolResult();
            try
            {
                var db = JsonConvert.DeserializeObject<DbDeclinazioneMeccaniche>(jsonStr);
                this.source = db!.source;
                this.meccanicaDefault = db.meccanicaDefault;
                this.combinazioniMeccaniche = db.combinazioniMeccaniche;
                this.meccanicheAvanzate = db.meccanicheAvanzate;
                this.meccanicheInRimozione = db.meccanicheInRimozione;
                this.meccanicheInvalidate = db.meccanicheInvalidate;
                this.SaveChanges();

                br.Esito = true;
            }
            catch (Exception ex)
            {
                br.Esito = false;
                br.error = ex.ToString();
                return br;
            }

            return br;
        }


        public bool SaveChanges()
        {
            string jsonStr = JsonConvert.SerializeObject(this);

            using (StreamWriter sw = new StreamWriter(this.pathExternalSource, false))
            {
                sw.WriteLine(jsonStr);
            }

            return true;
        }

    }

    public class MeccanicheLivello
    {
        // Proprietà per la lista di DeclinazioneMeccanica
        public List<DeclinazioneMeccanica> Meccaniche { get; set; }

        // Proprietà per il livello
        public float Livello { get; set; }

        // Costruttore per inizializzare la lista e il livello
        public MeccanicheLivello(float livello)
        {
            Meccaniche = new List<DeclinazioneMeccanica>();
            Livello = livello;
        }
    }

    public class DeclinazioneMeccanica
    {
        public Int64 Id { get; set; }
        public string Nome { get; set; } = "";
        public float Livello { get; set; }
        public string Formato { get; set; } = "";
        public List<List<RegolaComparazionePerEtichetta>>? Regole { get; set; }
    }

    public class DeclinazioneMeccanicaAvanzata
    {
        public Int64 Id { get; set; }
        public string Nome { get; set; } = "";
        public float LivelloMeccanica { get; set; }
        public float LivelloEsternoMeccanicaAvanzata { get; set; }
        public string Formato { get; set; } = "";
        public List<RegolaComparazioneMeccanicaAvanzata> Regole { get; set; } = new List<RegolaComparazioneMeccanicaAvanzata>();
    }

    public class RimozioneDeclinazioneMeccanica
    {
        public Int64 Id { get; set; }
        public string Nome { get; set; } = "";
        public float LivelloMeccanica { get; set; }
        public float LivelloEsternoMeccanicaAvanzata { get; set; }
        public timeToApplyOperation timeToApply { get; set; }
        public List<RegolaComparazioneMeccanicaAvanzata> Regole { get; set; } = new List<RegolaComparazioneMeccanicaAvanzata>();
    }

    public class DbRegoleMastro
    {
        public List<RegoleMastro> source= new List<RegoleMastro>();
    }

    public class RegoleMastro
    {
        public int Id { get; set; }
        public string Nome { get; set; } = "";
        public List<List<RegolaComparazionePerEtichetta>> Regole { get; set; } = new List<List<RegolaComparazionePerEtichetta>>();

        public List<SpecificheMastro> Specifiche { get; set; } = new List<SpecificheMastro>();
    }

    public class SpecificheMastro
    {
        public string etichetta { get; set; } = "";
        public tipoElemento tipoElemento { get; set; }
        public string value { get; set; } = "";
    }

    public enum tipoElemento
    {
        FillColor = 0,
        TextColor = 1,
        CharacterStyle = 2,
        ParagraphStyle = 3,
        BorderColor = 4,
    }
    public class CombinazioniMeccaniche
    {
        public Int64 Id { get; set; }
        public string NomeCombinazione { get; set; } = "";
        public string Formato { get; set; } = "";

    }

    public class RegolaComparazionePerEtichetta
    {
        public string nomeEtichetta { get; set; } = "";
        public bool presente { get; set; }
    }

    public class RegolaComparazionePerMeccanica
    {
        public int idMeccanica { get; set; }
        public string nomeMeccanica { get; set; } = "";
        public bool presente { get; set; }
    }

    public class RegolaComparazioneMeccanicaAvanzata
    {
        public bool EsclusivitaMeccanicheCoinvolte { get; set; }
        public List<RegolaComparazionePerEtichetta> regoleEtichetta { get; set; } = new List<RegolaComparazionePerEtichetta>();
        public List<RegolaComparazionePerMeccanica> regoleMeccanica { get; set; } = new List<RegolaComparazionePerMeccanica>();
    }

    public class DbEtichetta
    {
        public static readonly string dbSourceName = "EtichetteRef.json";

        private string pathExternalSource="";

        public void SetExternalPath(string pathExternalSource)
        {
            this.pathExternalSource = pathExternalSource + "Source" + DbEtichetta.dbSourceName;
        }

        public BoolResult SetJsonSource(string jsonStr)
        {
            BoolResult br = new BoolResult();
            try
            {
                var db = JsonConvert.DeserializeObject<DbEtichetta>(jsonStr);
                this.source = db!.source;
                this.SaveChanges();

                br.Esito = true;
            }
            catch (Exception ex)
            {
                br.Esito = false;
                br.error = ex.ToString();
                return br;
            }

            return br;
        }


        public bool SaveChanges()
        {
            string jsonStr = JsonConvert.SerializeObject(this);

            using (StreamWriter sw = new StreamWriter(this.pathExternalSource, false))
            {
                sw.WriteLine(jsonStr);
            }

            return true;
        }

        public List<EtichettaItem> source=new List<EtichettaItem>();
    }

    public class EtichettaItem
    {
        public Int64 Id { get; set; }
        public string Etichetta { get; set; } = "";
        public string? Visual { get; set; }
        public string? Raccolta { get; set; }
        public List<List<RegolaComparazioneEtichetta>> Regole { get; set; } = new List<List<RegolaComparazioneEtichetta>>();

    }

    public class SetRegoleEtichette
    {
        public List<RegolaComparazioneEtichetta> Regole { get; set; } = new List<RegolaComparazioneEtichetta>();
    }

    public class RegolaComparazioneEtichetta
    {
        public string Value { get; set; } = "";
        public string campo { get; set; } = "";
        public string Operatore { get; set; } = "";
    }

    public class PopMateriale
    {
        public int Id { get; set; }
        public string Nome { get; set; } = "";
        public string Codice { get; set; } = "";
        public Byte Associazione { get; set; }
        public int EreditaDa { get; set; } = 0; //Specifica un ID Materiale dal quale ereditare tutte le combinazioni per evitare di duplicarle per il materiale in esame
    }
    public class PopCategoria
    {
        public int Id { get; set; }
        public string Nome { get; set; } = "";

    }

    public class PopFormato
    {
        public int Id { get; set; }
        public string Nome { get; set; } = "";
    }

    public class DbPopCombinazioni
    {
        public List<PopMateriale> Materiali { get; set; } = new List<PopMateriale>();
        public List<PopFormato> Formati { get; set; } = new List<PopFormato>();
        public List<PopCategoria> Categorie { get; set; } = new List<PopCategoria>();
        public List<PopCombinazione> Combinazioni { get; set; } = new List<PopCombinazione>();
        public Dictionary<string, object> optionsScheme { get; set; }= new Dictionary<string, object>();
    }

    public class PopCombinazione
    {
        public int Id { get; set; }
        public int IdMateriale { get; set; }
        public int IdArea { get; set; }
        public int IdCategoria { get; set; }
        public int IdFormato { get; set; }
        public bool Attivo { get; set; }
        public Dictionary<string, object> Options { get; set; } = new Dictionary<string, object>();
    }

    //public class DbLoghiBolli
    //{
    //    public List<string> source;
    //}

    public class JsonDbClassificazioneUniversale
    {
        public bool universale = false;
        public string sheet="";
        public int IdProg { get; set; }
        public ClassificazioneBinding? bindings;
        public List<ClassificazioneUniversale> lista { get; set; } = new List<ClassificazioneUniversale>();
    }
    public class ClassificazioneUniversale
    {
        public string area = "";
        public int areaIndex { get; set; }
        public string settore = "";
        public int settoreIndex { get; set; }
        public string reparto = "";
        public int repartoIndex { get; set; }
        public string categoria = "";
        public int categoriaIndex { get; set; }
        public int orderIndex { get; set; }
    }



    //Classe che definisce le veicolazioni dei 4 campi.
    //In ognuno di essi, se esiste va indicato il campo da leggere nel tracciato
    public class ClassificazioneBinding
    {
        public BindingItem? area;
        public BindingItem? settore;
        public BindingItem? reparto;
        public BindingItem? categoria;
    }

    public class BindingItem
    {
        public List<BindingItemRule> rules = new List<BindingItemRule>();
        public string campoMeta { get; set; } = "";
    }
    public class BindingItemRule
    {
        public int id;
        public string definizione="";
        public List<string> valoridaRicercare=new List<string>();
    }

    public enum timeToApplyOperation
    {
        nonSpecificato,
        applyBefore,
        applyAfter,
    }

    //public class DbFrameworkCss
    //{
    //    public string defaultBox { get; set; }
    //    public List<livelloCssFramework> livelli { get; set; }
    //}

    //public class DbFrameworkCss
    //{
    //    public static readonly string dbSourceName = "FrameworkCss.json";

    //    private string pathExternalSource;

    //    public void SetExternalPath(string pathExternalSource)
    //    {
    //        this.pathExternalSource = pathExternalSource + "Source" + DbFrameworkCss.dbSourceName;
    //    }

    //    public BoolResult SetJsonSource(string jsonStr)
    //    {
    //        BoolResult br = new BoolResult();
    //        try
    //        {
    //            var db = JsonConvert.DeserializeObject<DbFrameworkCss>(jsonStr);
    //            this.livelli = db.livelli;
    //            this.defaultBox = db.defaultBox;
    //            this.SaveChanges();

    //            br.Esito = true;
    //        }
    //        catch (Exception ex)
    //        {
    //            br.Esito = false;
    //            br.error = ex.ToString();
    //            return br;
    //        }

    //        return br;
    //    }


    //    public bool SaveChanges()
    //    {
    //        string jsonStr = JsonConvert.SerializeObject(this);

    //        using (StreamWriter sw = new StreamWriter(this.pathExternalSource, false))
    //        {
    //            sw.WriteLine(jsonStr);
    //        }

    //        return true;
    //    }

    //    public string defaultBox { get; set; }
    //    public List<livelloCssFramework> livelli { get; set; } = new List<livelloCssFramework>();
    //}

    public class DbFrameworkCss
    {
        public static readonly string dbSourceName = "SourceFrameworkCss.json";

        [JsonIgnore] private string _basePath="";
        [JsonIgnore] private string _fullPath => Path.Combine(_basePath ?? "", dbSourceName);

        public string defaultBox { get; set; } = "";
        public List<livelloCssFramework> livelli { get; set; } = new List<livelloCssFramework>();

        // NUOVO: sezione allineamenti nel file unico
        public DbRidimensionamentiAllineamenti dbRidimensionamentiAllineamenti { get; set; } = new DbRidimensionamentiAllineamenti();

        public void SetExternalPath(string pathExternalSource)
        {
            this._basePath = pathExternalSource + DbFrameworkCss.dbSourceName;
        }

        public BoolResult SetJsonSource(string jsonStr)
        {
            var br = new BoolResult();
            try
            {
                if (string.IsNullOrWhiteSpace(jsonStr))
                    throw new Exception("JSON nullo o vuoto.");

                // Deserializzo il payload della pagina "Framework" (può NON contenere dbAllineamenti)
                var incoming = JsonConvert.DeserializeObject<DbFrameworkCss>(jsonStr);
                if (incoming == null) throw new Exception("JSON non compatibile con DbFrameworkCss.");

                // Merge conservativo: se il payload non ha la sezione allineamenti, preserva quella attuale
                var keepAllineamenti = this.dbRidimensionamentiAllineamenti;
                this.defaultBox = incoming.defaultBox;
                this.livelli = incoming.livelli ?? new List<livelloCssFramework>();
                this.dbRidimensionamentiAllineamenti = incoming.dbRidimensionamentiAllineamenti ?? keepAllineamenti;

                SaveChanges();
                br.Esito = true;
            }
            catch (Exception ex)
            {
                br.Esito = false;
                br.error = ex.ToString();
            }
            return br;
        }

        // NUOVO: usato dalla pagina "Allineamenti" (editor di sezione)
        public BoolResult SetAllineamentiJsonSource(string jsonStr)
        {
            var br = new BoolResult();
            try
            {
                if (string.IsNullOrWhiteSpace(jsonStr))
                    throw new Exception("JSON nullo o vuoto.");

                var incoming = JsonConvert.DeserializeObject<DbRidimensionamentiAllineamenti>(jsonStr);
                if (incoming == null) throw new Exception("JSON non compatibile con DbAllineamentiData.");

                this.dbRidimensionamentiAllineamenti = incoming;
                SaveChanges();
                br.Esito = true;
            }
            catch (Exception ex)
            {
                br.Esito = false;
                br.error = ex.ToString();
            }
            return br;
        }

        public void SaveChanges()
        {
            if (string.IsNullOrWhiteSpace(_basePath))
                throw new InvalidOperationException("BasePath non impostato via SetExternalPath.");

            //var dir = Path.Combine(_basePath, "Source");
            //if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);

            var jsonStr = JsonConvert.SerializeObject(this);
            using (var sw = new StreamWriter(_basePath))
            {
                sw.WriteLine(jsonStr);
            }
        }

        // Utility di caricamento centralizzata
        public static DbFrameworkCss Load(string basePath)
        {
            var db = new DbFrameworkCss();
            db.SetExternalPath(basePath);

            var fullPath = Path.Combine(basePath ?? "", dbSourceName);
            if (!File.Exists(fullPath))
            {
                // Migrazione opzionale da file legacy (se presenti)
                //db.TryMigrateLegacy(basePath);
                db.SaveChanges(); // crea il file unificato
                return db;
            }

            var json = File.ReadAllText(fullPath);
            var loaded = JsonConvert.DeserializeObject<DbFrameworkCss>(json) ?? new DbFrameworkCss();
            //loaded.SetExternalPath(basePath);
            return loaded;
        }

        private void TryMigrateLegacy(string basePath)
        {
            // Framework legacy: SourceFrameworkCss.json (già il nome giusto)
            var fwPath = Path.Combine(basePath, "SourceFrameworkCss.json");
            if (File.Exists(fwPath))
            {
                var j = JObject.Parse(File.ReadAllText(fwPath));
                var fw = j.ToObject<DbFrameworkCss>();
                if (fw != null)
                {
                    this.defaultBox = fw.defaultBox;
                    this.livelli = fw.livelli ?? new List<livelloCssFramework>();
                }
            }

            // Allineamenti legacy: SourceAllineamenti.json
            var alPath = Path.Combine(basePath, "SourceAllineamenti.json");
            if (File.Exists(alPath))
            {
                // PRIMA avevi raw → ora pretendo JSON valido della sezione
                // Se in passato salvavi un oggetto già JSON, lo deserializza; altrimenti gestiscilo come serve qui.
                var raw = File.ReadAllText(alPath);
                try
                {
                    var al = JsonConvert.DeserializeObject<DbRidimensionamentiAllineamenti>(raw);
                    if (al != null) this.dbRidimensionamentiAllineamenti = al;
                }
                catch
                {
                    // Se proprio fosse raw non compatibile, lo metto in una nota per non perdere dati
                    this.dbRidimensionamentiAllineamenti = new DbRidimensionamentiAllineamenti { noteLegacy = "Contenuto legacy non JSON valido", rawLegacy = raw };
                }
            }
        }
    }

    // Sezione allineamenti serializzata nel file unico
    public class DbRidimensionamentiAllineamenti
    {
        public List<dbModifiche> modificheCssPerKit { get; set; } = new List<dbModifiche>();

        // Campi opzionali solo per migrazione/diagnostica; puoi rimuoverli quando sei sicuro
        [JsonProperty(NullValueHandling = NullValueHandling.Ignore)]
        public string noteLegacy { get; set; } = "";

        [JsonProperty(NullValueHandling = NullValueHandling.Ignore)]
        public string rawLegacy { get; set; } = "";
    }

    public class livelloCssFramework
    {
        public int id { get; set; }
        public int ordine { get; set; }
        public List<DefinizioniCssFramework> definizioni { get; set; } = new List<DefinizioniCssFramework>();
    }

    public class DefinizioniCssFramework
    {
        public int id { get; set; }
        public bool virtualElement { get; set; } = false;
        public string result { get; set; }="";
        public string descrizione { get; set; } = "";
        public int ordine { get; set; }
        public List<macroRegolaCssFramework> regole { get; set; } = new List<macroRegolaCssFramework>();
        //public List<SpecificheFrameCss> specifiche { get; set; } = new List<SpecificheFrameCss>();
    }

    public class regolaCssFramework
    {
        public string Value { get; set; } = "";
        public string campo { get; set; } = "";
        public string Operatore { get; set; }="";
    }

    public class macroRegolaCssFramework
    {
        public int id { get; set; }
        public int deepness { get; set; } = 0;
        public List<regolaCssFramework> regole { get; set; } = new List<regolaCssFramework>();
        public List<macroRegolaCssFramework> regoleAnnidate { get; set; } = new List<macroRegolaCssFramework>();
    }

    public class SpecificheFrameCss
    {
        public int id { get; set; }
        public operationFrameEnum tipoOperazione { get; set; }
        public string nomeCampoIndd { get; set; } = "";
        public List<SpecificaFrameCss> specifica { get; set; }=new List<SpecificaFrameCss>();
    }

    public class SpecificaFrameCss
    {
        //value è usato da style e potenzialmente da constraint
        public string value { get; set; } = "";

        //regole
        List<macroRegolaCssFramework> setRegole { get; set; } = new List<macroRegolaCssFramework>();

        //style
        public styleEnum style { get; set; }

        //constraint ancora da implementare
    }

    public class DbMappaStili
    {
        public static readonly string dbSourceName = "MappaStili.json";

        private string pathExternalSource="";

        public void SetExternalPath(string pathExternalSource)
        {
            this.pathExternalSource = pathExternalSource + "Source" + DbMappaStili.dbSourceName;
        }

        public BoolResult SetJsonSource(string jsonStr)
        {
            BoolResult br = new BoolResult();
            try
            {
                if (jsonStr == null || jsonStr.Trim() == "")
                {
                    br.Esito = false;
                    br.error = "Il JSON fornito è vuoto o nullo.";
                    return br;
                }


                this.freeSource = jsonStr.Replace("\n", "").Replace("\t", "").Replace("\t", "");
                this.SaveChanges();

                br.Esito = true;
            }
            catch (Exception ex)
            {
                br.Esito = false;
                br.error = ex.ToString();
                return br;
            }

            return br;
        }


        public bool SaveChanges()
        {
            string jsonStr = this.freeSource;

            using (StreamWriter sw = new StreamWriter(this.pathExternalSource, false))
            {
                sw.WriteLine(jsonStr);
            }

            return true;
        }

        public string freeSource { get; set; } = "";
    }

    public class DbOrdinamentoLista
    {
        public static readonly string dbSourceName = "OrdinamentoLista.json";

        private string pathExternalSource="";

        public void SetExternalPath(string pathExternalSource)
        {
            this.pathExternalSource = pathExternalSource + "Source" + DbOrdinamentoLista.dbSourceName;
        }

        public BoolResult SetJsonSource(string jsonStr)
        {
            BoolResult br = new BoolResult();
            try
            {
                if (jsonStr == null || jsonStr.Trim() == "")
                {
                    br.Esito = false;
                    br.error = "Il JSON fornito è vuoto o nullo.";
                    return br;
                }


                this.freeSource = jsonStr.Replace("\n", "").Replace("\t", "").Replace("\t", "");
                this.SaveChanges();

                br.Esito = true;
            }
            catch (Exception ex)
            {
                br.Esito = false;
                br.error = ex.ToString();
                return br;
            }

            return br;
        }


        public bool SaveChanges()
        {
            string jsonStr = this.freeSource;

            using (StreamWriter sw = new StreamWriter(this.pathExternalSource, false))
            {
                sw.WriteLine(jsonStr);
            }

            return true;
        }

        public string freeSource { get; set; } = "";
    }


    public enum operationFrameEnum
    {
        error = 0,
        style = 1,
        constraint = 2,
        delete = 3,
    }

    public enum styleEnum
    {
        FillColor = 0,
        TextColor = 1,
        CharacterStyle = 2,
        ParagraphStyle = 3,
        BorderColor = 4,
    }

    public class SourceJsonRequest
    {
        public string jsoncode { get; set; } = "";
        public string origin { get; set; } = "";
    }

    //public class DbAllineamenti
    //{
    //    public static readonly string dbSourceName = "Allineamenti.json";

    //    public List<dbModifiche> DbModificheCss = new List<dbModifiche>();
    //    public string pathExternalSource { get; set; }
    //    public string freeSource { get; set; }

    //    public string version = "1.0.0.0";


    //    public void SetExternalPath(string pathExternalSource)
    //    {
    //        this.pathExternalSource = pathExternalSource + "Source" + DbAllineamenti.dbSourceName;
    //    }

    //    public BoolResult SetJsonSource(string jsonStr)
    //    {
    //        BoolResult br = new BoolResult();
    //        try
    //        {
    //            if (jsonStr == null || jsonStr.Trim() == "")
    //            {
    //                br.Esito = false;
    //                br.error = "Il JSON fornito è vuoto o nullo.";
    //                return br;
    //            }


    //            this.freeSource = jsonStr.Replace("\n", "").Replace("\t", "").Replace("\t", "");

    //            this.SaveChanges();

    //            br.Esito = true;
    //        }
    //        catch (Exception ex)
    //        {
    //            br.Esito = false;
    //            br.error = ex.ToString();
    //            return br;
    //        }

    //        return br;
    //    }

    //    public bool SaveChanges()
    //    {
    //        string jsonStr = this.freeSource;

    //        using (StreamWriter sw = new StreamWriter(this.pathExternalSource, false))
    //        {
    //            sw.WriteLine(jsonStr);
    //        }

    //        return true;
    //    }

    //}

    public class dbModifiche
    {
        public List<modificheCssBox> operazioniPerBox = new List<modificheCssBox>();

        public KitCondition kit = new KitCondition();
    }

    public class modificheCssBox
    {
        public List<string> nomiBox = new List<string>();

        public List<RidimensionamentoObj> ridimensionamenti = new ();

        public List<PostRidimensionamentoObj> postRidimensionamenti = new();
        public List<Allineamento> allineamenti { get; set; } = new();
        public List<SegnalazioniConflitti> segnalazioniConflitti { get; set; } = new();
    }


    /// Un gruppo di allineamento (un “blocco” logico).

    public class RidimensionamentoObj
    {
        public string nomeGruppo { get; set; } = "";
        /// Etichette che si muovono come un blocco.
        public List<string> gruppoEtichette { get; set; } = new();

        /// Etichette per cui dobbiamo agire sull'itemLink.
        public List<string> itemLinks { get; set; } = new();

        /// Impostazioni di ridimensionamento per asse.
        public Ridimensionamento? ridimensionamento { get; set; }

        public List<FitClass> finalFit { get; set; } = new List<FitClass>();

        public List<SetCondizioni> listSetCondizioni { get; set; } = new List<SetCondizioni>();

    }

    public class PostRidimensionamentoObj
    {
        public string nomeGruppo { get; set; } = "";
        public int ordine { get; set; } = 999999;

        /// Etichette che si muovono come un blocco.
        public List<string> gruppoEtichette { get; set; } = new();

        /// Etichette per cui dobbiamo agire sull'itemLink.
        public List<string> itemLinks { get; set; } = new();

        /// Impostazioni di ridimensionamento per asse.
        public List<PostRidimensionamenti>? ridimensionamenti { get; set; } = new List<PostRidimensionamenti>();

        public List<FitClass> finalFit { get; set; } = new List<FitClass>();
    }

    /// Come reagiscono X e Y al ridimensionamento.
    public class PostRidimensionamenti
    {

        /// Se null, trattato come SpostamentoLineare.
        public string? instructionX { get; set; }

        /// Se null, trattato come SpostamentoLineare.
        public string? instructionY { get; set; }

        public string? setWidth { get; set; } = null;

        public string? setHeight { get; set; } = null;

        public List<SetCondizioni> listSetCondizioni { get; set; } = new List<SetCondizioni>();

    }

    public class FitClass
    {
        public List<string> nomiElementi { get; set; } = new List<string>();

        public List<FitOperation> fit { get; set; } = new();

    }

    public class Allineamento
    {
        /// Nome usato per riferirsi al gruppo.
        public string nomeGruppo { get; set; } = "";
        public int ordine { get; set; } = 999999;

        /// Etichette che si muovono come un blocco.
        public List<string> gruppoEtichette { get; set; } = new();

        /// Etichette per cui dobbiamo agire sull'itemLink.
        public List<string> itemLinks { get; set; } = new();

        /// Righe o Colonne: determina l’allineamento degli elementi sullo stesso livello.
        public LetturaLivelli letturaLivelli { get; set; } = LetturaLivelli.Righe_Bottom_To_Top;

        /// Ordinamento per livelli, eseguiti in ordine di 'Livello' crescente.
        public List<OrdinamentoLivello> ordinamentoLivelli { get; set; } = new();

        /// Spazio fisso tra livelli (mm). Se null viene calcolato automaticamente.
        public double? spacingLivelli { get; set; } = null;

        /// Ancora statica usata soprattutto nel ridimensionamento.
        public List<StaticAnchor> staticAnchor { get; set; } = new List<StaticAnchor>();

        /// Regole per “seguire” un altro gruppo/etichetta.
        public List<FollowAnchor> followAnchor { get; set; } = new List<FollowAnchor>();

        public List<FitClass> finalFit { get; set; } = new();

        public List<SetCondizioni> listSetCondizioni { get; set; } = new List<SetCondizioni>();

        public evitaTracciaGruppo evitaTracciaAllineamento { get; set; } = new evitaTracciaGruppo();

    }

    public class SegnalazioniConflitti
    {
        public string[] segnalazioni { get; set; } = new string[2];
    }
    /// Come reagiscono X e Y al ridimensionamento.
    public class Ridimensionamento
    {
        /// Se null, trattato come SpostamentoLineare.
        public AxisResizeMode? x { get; set; }

        /// Se null, trattato come SpostamentoLineare.
        public AxisResizeMode? y { get; set; }

        public List<SetCondizioni> listSetCondizioni { get; set; } = new List<SetCondizioni>();

    }

    /// Ordinamento e allineamento di un livello.
    public class OrdinamentoLivello
    {
        /// Indice del livello (1 = base).
        public int livello { get; set; }

        /// Etichette coinvolte nell’ordinamento.
        public List<string> elementi { get; set; } = new();

        /// Ancora interna: spinge gli elementi in quella direzione quando qualcuno viene rimosso.
        public InternalAnchor internalAnchor { get; set; }

        //in caso sia true indica che l'allineamento del livello avviene controllonda i bounds del testo invece che dell'elemento in caso di textframes
        public bool allineaATextBounds { get; set; } = false;

        /// Spazio fisso tra elementi (mm). Null = auto.
        public double? spacing { get; set; }

        public List<SetCondizioni> listSetCondizioni { get; set; } = new List<SetCondizioni>();

    }

    /// Ancora statica del box di riferimento.
    public class StaticAnchor
    {
        /// Ancora lungo X (vertical line reference + pos X).
        public XAnchorStatic? xAnchor { get; set; } = null;

        /// Ancora lungo Y (horizontal line reference + pos Y).
        public YAnchorStatic? yAnchor { get; set; } = null;
        public List<SetCondizioni> listSetCondizioni { get; set; } = new List<SetCondizioni>();

    }

    /// 
    /// Definizione ancora statica su asse X (posizione rispetto a una linea verticale).
    /// 
    public class XAnchorStatic
    {
        public string distance { get; set; } = "0";
        public bool applyToSingleLevels { get; set; } = false;

        public HorizontalReferenceLine allineaAlLato { get; set; } = HorizontalReferenceLine.Left;
        public HorizontalReferenceLine allineaLato { get; set; } = HorizontalReferenceLine.Left;
    }

    public class YAnchorStatic
    {
        public string distance { get; set; } = "0";

        public bool applyToSingleLevels { get; set; } = false;

        public VerticalReferenceLine allineaAlLato { get; set; } = VerticalReferenceLine.Top;
        public VerticalReferenceLine allineaLato { get; set; } = VerticalReferenceLine.Top;
    }

    /// Regole di “follow” rispetto a un altro gruppo (o singola etichetta).
    public class FollowAnchor
    {
        /// Id del gruppo o nome etichetta da seguire.
        public List<string> nomiGruppiSeguiti { get; set; } = new List<string>();

        /// Regole di follow sull’asse X (distanza verticale e pre-allineamento).
        public FollowOnX? xAnchor { get; set; } = null;

        /// Regole di follow sull’asse Y (distanza orizzontale e pre-allineamento).
        public FollowOnY? yAnchor { get; set; } = null;

        /// Asse prioritario (default: X se non specificato).
        public PriorityAxis priority { get; set; } = PriorityAxis.X;

        public List<SetCondizioni> listSetCondizioni { get; set; } = new List<SetCondizioni>();

        public bool useTextBounds { get; set; } = false;


    }

    /// 
    /// Follow sull’asse X (distanza verticale + pre-allineamento verticale).
    /// 
    public class FollowOnX
    {
        /// Distanza verticale in mm tra la X del gruppo corrente e quella del gruppo seguito.
        public double distance { get; set; } = 0;
        public bool stopOnCollision { get; set; } = false;

        public bool applyToSingleLevels { get; set; } = false;

        public HorizontalReferenceLine allineaAlLato { get; set; } = HorizontalReferenceLine.Left;
        public HorizontalReferenceLine allineaLato { get; set; } = HorizontalReferenceLine.Left;
    }

    /// 
    /// Follow sull’asse Y (distanza orizzontale + pre-allineamento orizzontale).
    /// 
    public class FollowOnY
    {
        /// Distanza orizzontale in mm tra la Y del gruppo corrente e quella del gruppo seguito.
        public double distance { get; set; } = 0;

        public bool stopOnCollision { get; set; } = false;

        public bool applyToSingleLevels { get; set; } = false;


        public VerticalReferenceLine allineaAlLato { get; set; } = VerticalReferenceLine.Top;
        public VerticalReferenceLine allineaLato { get; set; } = VerticalReferenceLine.Top;

    }

    public class SetCondizioni
    {
        public List<Condizione> setCondizioni { get; set; } = new List<Condizione>();
    }

    public class evitaTracciaGruppo
    {
        public bool evitaTracciaBase { get; set; } = false;
        public bool useTextBounds { get; set; } = true; //indica che per il confronto dobbiamo controllare i bounds del testo e non quelli dell'elemento
        public float distance { get; set; } = 0;
    }
    public class Condizione
    {
        public List<string> elementiDaTrovare { get; set; } = new List<string>();
        public List<string> elementiDaNonTrovare { get; set; } = new List<string>();
        public List<TouchCondition> touchCondition { get; set; } = new List<TouchCondition>();
        public List<BoxCondition> boxCondition { get; set; } = new List<BoxCondition>();
        public List<KitCondition> kitCondition { get; set; } = new List<KitCondition>();
    }

    public class KitCondition
    {
        public List<string> canaliValidi { get; set; } = new List<string>();
        public List<string> areeValide { get; set; } = new List<string>();
        public List<int> kitTipoLavorazioniValide { get; set; } = new List<int>();
        public List<string> kitFormatiValidi { get; set; } = new List<string>();
    }

    public class BoxCondition
    {
        public List<string> boxValidi { get; set; } = new List<string>(); //se la lista contiene elementi, il box deve essere uno di questi per essere valida la condizione
        public List<string> boxInvalidi { get; set; } = new List<string>(); //se la lista contiene elementi, il box non deve essere uno di questi per essere valida la condizione
    }

    public class TouchCondition
    {
        public List<string> EtichetteToccanti { get; set; } = new List<string>(); //se almeno uno di questi elementi
        public List<string> EtichetteToccate { get; set; } = new List<string>(); //tocca almeno uno di questi
        public bool TrueOnContact { get; set; } = true; //la condizione è rispettata se l'elemento tocca, se messa a false la condizione è rispettata se non c'è il contatto
        public bool useTextBounds { get; set; } = true; //indica che per il confronto dobbiamo controllare i bounds del testo e non quelli dell'elemento

    }

    /// 
    /// Modalità di ridimensionamento per asse.
    /// 
    public enum AxisResizeMode
    {
        proporzionale,
        ingrandimento_lineare,
        spostamento_lineare,
        spostamento_lineare_centrato
    }

    /// 
    /// Lettura livelli: Righe (allineamento su X) o Colonne (allineamento su Y).
    /// 
    public enum LetturaLivelli
    {
        Colonne_Left_To_Right,
        Colonne_Right_To_Left,
        Righe_Top_To_Bottom,
        Righe_Bottom_To_Top
    }

    /// 
    /// Ancore interne per l’ordinamento di livello.
    /// 
    public enum InternalAnchor
    {
        Left,
        Right,
        Top,
        Bottom
    }

    /// 
    /// Linea verticale di riferimento: Left/Right.
    /// 
    public enum VerticalReferenceLine
    {
        Top,
        Bottom,
        Middle
    }

    /// 
    /// Linea orizzontale di riferimento: Top/Bottom.
    /// 
    public enum HorizontalReferenceLine
    {
        Left,
        Right,
        Middle

    }

    /// 
    /// Asse prioritario nel follow.
    /// 
    public enum PriorityAxis
    {
        X,
        Y
    }

    public enum FitOperation
    {
        FRAME_TO_CONTENT,
        CONTENT_TO_FRAME,
        PROPORTIONALLY,
        FILL_PROPORTIONALLY

    }


}
