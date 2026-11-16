using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Istanta.Models;
using IstantaLib;

namespace Istanta.Utility
{
    /// Le foto extra di una referenza singola o di un gruppo, come le gestiscono la Scheda articolo e
    /// il revisore.
    ///
    /// Un gruppo non ha un articolo suo: le sue foto extra sono le stesse righe ripetute su ogni
    /// articolo del gruppo, con lo stesso GUID (caricarle o collegarle le scrive su tutti). Del gruppo
    /// si mostrano solo quelle che stanno su tutte le referenze: una che manca su qualcuna non e' del
    /// gruppo, e trattarla come tale farebbe credere che il box la porti.
    public static class FotoExtraDiPiuArticoli
    {
        /// I codici di un codice singolo o di gruppo ("123,456"), senza spazi, vuoti e doppioni.
        public static List<string> Codici(string? codice)
        {
            return (codice ?? "").Split(',')
                .Select(c => c.Trim())
                .Where(c => c != "")
                .Distinct()
                .ToList();
        }

        /// Un gruppo e' un codice con piu' referenze.
        public static bool EGruppo(string? codice)
        {
            return Codici(codice).Count > 1;
        }

        /// Una foto extra: ha un tipo e non e' la foto del prodotto.
        public static bool EExtra(ArticoliFoto foto)
        {
            return foto.Tipo.HasValue && foto.Tipo != (byte)TipoFoto.Foto && !string.IsNullOrEmpty(foto.GuidId);
        }

        /// Il JSON di una foto extra che la sezione delle foto mette nella pagina (archivio.js lo legge
        /// per Elimina). Si serializza una copia senza l'articolo: la foto letta con l'articolo e le sue
        /// foto rimanda all'articolo, che rimanda alle foto, e System.Text.Json si fermava sul ciclo.
        /// Il risultato e' quello di sempre, con IdArticoloNavigation null; la foto letta non si tocca.
        public static string JsonPerLaPagina(ArticoliFoto foto)
        {
            return System.Text.Json.JsonSerializer.Serialize(new ArticoliFoto
            {
                Id = foto.Id,
                IdArticolo = foto.IdArticolo,
                Area = foto.Area,
                Canale = foto.Canale,
                PathFoto = foto.PathFoto,
                NomeReale = foto.NomeReale,
                GuidId = foto.GuidId,
                Puntatore = foto.Puntatore,
                DataInserimento = foto.DataInserimento,
                StatoSelezione = foto.StatoSelezione,
                Attiva = foto.Attiva,
                Hash = foto.Hash,
                DataModifica = foto.DataModifica,
                Tipo = foto.Tipo,
                IdArticoloNavigation = null!,
            });
        }

        /// Le foto extra di un articolo, una per nome: dello stesso file possono esistere piu'
        /// versioni, e in elenco ne va una. E' la regola che la Scheda articolo usava gia'.
        public static List<ArticoliFoto> DiUnArticolo(IEnumerable<ArticoliFoto>? foto)
        {
            return (foto ?? Enumerable.Empty<ArticoliFoto>())
                .Where(f => f.Tipo.HasValue && f.Tipo != (byte)TipoFoto.Foto)
                .GroupBy(f => f.NomeReale)
                .Select(g => g.First())
                .ToList();
        }

        /// Le foto extra presenti su tutti gli articoli del gruppo, una per GUID, nell'ordine del primo
        /// articolo. Attiva vale solo se lo e' su tutti: una casella spuntata deve voler dire che il
        /// logo esce con ogni referenza. Le righe restituite sono copie: le entita' lette dal database
        /// non si toccano.
        public static List<ArticoliFoto> ComuniAlGruppo(IReadOnlyList<IEnumerable<ArticoliFoto>?> fotoPerArticolo)
        {
            if (fotoPerArticolo.Count == 0)
            {
                return new List<ArticoliFoto>();
            }

            var extraPerArticolo = fotoPerArticolo
                .Select(foto => (foto ?? Enumerable.Empty<ArticoliFoto>()).Where(EExtra).ToList())
                .ToList();

            var risultato = new List<ArticoliFoto>();
            foreach (var guid in extraPerArticolo[0].Select(f => f.GuidId).Distinct())
            {
                var righe = extraPerArticolo.Select(extra => extra.Where(f => f.GuidId == guid).ToList()).ToList();
                if (righe.Any(r => r.Count == 0))
                {
                    continue;
                }

                var prima = righe[0][0];
                risultato.Add(new ArticoliFoto
                {
                    Id = prima.Id,
                    IdArticolo = prima.IdArticolo,
                    Area = prima.Area,
                    Canale = prima.Canale,
                    PathFoto = prima.PathFoto,
                    NomeReale = prima.NomeReale,
                    GuidId = prima.GuidId,
                    Puntatore = prima.Puntatore,
                    DataInserimento = prima.DataInserimento,
                    StatoSelezione = prima.StatoSelezione,
                    Attiva = righe.All(r => r.Any(f => f.Attiva == true)),
                    Hash = prima.Hash,
                    DataModifica = prima.DataModifica,
                    Tipo = prima.Tipo,
                });
            }

            return risultato;
        }

