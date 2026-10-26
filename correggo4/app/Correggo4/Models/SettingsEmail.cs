using System;
using System.Collections.Generic;

namespace Correggo4.Models;

public partial class SettingsEmail
{
    public int Id { get; set; }

    public string Materiale { get; set; } = null!;

    public string Email { get; set; } = null!;

    public short Stato { get; set; }
}
