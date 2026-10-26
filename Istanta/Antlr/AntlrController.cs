using Antlr4.Runtime;
using Istanta.Antlr.Grammer;
using Istanta.Models;
using Microsoft.Extensions.FileSystemGlobbing.Internal;

namespace Istanta.Antlr
{
    //Grammer generato il comando
    //java -jar antlr-4.9-complete.jar -Dlanguage=CSharp -visitor -no-listener -o output_directory E:\Dropbox\Progetti\Istanta2\Istanta\Antlr\Grammer\Expression.g4

    public class AntlrController
    {
        ExpressionParser.ExprContext tree = new ExpressionParser.ExprContext();

        AntlrPattern? myPattern;
        //Dictionary<string, AntlrPattern> patternsCache = new Dictionary<string, AntlrPattern>();

        public AntlrController(AntlrPattern pattern)
        {
            this.myPattern = pattern;

            //if (!patternsCache.ContainsKey(pattern.nome))
            //{
            //    patternsCache.Add(pattern.nome, pattern);
            //}

            //AntlrPattern patternCached = patternsCache[pattern.nome];
            if (this.myPattern != null && this.myPattern.livelli != null)
            {
                for (int i = 0; i < this.myPattern.livelli!.Count; i++)
                {
                    AntlrPatternLevels lev = this.myPattern.livelli[i];
                    for (int i2 = 0; i2 < lev.patterns!.Count; i2++)
                    {
                        AntlrPatternLevelsNode levNode = lev.patterns[i2];
                        if (levNode.context == null)
                        {
                            string condiz = levNode.condizione!;

                            var stream = new AntlrInputStream(condiz);
                            var lexer = new ExpressionLexer(stream);
                            var tokens = new CommonTokenStream(lexer);
                            var parser = new ExpressionParser(tokens);
                            tree = parser.expr();  // Assumendo che `expr` sia il punto di ingresso della tua grammatica.
                            levNode.context = tree;
                        }
                    }
                }
            }

        }
        public string ParseInputByPattern(Dictionary<string, object> item)
        {

            string result = "";
            var visitor = new IstantaAntlrVisitor<bool>(item);

            for (int i = 0; i < this.myPattern!.livelli!.Count; i++)
            {
                AntlrPatternLevels lev = this.myPattern.livelli[i];
                for (int i2 = 0; i2 < lev.patterns!.Count; i2++)
                {
                    AntlrPatternLevelsNode levNode =  lev.patterns[i2];

                    
                    bool resultVisit = visitor.Visit(levNode.context);
                    if (resultVisit)
                    {
                        result += levNode.valore;
                        break;
                    }
                    

                }
            }

           

            return result;
        }

        //public bool Parse(Dictionary<string, object> item)
        //{


        //    //var visitor = new ExpressionBaseVisitor<bool>();
        //    var visitor = new IstantaAntlrVisitor<bool>(item);
        //    bool result = visitor.Visit(tree);

        //    return result;
        //}
    }
}