        /// Le righe di una foto extra da attivare o disattivare. Con i codici, solo quelle degli
        /// articoli indicati: lo stesso logo collegato a piu' articoli ha lo stesso GUID, e cercando
        /// per GUID soltanto si cambiava la prima riga trovata, che poteva essere di un altro articolo.
        /// Senza codici resta il comportamento di prima, per i Plugin non ancora aggiornati.
        public static List<ArticoliFoto> DaAttivare(IEnumerable<ArticoliFoto> righeDelGuid, Func<ArticoliFoto, string?> codiceDellArticolo, string? codice)
        {
            var codici = Codici(codice);
            if (codici.Count == 0)
            {
                var prima = righeDelGuid.FirstOrDefault();
                return prima == null ? new List<ArticoliFoto>() : new List<ArticoliFoto> { prima };
            }

            return righeDelGuid.Where(f => codici.Contains(codiceDellArticolo(f) ?? "")).ToList();
        }

        /* ---- le foto extra di un gruppo nei record del kit e della scheda ref ---- */

        /// Le foto extra presenti su tutte le referenze di un gruppo: e' cio' che il box del gruppo
        /// impagina e che la scheda ref mostra come foto extra del gruppo.
        public const string ChiaveExtraGruppo = "Foto.ExtraGruppo";
        /// Le foto extra presenti solo su alcune referenze del gruppo, con quante e quali.
        public const string ChiaveExtraParziali = "Foto.ExtraParziali";
        /// I collegamenti a un logo che non e' piu' nell'archivio Loghi/Bolli: fuori dal box, da eliminare.
        public const string ChiaveExtraNonASistema = "Foto.ExtraNonASistema";
        const string ChiaveExtra = "Foto.Extra";
        const string ChiaveCodice = "Referenza.Codice";

        /// Le foto extra di un record, qualunque forma abbiano nel dizionario (lista, JArray, testo).
        public static List<LogoBollo_ExtraNoAuto> ExtraDelRecord(IDictionary<string, object>? record, string chiave = ChiaveExtra)
        {
            if (record == null || !record.TryGetValue(chiave, out var valore) || valore == null)
                return new List<LogoBollo_ExtraNoAuto>();
            if (valore is List<LogoBollo_ExtraNoAuto> lista)
                return lista;
            if (valore is JArray array)
                return array.ToObject<List<LogoBollo_ExtraNoAuto>>() ?? new List<LogoBollo_ExtraNoAuto>();
            try
            {
                return JsonConvert.DeserializeObject<List<LogoBollo_ExtraNoAuto>>(valore is string testo ? testo : JsonConvert.SerializeObject(valore))
                    ?? new List<LogoBollo_ExtraNoAuto>();
            }
            catch (JsonException)
            {
                return new List<LogoBollo_ExtraNoAuto>();
            }
        }

