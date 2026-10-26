using System;
using System.Collections.Generic;

namespace Istanta.Models_2
{
    public partial class SchemaCustomRecord
    {
        public long Id { get; set; }
        public short IdSchema { get; set; }
        public string Dato { get; set; } = null!;

        public virtual SchemaCustom IdSchemaNavigation { get; set; } = null!;
    }
}
