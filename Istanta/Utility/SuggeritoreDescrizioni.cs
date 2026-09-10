using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace Istanta.Utility
{
    public class SuggeritoreDescrizioni
    {
    }

    /// <summary>
    /// Normalizza le descrizioni industriali ricevute dai quattro campi origine.
    /// Non assegna i valori a Titolo, Brand, Tipo o Grammatura.
    /// </summary>
    public sealed class ProductDescriptionNormalizer
    {
        private static readonly Regex MultipleSpacesRegex =
            new(@"\s+", RegexOptions.Compiled);

        private static readonly Regex MultipackRegex =
            new(
                @"(?<!\d)(?<count>\d+)\s*[X*]\s*(?<value>\d+(?:[.,]\d+)?)\s*(?<unit>KG|GR|G|LT|LTR|L|ML|CL)\b",
                RegexOptions.Compiled | RegexOptions.IgnoreCase);

        private static readonly Regex MeasureRegex =
            new(
                @"(?<!\d)(?<value>\d+(?:[.,]\d+)?)\s*(?<unit>KG|GR|G|LT|LTR|L|ML|CL)\b",
                RegexOptions.Compiled | RegexOptions.IgnoreCase);

        private static readonly Regex AttachedNumberUnitRegex =
            new(
                @"(?<value>\d)(?<unit>KG|GR|G|LT|LTR|L|ML|CL)\b",
                RegexOptions.Compiled | RegexOptions.IgnoreCase);

        private readonly IReadOnlyDictionary<string, string> _aliases;
        private readonly HashSet<string> _ignoredTokens;

        public ProductDescriptionNormalizer(
            IReadOnlyDictionary<string, string>? aliases = null,
            IEnumerable<string>? ignoredTokens = null)
        {
            _aliases = aliases ?? CreateDefaultAliases();

            _ignoredTokens = new HashSet<string>(
                ignoredTokens ?? CreateDefaultIgnoredTokens(),
                StringComparer.OrdinalIgnoreCase);
        }

        /// <summary>
        /// Normalizza tutti e quattro i campi origine.
        /// </summary>
        public NormalizedProductSource Normalize(ProductSource source)
        {
            ArgumentNullException.ThrowIfNull(source);

            return new NormalizedProductSource
            {
                Description1 = NormalizeField(source.Description1),
                Description2 = NormalizeField(source.Description2),
                Description3 = NormalizeField(source.Description3),
                Description4 = NormalizeField(source.Description4),

                Department = NormalizeClassification(source.Department),
                Sector = NormalizeClassification(source.Sector),
                Category = NormalizeClassification(source.Category)
            };
        }

        /// <summary>
        /// Normalizza un singolo campo descrittivo.
        /// </summary>
        public NormalizedField NormalizeField(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return NormalizedField.Empty(value);
            }

            var transformations = new List<string>();
            var normalized = value.Trim();

            var upper = normalized.ToUpperInvariant();

            if (!string.Equals(normalized, upper, StringComparison.Ordinal))
            {
                transformations.Add("Conversione in maiuscolo");
                normalized = upper;
            }

            var withoutDiacritics = RemoveDiacritics(normalized);

            if (!string.Equals(
                    normalized,
                    withoutDiacritics,
                    StringComparison.Ordinal))
            {
                transformations.Add("Rimozione segni diacritici");
                normalized = withoutDiacritics;
            }

            var sanitized = NormalizeSeparators(normalized);

            if (!string.Equals(normalized, sanitized, StringComparison.Ordinal))
            {
                transformations.Add("Normalizzazione separatori");
                normalized = sanitized;
            }

            var spacedUnits = AddSpaceBetweenNumberAndUnit(normalized);

            if (!string.Equals(normalized, spacedUnits, StringComparison.Ordinal))
            {
                transformations.Add("Separazione numero e unità");
                normalized = spacedUnits;
            }

            var normalizedMeasures = NormalizeMeasures(normalized);

            if (!string.Equals(
                    normalized,
                    normalizedMeasures,
                    StringComparison.Ordinal))
            {
                transformations.Add("Normalizzazione unità di misura");
                normalized = normalizedMeasures;
            }

            var expandedAliases = ExpandAliases(normalized);

            if (!string.Equals(
                    normalized,
                    expandedAliases,
                    StringComparison.Ordinal))
            {
                transformations.Add("Espansione abbreviazioni");
                normalized = expandedAliases;
            }

            var withoutIgnoredTokens = RemoveIgnoredTokens(normalized);

            if (!string.Equals(
                    normalized,
                    withoutIgnoredTokens,
                    StringComparison.Ordinal))
            {
                transformations.Add("Rimozione termini non informativi");
                normalized = withoutIgnoredTokens;
            }

            normalized = CleanSpaces(normalized);

            return new NormalizedField
            {
                OriginalValue = value,
                NormalizedValue = normalized,
                Tokens = Tokenize(normalized),
                Measures = ExtractMeasures(normalized),
                Transformations = transformations
            };
        }

        /// <summary>
        /// Prova a estrarre una grammatura/formato da tutti i campi.
        /// Restituisce tutte le misure trovate, senza decidere quale usare.
        /// </summary>
        public IReadOnlyList<NormalizedMeasure> ExtractAllMeasures(
            NormalizedProductSource source)
        {
            ArgumentNullException.ThrowIfNull(source);

            return source.GetDescriptions()
                .SelectMany(field => field.Measures)
                .DistinctBy(measure => measure.CanonicalValue)
                .ToArray();
        }

        private string ExpandAliases(string value)
        {
            var tokens = Tokenize(value);
            var result = new List<string>();

            for (var index = 0; index < tokens.Count;)
            {
                var matched = false;

                // Prova prima le espressioni composte da tre parole.
                for (var length = Math.Min(3, tokens.Count - index);
                     length >= 1;
                     length--)
                {
                    var candidate = string.Join(
                        " ",
                        tokens.Skip(index).Take(length));

                    if (!_aliases.TryGetValue(candidate, out var replacement))
                    {
                        continue;
                    }

                    result.AddRange(Tokenize(replacement));
                    index += length;
                    matched = true;
                    break;
                }

                if (!matched)
                {
                    result.Add(tokens[index]);
                    index++;
                }
            }

            return string.Join(" ", result);
        }

        private string RemoveIgnoredTokens(string value)
        {
            var tokens = Tokenize(value)
                .Where(token => !_ignoredTokens.Contains(token));

            return string.Join(" ", tokens);
        }

        private static string NormalizeMeasures(string value)
        {
            var normalized = MultipackRegex.Replace(
                value,
                match =>
                {
                    var count = match.Groups["count"].Value;
                    var amount = NormalizeDecimal(match.Groups["value"].Value);
                    var unit = NormalizeUnit(match.Groups["unit"].Value);

                    return $"{count} X {amount} {unit}";
                });

            normalized = MeasureRegex.Replace(
                normalized,
                match =>
                {
                    var amount = NormalizeDecimal(match.Groups["value"].Value);
                    var unit = NormalizeUnit(match.Groups["unit"].Value);

                    return $"{amount} {unit}";
                });

            return normalized;
        }

        private static IReadOnlyList<NormalizedMeasure> ExtractMeasures(
            string value)
        {
            var measures = new List<NormalizedMeasure>();
            var occupiedRanges = new List<(int Start, int Length)>();

            foreach (Match match in MultipackRegex.Matches(value))
            {
                var count = int.Parse(
                    match.Groups["count"].Value,
                    CultureInfo.InvariantCulture);

                var amount = ParseDecimal(match.Groups["value"].Value);
                var unit = NormalizeUnit(match.Groups["unit"].Value);

                measures.Add(new NormalizedMeasure
                {
                    OriginalValue = match.Value,
                    PackageCount = count,
                    UnitValue = amount,
                    Unit = unit,
                    CanonicalValue =
                        $"{count} x {FormatDecimal(amount)} {unit.ToLowerInvariant()}"
                });

                occupiedRanges.Add((match.Index, match.Length));
            }

            foreach (Match match in MeasureRegex.Matches(value))
            {
                if (IsInsideExistingRange(
                        match.Index,
                        match.Length,
                        occupiedRanges))
                {
                    continue;
                }

                var amount = ParseDecimal(match.Groups["value"].Value);
                var unit = NormalizeUnit(match.Groups["unit"].Value);

                measures.Add(new NormalizedMeasure
                {
                    OriginalValue = match.Value,
                    PackageCount = null,
                    UnitValue = amount,
                    Unit = unit,
                    CanonicalValue =
                        $"{FormatDecimal(amount)} {unit.ToLowerInvariant()}"
                });
            }

            return measures;
        }

        private static bool IsInsideExistingRange(
            int start,
            int length,
            IEnumerable<(int Start, int Length)> ranges)
        {
            var end = start + length;

            return ranges.Any(range =>
            {
                var rangeEnd = range.Start + range.Length;
                return start >= range.Start && end <= rangeEnd;
            });
        }

        private static string NormalizeClassification(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return string.Empty;
            }

            var normalized = RemoveDiacritics(value)
                .ToUpperInvariant();

            normalized = NormalizeSeparators(normalized);

            return CleanSpaces(normalized);
        }

        private static string NormalizeSeparators(string value)
        {
            var builder = new StringBuilder(value.Length);

            foreach (var character in value)
            {
                builder.Append(character switch
                {
                    '\t' => ' ',
                    '\r' => ' ',
                    '\n' => ' ',
                    '_' => ' ',
                    ';' => ' ',
                    ':' => ' ',
                    ',' => ',',
                    '.' => '.',
                    '-' => ' ',
                    '/' => ' ',
                    '\\' => ' ',
                    '(' => ' ',
                    ')' => ' ',
                    '[' => ' ',
                    ']' => ' ',
                    '{' => ' ',
                    '}' => ' ',
                    _ => character
                });
            }

            return CleanSpaces(builder.ToString());
        }

        private static string AddSpaceBetweenNumberAndUnit(string value)
        {
            return AttachedNumberUnitRegex.Replace(
                value,
                "${value} ${unit}");
        }

        private static IReadOnlyList<string> Tokenize(string value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return Array.Empty<string>();
            }

            return CleanSpaces(value)
                .Split(
                    ' ',
                    StringSplitOptions.RemoveEmptyEntries |
                    StringSplitOptions.TrimEntries);
        }

        private static string CleanSpaces(string value)
        {
            return MultipleSpacesRegex
                .Replace(value, " ")
                .Trim();
        }

        private static string NormalizeDecimal(string value)
        {
            return FormatDecimal(ParseDecimal(value));
        }

        private static decimal ParseDecimal(string value)
        {
            var normalized = value.Replace(',', '.');

            if (!decimal.TryParse(
                    normalized,
                    NumberStyles.AllowDecimalPoint,
                    CultureInfo.InvariantCulture,
                    out var result))
            {
                throw new FormatException(
                    $"Valore numerico non valido: '{value}'.");
            }

            return result;
        }

        private static string FormatDecimal(decimal value)
        {
            return value.ToString(
                "0.###",
                CultureInfo.InvariantCulture);
        }

        private static string NormalizeUnit(string unit)
        {
            return unit.ToUpperInvariant() switch
            {
                "GR" => "G",
                "G" => "G",

                "KG" => "KG",

                "LT" => "L",
                "LTR" => "L",
                "L" => "L",

                "ML" => "ML",
                "CL" => "CL",

                _ => unit.ToUpperInvariant()
            };
        }

        private static string RemoveDiacritics(string value)
        {
            var normalized = value.Normalize(
                NormalizationForm.FormD);

            var builder = new StringBuilder(normalized.Length);

            foreach (var character in normalized)
            {
                var category = CharUnicodeInfo.GetUnicodeCategory(character);

                if (category != UnicodeCategory.NonSpacingMark)
                {
                    builder.Append(character);
                }
            }

            return builder
                .ToString()
                .Normalize(NormalizationForm.FormC);
        }

        private static IReadOnlyDictionary<string, string>
            CreateDefaultAliases()
        {
            return new Dictionary<string, string>(
                StringComparer.OrdinalIgnoreCase)
            {
                ["MEL"] = "MELE",
                ["MELA"] = "MELE",

                ["GOLD"] = "GOLDEN",

                ["ROSS"] = "ROSSE",
                ["ROSSA"] = "ROSSE",

                ["VERD"] = "VERDI",
                ["VERDE"] = "VERDI",

                ["BISC"] = "BISCOTTI",
                ["BISCOT"] = "BISCOTTI",

                ["CIOCC"] = "CIOCCOLATO",
                ["CIOCCOL"] = "CIOCCOLATO",

                ["NAT"] = "NATURALE",

                ["S Z"] = "SENZA ZUCCHERO",
                ["SENZA ZUCCH"] = "SENZA ZUCCHERO",

                ["CONF"] = "CONFEZIONE",
                ["CONFEZ"] = "CONFEZIONE"
            };
        }

        private static IEnumerable<string> CreateDefaultIgnoredTokens()
        {
            return
            [
                "CONF",
            "CONFEZ",
            "CONFEZIONE",
            "CONFEZIONATO",
            "ART",
            "ARTICOLO",
            "PROD",
            "PRODOTTO"
            ];
        }
    }

    public sealed class ProductSource
    {
        public string? Description1 { get; init; }
        public string? Description2 { get; init; }
        public string? Description3 { get; init; }
        public string? Description4 { get; init; }

        public string? Department { get; init; }
        public string? Sector { get; init; }
        public string? Category { get; init; }
    }

    public sealed class NormalizedProductSource
    {
        public required NormalizedField Description1 { get; init; }
        public required NormalizedField Description2 { get; init; }
        public required NormalizedField Description3 { get; init; }
        public required NormalizedField Description4 { get; init; }

        public required string Department { get; init; }
        public required string Sector { get; init; }
        public required string Category { get; init; }

        public IEnumerable<NormalizedField> GetDescriptions()
        {
            yield return Description1;
            yield return Description2;
            yield return Description3;
            yield return Description4;
        }

        public string GetCombinedText()
        {
            return string.Join(
                " | ",
                GetDescriptions()
                    .Select(field => field.NormalizedValue)
                    .Where(value => !string.IsNullOrWhiteSpace(value)));
        }
    }

    public sealed class NormalizedField
    {
        public string? OriginalValue { get; init; }
        public required string NormalizedValue { get; init; }

        public required IReadOnlyList<string> Tokens { get; init; }

        public required IReadOnlyList<NormalizedMeasure> Measures
        {
            get;
            init;
        }

        public required IReadOnlyList<string> Transformations
        {
            get;
            init;
        }

        public static NormalizedField Empty(string? originalValue)
        {
            return new NormalizedField
            {
                OriginalValue = originalValue,
                NormalizedValue = string.Empty,
                Tokens = Array.Empty<string>(),
                Measures = Array.Empty<NormalizedMeasure>(),
                Transformations = Array.Empty<string>()
            };
        }
    }

    public sealed class NormalizedMeasure
    {
        public required string OriginalValue { get; init; }

        public int? PackageCount { get; init; }

        public required decimal UnitValue { get; init; }

        public required string Unit { get; init; }

        public required string CanonicalValue { get; init; }
    }

    public sealed class HistoricalAliasMiner
    {
        private static readonly Regex SpacesRegex =
            new(@"\s+", RegexOptions.Compiled);

        public IReadOnlyList<AliasRule> MineAliases(
            IEnumerable<HistoricalProductRow> rows,
            AliasMiningOptions? options = null)
        {
            ArgumentNullException.ThrowIfNull(rows);

            options ??= new AliasMiningOptions();

            var occurrences = new List<AliasOccurrence>();

            foreach (var row in rows)
            {
                var sourceTokens = GetSourceTokens(row);

                CollectOccurrences(
                    sourceTokens,
                    Tokenize(row.Title),
                    "TITLE",
                    row.Category,
                    occurrences,
                    options);

                CollectOccurrences(
                    sourceTokens,
                    Tokenize(row.Brand),
                    "BRAND",
                    row.Category,
                    occurrences,
                    options);

                CollectOccurrences(
                    sourceTokens,
                    Tokenize(row.Type),
                    "TYPE",
                    row.Category,
                    occurrences,
                    options);
            }

            return BuildRules(occurrences, options);
        }

        private static void CollectOccurrences(
            IReadOnlyList<string> sourceTokens,
            IReadOnlyList<string> targetTokens,
            string destinationField,
            string? category,
            ICollection<AliasOccurrence> occurrences,
            AliasMiningOptions options)
        {
            foreach (var sourceToken in sourceTokens)
            {
                if (sourceToken.Length < options.MinimumSourceLength)
                {
                    continue;
                }

                var candidates = targetTokens
                    .Select(targetToken => new
                    {
                        Target = targetToken,
                        Score = CalculateSimilarity(sourceToken, targetToken)
                    })
                    .Where(candidate =>
                        candidate.Score >= options.MinimumSimilarity)
                    .OrderByDescending(candidate => candidate.Score)
                    .ToArray();

                if (candidates.Length == 0)
                {
                    continue;
                }

                var bestCandidate = candidates[0];

                occurrences.Add(new AliasOccurrence(
                    Source: sourceToken,
                    Target: bestCandidate.Target,
                    DestinationField: destinationField,
                    Category: Normalize(category),
                    Similarity: bestCandidate.Score));
            }
        }

        private static IReadOnlyList<AliasRule> BuildRules(
            IEnumerable<AliasOccurrence> occurrences,
            AliasMiningOptions options)
        {
            var occurrenceList = occurrences.ToArray();

            var groupedBySource = occurrenceList
                .GroupBy(occurrence => new
                {
                    occurrence.Source,
                    occurrence.DestinationField,
                    occurrence.Category
                });

            var rules = new List<AliasRule>();

            foreach (var sourceGroup in groupedBySource)
            {
                var totalSupport = sourceGroup.Count();

                var targetGroups = sourceGroup
                    .GroupBy(occurrence => occurrence.Target)
                    .Select(group => new
                    {
                        Target = group.Key,
                        Support = group.Count(),
                        AverageSimilarity =
                            group.Average(item => item.Similarity)
                    })
                    .OrderByDescending(group => group.Support)
                    .ThenByDescending(group => group.AverageSimilarity)
                    .ToArray();

                if (targetGroups.Length == 0)
                {
                    continue;
                }

                var bestTarget = targetGroups[0];
                var confidence =
                    (double)bestTarget.Support / totalSupport;

                if (bestTarget.Support < options.MinimumSupport)
                {
                    continue;
                }

                if (confidence < options.MinimumConfidence)
                {
                    continue;
                }

                rules.Add(new AliasRule(
                    Source: sourceGroup.Key.Source,
                    Target: bestTarget.Target,
                    DestinationField:
                        sourceGroup.Key.DestinationField,
                    Category: sourceGroup.Key.Category,
                    Support: bestTarget.Support,
                    Confidence: confidence,
                    AverageSimilarity:
                        bestTarget.AverageSimilarity));
            }

            return rules
                .OrderBy(rule => rule.DestinationField)
                .ThenBy(rule => rule.Category)
                .ThenByDescending(rule => rule.Support)
                .ThenBy(rule => rule.Source)
                .ToArray();
        }

        private static IReadOnlyList<string> GetSourceTokens(
            HistoricalProductRow row)
        {
            return new[]
                {
                row.SourceDescription1,
                row.SourceDescription2,
                row.SourceDescription3,
                row.SourceDescription4
            }
                .Where(value => !string.IsNullOrWhiteSpace(value))
                .SelectMany(Tokenize)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();
        }

        private static IReadOnlyList<string> Tokenize(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return Array.Empty<string>();
            }

            return Normalize(value)
                .Split(
                    ' ',
                    StringSplitOptions.RemoveEmptyEntries |
                    StringSplitOptions.TrimEntries);
        }

        private static string Normalize(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return string.Empty;
            }

            var normalized = RemoveDiacritics(value)
                .ToUpperInvariant();

            normalized = Regex.Replace(
                normalized,
                @"[^A-Z0-9]+",
                " ");

            return SpacesRegex
                .Replace(normalized, " ")
                .Trim();
        }

        private static double CalculateSimilarity(
            string source,
            string target)
        {
            if (string.Equals(
                    source,
                    target,
                    StringComparison.OrdinalIgnoreCase))
            {
                return 1.0;
            }

            if (target.StartsWith(
                    source,
                    StringComparison.OrdinalIgnoreCase))
            {
                /*
                 * GOLD → GOLDEN
                 * BISC → BISCOTTI
                 */
                return 0.95;
            }

            if (source.StartsWith(
                    target,
                    StringComparison.OrdinalIgnoreCase))
            {
                return 0.90;
            }

            var distance = LevenshteinDistance(source, target);
            var maximumLength = Math.Max(source.Length, target.Length);

            if (maximumLength == 0)
            {
                return 1.0;
            }

            return 1.0 - (double)distance / maximumLength;
        }

        private static int LevenshteinDistance(
            string first,
            string second)
        {
            var previous = new int[second.Length + 1];
            var current = new int[second.Length + 1];

            for (var index = 0; index <= second.Length; index++)
            {
                previous[index] = index;
            }

            for (var firstIndex = 1;
                 firstIndex <= first.Length;
                 firstIndex++)
            {
                current[0] = firstIndex;

                for (var secondIndex = 1;
                     secondIndex <= second.Length;
                     secondIndex++)
                {
                    var substitutionCost =
                        first[firstIndex - 1] ==
                        second[secondIndex - 1]
                            ? 0
                            : 1;

                    current[secondIndex] = Math.Min(
                        Math.Min(current[secondIndex - 1] + 1, previous[secondIndex] + 1),
                        previous[secondIndex - 1] + substitutionCost
                    );
                }

                (previous, current) = (current, previous);
            }

            return previous[second.Length];
        }

        private static string RemoveDiacritics(string value)
        {
            var normalized =
                value.Normalize(NormalizationForm.FormD);

            var builder = new StringBuilder();

            foreach (var character in normalized)
            {
                var category = System.Globalization
                    .CharUnicodeInfo
                    .GetUnicodeCategory(character);

                if (category !=
                    System.Globalization.UnicodeCategory.NonSpacingMark)
                {
                    builder.Append(character);
                }
            }

            return builder
                .ToString()
                .Normalize(NormalizationForm.FormC);
        }
    }

    public sealed class HistoricalProductRow
    {
        public string? SourceDescription1 { get; init; }
        public string? SourceDescription2 { get; init; }
        public string? SourceDescription3 { get; init; }
        public string? SourceDescription4 { get; init; }

        public string? Department { get; init; }
        public string? Sector { get; init; }
        public string? Category { get; init; }

        public string? Title { get; init; }
        public string? Brand { get; init; }
        public string? Type { get; init; }
        public string? Weight { get; init; }
    }

    public sealed class AliasMiningOptions
    {
        public int MinimumSourceLength { get; init; } = 3;

        public int MinimumSupport { get; init; } = 5;

        public double MinimumConfidence { get; init; } = 0.90;

        public double MinimumSimilarity { get; init; } = 0.70;
    }

    public sealed record AliasOccurrence(
        string Source,
        string Target,
        string DestinationField,
        string Category,
        double Similarity);

    public sealed record AliasRule(
        string Source,
        string Target,
        string DestinationField,
        string Category,
        int Support,
        double Confidence,
        double AverageSimilarity);
}