        /// Scrive su ogni record di un gruppo le sue foto extra comuni (ChiaveExtraGruppo) e le parziali
        /// (ChiaveExtraParziali). Foto.Extra di ogni record non si tocca: una referenza impaginata da sola
        /// tiene tutte le sue, anche quelle che il gruppo non ha. Il confronto e' per GUID, nell'ordine
        /// della prima referenza; una comune e' attiva solo se lo e' su tutte. Con una sola referenza
        /// distinta non e' un gruppo e non si scrive niente.
        public static void AssegnaExtraDelGruppo(IReadOnlyList<IDictionary<string, object>> recordDelGruppo)
        {
            var membri = recordDelGruppo
                .Where(r => r != null)
                .GroupBy(r => r.TryGetValue(ChiaveCodice, out var c) ? c?.ToString() ?? "" : "")
                .Select(g => (codice: g.Key, extra: ExtraDelRecord(g.First()).Where(e => !string.IsNullOrEmpty(e.guidId)).ToList()))
                .ToList();

            if (membri.Count < 2)
                return;

            var comuni = new List<LogoBollo_ExtraNoAuto>();
            var parziali = new List<FotoExtraParziale>();
            var visti = new HashSet<string>();

            foreach (var (_, extra) in membri)
            {
                foreach (var e in extra)
                {
                    if (!visti.Add(e.guidId))
                        continue;

                    var conLaFoto = membri.Where(m => m.extra.Any(x => x.guidId == e.guidId)).ToList();
                    if (conLaFoto.Count == membri.Count)
                    {
                        var comune = Copia(e);
                        comune.attiva = membri.All(m => m.extra.Any(x => x.guidId == e.guidId && x.attiva));
                        comuni.Add(comune);
                    }
                    else
                    {
                        var parziale = new FotoExtraParziale
                        {
                            id = e.id, attiva = e.attiva, area = e.area, canale = e.canale, guidId = e.guidId, nome = e.nome,
                            statoSelezione = e.statoSelezione, tipo = e.tipo, puntatore = e.puntatore, sigla = e.sigla,
                            presenti = conLaFoto.Count,
                            totale = membri.Count,
                            codiciCon = conLaFoto.Select(m => m.codice).ToList(),
                            codiciSenza = membri.Where(m => !conLaFoto.Contains(m)).Select(m => m.codice).ToList(),
                        };
                        parziali.Add(parziale);
                    }
                }
            }

            //Ogni record ha le sue liste: le decisioni della lavorazione le cambiano record per record.
            foreach (var record in recordDelGruppo.Where(r => r != null))
            {
                record[ChiaveExtraGruppo] = comuni.Select(Copia).ToList();
                record[ChiaveExtraParziali] = parziali.Select(p => p.Copia()).ToList();
            }
        }

        /// Le foto extra presenti solo su alcune referenze del gruppo, nell'ordine in cui compaiono, con
        /// quante referenze le hanno sul totale e quali no. Una referenza non in archivio non ne ha.
        public static List<ParzialeDelGruppo> ParzialiAlGruppo(IReadOnlyList<(string codice, IEnumerable<ArticoliFoto>? foto)> perReferenza)
        {
            var membri = perReferenza
                .Select(r => (r.codice, extra: (r.foto ?? Enumerable.Empty<ArticoliFoto>()).Where(EExtra).ToList()))
                .ToList();
            var risultato = new List<ParzialeDelGruppo>();
            if (membri.Count < 2)
                return risultato;

            var visti = new HashSet<string>();
            foreach (var (_, extra) in membri)
            {
                foreach (var f in extra)
                {
                    if (!visti.Add(f.GuidId))
                        continue;
                    var conLaFoto = membri.Where(m => m.extra.Any(x => x.GuidId == f.GuidId)).ToList();
                    if (conLaFoto.Count == membri.Count)
                        continue;
                    risultato.Add(new ParzialeDelGruppo
                    {
                        Foto = f,
                        Presenti = conLaFoto.Count,
                        Totale = membri.Count,
                        CodiciSenza = membri.Where(m => !conLaFoto.Contains(m)).Select(m => m.codice).ToList(),
                    });
                }
            }
            return risultato;
        }

        /// Nel PoP le referenze di un gruppo sono cartelli singoli, e il cartello di gruppo e' il loro
        /// sottogruppo: le foto extra del gruppo restano solo li', perche' un singolo esce con le sue.
        /// Le liste del sottogruppo non si toccano: si toglie la chiave dal record, non il valore.
        public static void SoloSulCartelloDiGruppo(IEnumerable<IDictionary<string, object>?> recordDelleReferenze)
        {
            foreach (var record in recordDelleReferenze.Where(r => r != null))
            {
                record!.Remove(ChiaveExtraGruppo);
                record.Remove(ChiaveExtraParziali);
            }
        }

