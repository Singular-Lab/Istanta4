using System.Text;
using Serilog;

namespace Istanta.Utility
{
    public class LogAssistent:TextWriter
    {
        public override Encoding Encoding => Encoding.UTF8;

        public override void WriteLine(string? value)
        {
            Log.Information("[Console] {Message}", value);
        }

        public override void Write(string? value)
        {
            Log.Information("[Console] {Message}", value);
        }

        public async Task<string[]> ReadLatestLogLinesAsync(string logFilePath, int lastNLines = 500)
        {
            var tempFile = Path.Combine(Path.GetTempPath(), $"logcopy_{Guid.NewGuid():N}.txt");

            File.Copy(logFilePath, tempFile, overwrite: true);

            try
            {
                var lines = await File.ReadAllLinesAsync(tempFile);
                return lines.TakeLast(lastNLines).OrderByDescending(l => l).ToArray();
            }
            finally
            {
                try { File.Delete(tempFile); } catch { }
            }
        }

    }
}
