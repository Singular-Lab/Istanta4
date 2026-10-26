using System.Diagnostics;
using System.Reflection;
using System.Reflection.Metadata;
using System.Reflection.PortableExecutable;

namespace Istanta.Models
{
    /// <summary>
    /// La versione della AgenziaLib.dll installata, mostrata sotto il login e restituita da
    /// LoginController/getAgenziaLibVersion.
    ///
    /// Le fonti si provano in catena, ProductVersion, FileVersion, AssemblyInformationalVersion e
    /// AssemblyName.Version, e vince la prima non vuota. Se non ne risponde nessuna, o la dll non
    /// c'e', si mostra "n/a": una stringa vuota non dice se manca la dll o la versione.
    ///
    /// La dll non viene caricata: prima ogni apertura del login faceva Assembly.Load e lasciava
    /// una copia in piu' nel processo.
    /// </summary>
    public static class VersioneAgenziaLib
    {
        public const string NonDisponibile = "n/a";

        /// <summary>
        /// La AgenziaLib.dll da cui Istanta carica le regole cliente: pathLib, come negli altri
        /// controller. Prima si guardava sempre AppContext.BaseDirectory/wwwroot/external_lib, che
        /// su Linux non e' la cartella montata (/app/external_lib/), e la versione usciva vuota.
        /// </summary>
        public static string PercorsoDll(string? pathLib)
        {
            if (string.IsNullOrWhiteSpace(pathLib))
            {
                return Path.Combine(AppContext.BaseDirectory, "wwwroot", "external_lib", "AgenziaLib.dll");
            }

            return Path.Combine(pathLib, "AgenziaLib.dll");
        }

        public static string Leggi(string percorsoDll)
        {
            if (string.IsNullOrWhiteSpace(percorsoDll) || !File.Exists(percorsoDll))
            {
                return NonDisponibile;
            }

            Func<string?>[] fonti =
            {
                () => FileVersionInfo.GetVersionInfo(percorsoDll).ProductVersion,
                () => FileVersionInfo.GetVersionInfo(percorsoDll).FileVersion,
                () => InformationalVersion(percorsoDll),
                () => AssemblyName.GetAssemblyName(percorsoDll).Version?.ToString(),
            };

            foreach (var fonte in fonti)
            {
                string? versione;
                try
                {
                    versione = fonte();
                }
                catch
                {
                    // Una fonte illeggibile non deve fermare le successive.
                    continue;
                }

                versione = SenzaSuffisso(versione);
                if (!string.IsNullOrWhiteSpace(versione))
                {
                    return versione;
                }
            }

            return NonDisponibile;
        }

        // "1.2.3+abcdef" -> "1.2.3": il suffisso e' l'hash del commit aggiunto dalla build.
        private static string? SenzaSuffisso(string? versione)
        {
            if (versione == null)
            {
                return null;
            }

            int piu = versione.IndexOf('+');
            return (piu >= 0 ? versione.Substring(0, piu) : versione).Trim();
        }

        // AssemblyInformationalVersionAttribute letto dai metadati, senza caricare l'assembly.
        private static string? InformationalVersion(string percorsoDll)
        {
            using var stream = File.OpenRead(percorsoDll);
            using var pe = new PEReader(stream);
            if (!pe.HasMetadata)
            {
                return null;
            }

            var reader = pe.GetMetadataReader();
            foreach (var handle in reader.GetAssemblyDefinition().GetCustomAttributes())
            {
                var attributo = reader.GetCustomAttribute(handle);
                if (NomeTipoAttributo(reader, attributo) != "System.Reflection.AssemblyInformationalVersionAttribute")
                {
                    continue;
                }

                // Blob: prologo 0x0001, poi la stringa serializzata dell'unico argomento.
                var blob = reader.GetBlobReader(attributo.Value);
                if (blob.ReadUInt16() != 1)
                {
                    return null;
                }

                return blob.ReadSerializedString();
            }

            return null;
        }

        private static string NomeTipoAttributo(MetadataReader reader, CustomAttribute attributo)
        {
            EntityHandle tipo;
            switch (attributo.Constructor.Kind)
            {
                case HandleKind.MemberReference:
                    tipo = reader.GetMemberReference((MemberReferenceHandle)attributo.Constructor).Parent;
                    break;
                case HandleKind.MethodDefinition:
                    tipo = reader.GetMethodDefinition((MethodDefinitionHandle)attributo.Constructor).GetDeclaringType();
                    break;
                default:
                    return "";
            }

            switch (tipo.Kind)
            {
                case HandleKind.TypeReference:
                    var riferimento = reader.GetTypeReference((TypeReferenceHandle)tipo);
                    return reader.GetString(riferimento.Namespace) + "." + reader.GetString(riferimento.Name);
                case HandleKind.TypeDefinition:
                    var definizione = reader.GetTypeDefinition((TypeDefinitionHandle)tipo);
                    return reader.GetString(definizione.Namespace) + "." + reader.GetString(definizione.Name);
                default:
                    return "";
            }
        }
    }
}
