using System;

namespace IstantaLib.Utility
{
    public static class Logger
    {
        private static readonly int currVersion = 0;
        public static void Log(string message, int version = 1)
        {
            if (version>currVersion)
            {
                Console.WriteLine($"[{DateTime.Now}] {message}");
            }
        }
    }
}