        /* ---- Estendi ---- */

        /// La riga da copiare per estendere una foto extra: una delle referenze che la hanno, mai una foto
        /// del prodotto.
        public static ArticoliFoto? RigaDaEstendere(IEnumerable<ArticoliFoto> fotoDelleReferenze, string? guidId)
        {
            if (string.IsNullOrEmpty(guidId))
                return null;
            return fotoDelleReferenze.FirstOrDefault(f => f.GuidId == guidId && f.Tipo.HasValue && f.Tipo != (byte)TipoFoto.Foto);
        }

        /// La copia di una foto extra per un'altra referenza: stesso file o collegamento, stesso stato.
        public static ArticoliFoto CopiaPerEstendere(ArticoliFoto sorgente, long idArticolo, DateTime ora) => new ArticoliFoto
        {
            IdArticolo = idArticolo,
            Area = sorgente.Area,
            Canale = sorgente.Canale,
            PathFoto = sorgente.PathFoto,
            NomeReale = sorgente.NomeReale,
            GuidId = sorgente.GuidId,
            Puntatore = sorgente.Puntatore,
            StatoSelezione = sorgente.StatoSelezione,
            Attiva = sorgente.Attiva,
            Hash = sorgente.Hash,
            Tipo = sorgente.Tipo,
            DataInserimento = ora,
            DataModifica = ora,
        };

        static LogoBollo_ExtraNoAuto Copia(LogoBollo_ExtraNoAuto e) => new LogoBollo_ExtraNoAuto
        {
            id = e.id, attiva = e.attiva, area = e.area, canale = e.canale, guidId = e.guidId, nome = e.nome,
            statoSelezione = e.statoSelezione, tipo = e.tipo, puntatore = e.puntatore, sigla = e.sigla,
        };
    }

    /// Nella sezione delle foto di un gruppo: una foto extra presente solo su alcune referenze.
    /// I collegamenti a un logo che non e' piu' nell'archivio Loghi/Bolli.
    public static class CollegamentiNonASistema
    {
        /// I GUID delle foto extra collegate (Puntatore) il cui logo l'archivio non ha piu'. Le foto
        /// con un file proprio non c'entrano: il loro file sta su Olimpo.
        public static HashSet<string> Guid(IEnumerable<ArticoliFoto?> foto, Func<string, bool> nelCatalogo)
        {
            return foto
                .Where(f => f != null && f.Puntatore && !string.IsNullOrEmpty(f.GuidId))
                .Select(f => f!.GuidId!)
                .Where(guid => !nelCatalogo(guid))
                .ToHashSet();
        }
    }

    public class ParzialeDelGruppo
    {
        public ArticoliFoto Foto { get; set; } = null!;
        public int Presenti { get; set; }
        public int Totale { get; set; }
        public List<string> CodiciSenza { get; set; } = new List<string>();
    }

    /// L'esito di Estendi: le referenze a cui la foto extra e' stata aggiunta.
    public class EsitoEstendiFotoExtra : BoolResult
    {
        public List<string> estese { get; set; } = new List<string>();
    }

    /// L'esito del caricamento di un file solo per la lavorazione: il suo GUID su Olimpo.
    public class EsitoCaricaExtraSoloLavorazione : BoolResult
    {
        public string guidId { get; set; } = "";
        public string nomeFile { get; set; } = "";
    }

    /// Una foto extra presente solo su alcune referenze di un gruppo.
    public class FotoExtraParziale : LogoBollo_ExtraNoAuto
    {
        public int presenti { get; set; }
        public int totale { get; set; }
        public List<string> codiciCon { get; set; } = new List<string>();
        public List<string> codiciSenza { get; set; } = new List<string>();

        public FotoExtraParziale Copia() => new FotoExtraParziale
        {
            id = id, attiva = attiva, area = area, canale = canale, guidId = guidId, nome = nome, statoSelezione = statoSelezione,
            tipo = tipo, puntatore = puntatore, sigla = sigla, presenti = presenti, totale = totale,
            codiciCon = codiciCon.ToList(), codiciSenza = codiciSenza.ToList(),
        };
    }
}
