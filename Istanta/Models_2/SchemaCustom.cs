using System;
using System.Collections.Generic;

namespace Istanta.Models_2
{
    public partial class SchemaCustom
    {
        public SchemaCustom()
        {
            SchemaCustomRecords = new HashSet<SchemaCustomRecord>();
        }

        public short Id { get; set; }
        public string Titolo { get; set; } = null!;
        public DateTime DataRegistrazione { get; set; }

        public virtual ICollection<SchemaCustomRecord> SchemaCustomRecords { get; set; }
    }
}
