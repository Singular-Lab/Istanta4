using IstantaLib;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace AgenziaLib
{
    internal class CompiledFieldInterpreter
    {
        public class fields
        {
            public List<CompiledField> compiledFields = new List<CompiledField>();
            public List<string> deletedFields = new List<string>();
        }

        fields currentFields = new fields();

        /// TASK-16f63122: i campi che stanno dentro un gruppo del box, per gruppo (Edro21: range2,
        /// tipo_punti2 e punti2 in Range_Punti_2). Cancellare il gruppo cancella anche loro: prima
        /// restavano fra i campi compilati, e il Plugin li segnalava come mancanti nel box. Vuota:
        /// conta solo l'etichetta cancellata, come prima.
        public Dictionary<string, List<string>> campiDeiContenitori { get; set; } = new Dictionary<string, List<string>>();

        /// Se il campo e' cancellato: lui stesso, o un gruppo dichiarato che lo contiene.
        bool cancellato(string labelName)
        {
            if (currentFields.deletedFields.Contains(labelName))
            {
                return true;
            }

            return campiDeiContenitori != null && campiDeiContenitori.Any(c =>
                c.Value != null && c.Value.Contains(labelName) && currentFields.deletedFields.Contains(c.Key));
        }

        public void clearInterpreter()
        {
            currentFields.compiledFields = new List<CompiledField>(); 
            currentFields.deletedFields = new List<string>();
        }

        /// TASK-e758bd95: veicolatoDa sono i campi del record da cui viene il contenuto, se l'agenzia li
        /// dichiara (Edro21); senza, il campo resta come prima.
        public void assignCompiledField(string labelName, string paragraphName, string content, IEnumerable<string> veicolatoDa = null)
        {
            List<string> veicolatura = veicolatoDa?.Where(c => !string.IsNullOrWhiteSpace(c)).Distinct().ToList();
            CompiledField nuovoElemento = currentFields.compiledFields.FirstOrDefault(f => f.labelName == labelName);

            //for (int i = 0; i < currentFields.compiledFields.Count; i++)
            //{
            //    if (currentFields.compiledFields[i].labelName == labelName)
            //    {
            //        currentFields.compiledFields[i].paragraphName = paragraphName;
            //        currentFields.compiledFields[i].content = content;
            //        return;
            //    }
            //}
            if (nuovoElemento == null)
            {
                nuovoElemento = new CompiledField()
                {
                    labelName = labelName,
                    paragraphName = paragraphName,
                    content = content,
                    veicolatoDa = veicolatura
                };

                currentFields.compiledFields.Add(nuovoElemento);
            }
            else
            {
                nuovoElemento.paragraphName = paragraphName;
                nuovoElemento.content = content;
                //Il contenuto nuovo viene da un altro ramo: vale la sua veicolatura, anche se non dichiarata.
                nuovoElemento.veicolatoDa = veicolatura;
            }
        }

        public void removeCompiledField(string labelName)
        {
            if (!currentFields.deletedFields.Contains(labelName))
            {
               currentFields.deletedFields.Add(labelName);
            }
        }

        public void restoreCompiledField(string labelName)
        {
            currentFields.deletedFields.Remove(labelName);
        }

        public fields getFields()
        {
            var returnField = new fields();
            for (int i = 0; i < currentFields.compiledFields.Count; i++)
            {
                if (!cancellato(currentFields.compiledFields[i].labelName))
                {
                    returnField.compiledFields.Add(currentFields.compiledFields[i]);
                }
            }

            returnField.deletedFields = currentFields.deletedFields;
            return returnField;
        }

        public void finalizeFields()
        {
            currentFields.compiledFields.RemoveAll(f => cancellato(f.labelName));
        }
        public CompiledField getFieldsValue(string labelName)
        {
            var validField = getFields();
            return validField.compiledFields.Find(f => f.labelName == labelName);
        }

        public CompiledFieldInterpreter Clone()
        {
            CompiledFieldInterpreter clone = new CompiledFieldInterpreter();
            clone.campiDeiContenitori = campiDeiContenitori;
            var validField = getFields();
            foreach (var field in validField.compiledFields)
            {
                clone.assignCompiledField(field.labelName, field.paragraphName, field.content, field.veicolatoDa);
            }
            foreach(var deleted in validField.deletedFields)
            {
                clone.removeCompiledField(deleted);
            }

            return clone;
        }
    
        public bool compiledContainsKey(string labelName)
        {
            return currentFields.compiledFields.Any(f => f.labelName == labelName);
        }
        public bool deletedContainsKey(string labelName)
        {
            return currentFields.deletedFields.Any(f => f == labelName);
        }
    }
}
