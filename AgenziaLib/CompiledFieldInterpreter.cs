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

        public void clearInterpreter()
        {
            currentFields.compiledFields = new List<CompiledField>(); 
            currentFields.deletedFields = new List<string>();
        }

        public void assignCompiledField(string labelName, string paragraphName, string content)
        {
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
                    content = content
                };

                currentFields.compiledFields.Add(nuovoElemento);
            }
            else
            {
                nuovoElemento.paragraphName = paragraphName;
                nuovoElemento.content = content;
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
                if (!currentFields.deletedFields.Contains(currentFields.compiledFields[i].labelName))
                {
                    returnField.compiledFields.Add(currentFields.compiledFields[i]);
                }
            }

            returnField.deletedFields = currentFields.deletedFields;
            return returnField;
        }

        public void finalizeFields()
        {
            currentFields.compiledFields.RemoveAll(f => currentFields.deletedFields.Contains(f.labelName));
        }
        public CompiledField getFieldsValue(string labelName)
        {
            var validField = getFields();
            return validField.compiledFields.Find(f => f.labelName == labelName);
        }

        public CompiledFieldInterpreter Clone()
        {
            CompiledFieldInterpreter clone = new CompiledFieldInterpreter();
            var validField = getFields();
            foreach (var field in validField.compiledFields)
            {
                clone.assignCompiledField(field.labelName, field.paragraphName, field.content);
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
