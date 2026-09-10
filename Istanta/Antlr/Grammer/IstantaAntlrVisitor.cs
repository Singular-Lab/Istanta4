using Antlr4.Runtime.Misc;

namespace Istanta.Antlr.Grammer
{
    public class IstantaAntlrVisitor<T>:ExpressionBaseVisitor<bool>, IExpressionVisitor<bool>
    {
        Dictionary<string, object> item;
        public IstantaAntlrVisitor(Dictionary<string,object> item)
        {
            this.item = item;
        }

        public override bool VisitIntComparison(ExpressionParser.IntComparisonContext context)
        {
            // Assumi che i figli siano nel formato [INT, REL_OP, INT]
            int left = int.Parse(context.GetChild(0).GetText());  // Ottieni il primo INT
            string op = context.GetChild(1).GetText();             // Ottieni il REL_OP
            int right = int.Parse(context.GetChild(2).GetText());  // Ottieni il secondo INT

            bool result;
            switch (op)
            {
                case ">":
                    result = left > right;
                    break;
                case "<":
                    result = left < right;
                    break;
                case ">=":
                    result = left >= right;
                    break;
                case "<=":
                    result = left <= right;
                    break;
                case "==":
                    result = left == right;
                    break;
                case "!=":
                    result = left == right;
                    break;
                default:
                    throw new InvalidOperationException("Unsupported operator: " + op);
            }

            // Converti il risultato booleano in un oggetto Result appropriato
            return result;
        }

        public override bool VisitParenExpr(ExpressionParser.ParenExprContext context)
        {
            ExpressionParser.ExprContext contextParen = context.expr();
            bool result = Visit(contextParen);
            ////Console.WriteLine($"VisitParenExpr: {result}");
            return result;
        }

        public override bool VisitLogicalExpr(ExpressionParser.LogicalExprContext context)
        {
            bool leftResult = Visit(context.expr(0));  // Visita il primo sub-espression
            string _operator = context.GetChild(1).GetText();  // Ottieni l'operatore logico
            bool rightResult = Visit(context.expr(1));  // Visita il secondo sub-espression

            // Applica l'operatore logico
            if (_operator == "&&")
                 return leftResult && rightResult;
            else if (_operator == "||")
                return leftResult || rightResult;
            else
                throw new InvalidOperationException("Unsupported logical operator: " + _operator);
        }

        public override bool VisitIdComparison(ExpressionParser.IdComparisonContext context)
        {
            string left = context.GetChild(0).GetText();  // Ottieni il primo ID
            string op = context.GetChild(1).GetText();             // Ottieni il REL_OP
            string right = context.GetChild(2).GetText();  // Ottieni il secondo ID

            return eseguiComparison(left, op, right);
        }

        public override bool VisitIdIntComparison([NotNull] ExpressionParser.IdIntComparisonContext context)
        {
            string left = context.GetChild(0).GetText();
            string op = context.GetChild(1).GetText();
            string right = context.GetChild(2).GetText();

            return eseguiComparison(left, op, right);
        }

        public override bool VisitIdDecimalComparison([NotNull] ExpressionParser.IdDecimalComparisonContext context)
        {
            string left = context.GetChild(0).GetText();
            string op = context.GetChild(1).GetText();

            string decimalText = context.GetChild(2).GetText();
            decimal right = Decimal.Parse(decimalText.Replace(".",System.Globalization.CultureInfo.CurrentCulture.NumberFormat.CurrencyDecimalSeparator));

            return eseguiComparison(left, op, right);
        }


        public override bool VisitIdNumMixStringComparison([NotNull] ExpressionParser.IdNumMixStringComparisonContext context)
        {
            string left = context.GetChild(0).GetText();  // Ottieni il primo ID
            string op = context.GetChild(1).GetText();             // Ottieni il REL_OP
            string right = context.GetChild(2).GetText();  // Ottieni il secondo ID

            return eseguiComparison(left, op, right);
        }

