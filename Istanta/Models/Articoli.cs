using System;
using System.Collections.Generic;

namespace Istanta.Models
{
    public partial class Articoli
    {
        // +--- DEPRECATO --- 9/9/2026 -------------------------------------------------
        // COSA        Le colonne di 'articoli' elencate qui sotto, con le rispettive
        //             proprieta di questa classe.
        // PERCHE      Confermato da Michele il 9/9/2026: di queste informazioni si occupa
        //             ormai articoli_descrizioni, non piu articoli. Le colonne sono
        //             rimaste, ma nessuno le riempie piu.
        // PROVA       Sui 51 articoli del demo, contati sia su PostgreSQL sia sul SQL
        //             Server originale, sono valorizzate in ZERO righe:
        //
        //               descrizione1       Descrizione1      0 / 51
        //               descrizione2       Descrizione2      0 / 51
        //               descrizione3       Descrizione3      0 / 51
        //               descrizione4       Descrizione4      0 / 51
        //               peso               Peso              0 / 51
        //               um                 Um                0 / 51
        //               ultima_revisione   UltimaRevisione   0 / 51
        //               stato_revisione    StatoRevisione    0 / 51
        //               nota_tecnica       NotaTecnica       0 / 51
        //               reparto            Reparto           0 / 51
        //
        // ECCEZIONE   'segmento' NON e deprecata: oggi non viene compilata, ma andra
        //             valorizzata in futuro. Va lasciata stare, e non va confusa con le
        //             altre quando si fara la pulizia.
        // ANCORA VIVE codice e data_inserimento: 51 / 51 valorizzate.
        // ANCORA VIVE ANCHE  'ean' e 'data_modifica'. Sul demo risultavano 0 / 51 come le
        //             deprecate, ma Michele ha confermato il 9/9/2026 che in produzione
        //             sono valorizzate. Il demo non era rappresentativo: i suoi 51
        //             articoli non sono mai stati modificati, e l'ean non arriva dai
        //             tracciati di quel cliente.
        //             Conta, perche da queste due dipendono cose gia fatte:
        //               - l'ordinamento 'piu recenti' dell'Archivio e l'indice
        //                 ix_articoli_recenti, su COALESCE(data_modifica, data_inserimento);
        //               - la correzione NULL-ORDER del 7/9/2026;
        //               - l'indice ix_articoli_ean, che serve alle ricerche per codice a
        //                 barre fatte per uguaglianza.
        //             LEZIONE: 51 righe di demo non bastano per dichiarare morta una
        //             colonna. Il conteggio dice se e vuota QUI, non se e inutile.
        // NEL CODICE  Non sono morte per assenza di codice: 40 assegnazioni vive (piu 12
        //             chiuse dentro commenti a blocco) scrivono ancora queste proprieta.
        //             Il meccanismo e in TracciatiController: quando un tracciato porta un
        //             codice che in archivio non c'e, l'articolo viene creato come
        //             SEGNAPOSTO -- solo il codice, e Descrizione1..4 = "", StatoRevisione
        //             = 0 -- e tutto il contenuto vero va in articoli_descrizioni. Ecco
        //             perche le colonne risultano vuote: non e che nessuno le tocchi, e
        //             che chi le tocca ci mette stringhe vuote di proposito.
        //             Conseguenza per la pulizia futura: togliere le proprieta rompe la
        //             compilazione in una quarantina di punti. Vanno tolte insieme al
        //             codice che le riempie di niente, non prima.
        // CONSEGUENZA Due indici creati per la Fase 5 sono stati tolti perche insistevano
        //             su colonne vuote: ix_articoli_stato (stato_revisione) e
        //             ix_articoli_reparto (reparto). Non aggiungerne altri su queste.
        // ATTENZIONE  Le prime quattro sono NOT NULL nel database dal 7/9/2026 e nel
        //             modello: il vincolo e soddisfatto da stringhe vuote. Se un giorno le
        //             colonne si tolgono, vanno tolte anche le proprieta corrispondenti.
        // NON CANCELLARE: da valutare in un futuro lavoro di pulizia.
        // +---------------------------------------------------------------------------

        public Articoli()
        {
            ArticoliFotos = new HashSet<ArticoliFoto>();
            ArticoliDescrizionis = new HashSet<ArticoliDescrizioni>();
        }

        public long Id { get; set; }
        public string Codice { get; set; } = null!;
        public string Descrizione1 { get; set; } = null!;   // DEPRECATO, vedi blocco in testa alla classe
        public string Descrizione2 { get; set; } = null!;   // DEPRECATO, vedi blocco in testa alla classe
        public string Descrizione3 { get; set; } = null!;   // DEPRECATO, vedi blocco in testa alla classe
        public string Descrizione4 { get; set; } = null!;   // DEPRECATO, vedi blocco in testa alla classe
        public decimal? Peso { get; set; }   // DEPRECATO, vedi blocco in testa alla classe
        public string? Um { get; set; }   // DEPRECATO, vedi blocco in testa alla classe
        public DateTime? UltimaRevisione { get; set; }   // DEPRECATO, vedi blocco in testa alla classe
        /// <summary>
        /// 0 - non processato 1 - descrizione conad approvata 2 - descrizione conad bocciata 3 - obsoleto 4 - processato solo da edro
        /// </summary>
        public byte StatoRevisione { get; set; }   // DEPRECATO, vedi blocco in testa alla classe
        public string? NotaTecnica { get; set; }   // DEPRECATO, vedi blocco in testa alla classe
        public int? Reparto { get; set; }   // DEPRECATO, vedi blocco in testa alla classe
        public string? Segmento { get; set; }
        public string? Ean { get; set; }
        public DateTime? DataInserimento { get; set; }
        public DateTime? DataModifica { get; set; }

        public virtual ICollection<ArticoliFoto>? ArticoliFotos { get; set; }
        public virtual ICollection<ArticoliDescrizioni>? ArticoliDescrizionis{ get; set; }
        public virtual ICollection<FotoEscluse>? FotoEscluses { get; set; }
    }

}