        private bool eseguiComparison(string left, string op, object rightObj)
        {
            if (this.item == null || !this.item.ContainsKey(left))
                return false;

            object? valObj = this.item[left];
            string typename = valObj.GetType().Name.ToLower();

            bool result=false;

            string? right= rightObj.ToString();

            if (typename != "string")
            {
                //Confronto tra numeri
                string typeNumConfronto = rightObj.GetType().Name.ToLower();

                if (
                    typeNumConfronto == "double" || 
                    typename == "double")
                {

                    double? val;
                    if (typename=="double")
                        val = (double)valObj;
                    else
                        val = Double.Parse(valObj.ToString()!);


                    double valRight;
                    if (typeNumConfronto == "double")
                        valRight = (double)rightObj;
                    else
                        valRight = Double.Parse(right!);

                    switch (op)
                    {
                        case ">":
                            result = val > valRight;
                            break;
                        case "<":
                            result = val < valRight;
                            break;
                        case ">=":
                            result = val >= valRight;
                            break;
                        case "<=":
                            result = val <= valRight;
                            break;
                        case "==":
                            result = val == valRight;
                            break;
                        case "!=":
                            result = val != valRight;
                            break;
                        default:
                            throw new InvalidOperationException("Unsupported operator: " + op);
                    }

                }
                else if (typeNumConfronto=="decimal" ||
                    typename=="decimal")
                {
                    decimal val;
                    if (typename == "double")
                        val = (decimal)valObj;
                    else
                        val = Decimal.Parse(valObj.ToString()!);


                    decimal valRight;
                    if (typeNumConfronto == "double")
                        valRight = (decimal)rightObj;
                    else
                        valRight = Decimal.Parse(right!);

                    switch (op)
                    {
                        case ">":
                            result = val > valRight;
                            break;
                        case "<":
                            result = val < valRight;
                            break;
                        case ">=":
                            result = val >= valRight;
                            break;
                        case "<=":
                            result = val <= valRight;
                            break;
                        case "==":
                            result = val == valRight;
                            break;
                        case "!=":
                            result = val != valRight;
                            break;
                        default:
                            throw new InvalidOperationException("Unsupported operator: " + op);
                    }
                }
                else if (typename == "int16")
                {
                    Int16? val = (Int16)valObj;
                    Int16 valRight = Int16.Parse(right!);
                    switch (op)
                    {
                        case ">":
                            result = val > valRight;
                            break;
                        case "<":
                            result = val < valRight;
                            break;
                        case ">=":
                            result = val >= valRight;
                            break;
                        case "<=":
                            result = val <= valRight;
                            break;
                        case "==":
                            result = val == valRight;
                            break;
                        case "!=":
                            result = val != valRight;
                            break;
                        default:
                            throw new InvalidOperationException("Unsupported operator: " + op);
                    }

                }
                else if (typename == "int32")
                {
                    Int32 val = (Int32)valObj;
                    Int32 valRight = Int32.Parse(right!);

                    switch (op)
                    {
                        case ">":
                            result = val > valRight;
                            break;
                        case "<":
                            result = val < valRight;
                            break;
                        case ">=":
                            result = val >= valRight;
                            break;
                        case "<=":
                            result = val <= valRight;
                            break;
                        case "==":
                            result = val == valRight;
                            break;
                        case "!=":
                            result = val != valRight;
                            break;
                        default:
                            throw new InvalidOperationException("Unsupported operator: " + op);
                    }
                }
                else if (typename == "int64")
                {
                    Int64 val = (Int64)valObj;
                    Int64 valRight = Int64.Parse(right!);
                    switch (op)
                    {
                        case ">":
                            result = val > valRight;
                            break;
                        case "<":
                            result = val < valRight;
                            break;
                        case ">=":
                            result = val >= valRight;
                            break;
                        case "<=":
                            result = val <= valRight;
                            break;
                        case "==":
                            result = val == valRight;
                            break;
                        case "!=":
                            result = val != valRight;
                            break;
                        default:
                            throw new InvalidOperationException("Unsupported operator: " + op);
                    }

                }
                else if (typename == "double")
                {
                    double val = (double)valObj;
                    double valRight = Double.Parse(right!);
                    switch (op)
                    {
                        case ">":
                            result = val > valRight;
                            break;
                        case "<":
                            result = val < valRight;
                            break;
                        case ">=":
                            result = val >= valRight;
                            break;
                        case "<=":
                            result = val <= valRight;
                            break;
                        case "==":
                            result = val == valRight;
                            break;
                        case "!=":
                            result = val != valRight;
                            break;
                        default:
                            throw new InvalidOperationException("Unsupported operator: " + op);
                    }
                }
                else if (typename == "decimal")
                {
                    decimal val = (decimal)valObj;
                    decimal valRight = Decimal.Parse(right!);
                    switch (op)
                    {
                        case ">":
                            result = val > valRight;
                            break;
                        case "<":
                            result = val < valRight;
                            break;
                        case ">=":
                            result = val >= valRight;
                            break;
                        case "<=":
                            result = val <= valRight;
                            break;
                        case "==":
                            result = val == valRight;
                            break;
                        case "!=":
                            result = val != valRight;
                            break;
                        default:
                            throw new InvalidOperationException("Unsupported operator: " + op);
                    }
                }
            }
            else
            {

                string val = this.item[left].ToString()!;

                switch (op)
                {
                    case "==":
                        result = val == right;
                        break;
                    case "!=":
                        result = val != right;
                        break;
                    case "$IN$":
                        result = right!.Contains(val);
                        break;
                    case "$NOTIN$":
                        result = !right!.Contains(val);
                        break;
                    default:
                        throw new InvalidOperationException("Unsupported operator: " + op);
                }
            }

            return result;
        }

    }
}
