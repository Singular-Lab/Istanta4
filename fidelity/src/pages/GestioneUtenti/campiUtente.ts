import * as yup from "yup";
import { REGOLA_TELEFONO } from "../../../lib/accessi/tipiUtenteCreabili";

/** Regole dei campi dell'anagrafica utente, uguali nella creazione e nella modifica. */

export const regolaNome = (campo: "nome" | "cognome") => {
  const etichetta = campo === "nome" ? "Il nome" : "Il cognome";
  return yup.string()
    .trim()
    .required(`${etichetta} è obbligatorio`)
    .min(2, `${etichetta} deve contenere almeno 2 caratteri`)
    .max(50, `${etichetta} non può superare i 50 caratteri`);
};

export const regolaEmail = () =>
  yup.string().trim().required("L'email è obbligatoria").email("Inserisci un'email valida");

/** Facoltativo: vuoto va bene, altrimenti cifre e spazi, con l'eventuale prefisso internazionale. */
export const regolaTelefono = () =>
  yup.string()
    .defined()
    .matches(REGOLA_TELEFONO, { message: "Telefono non valido: usa cifre e spazi, per esempio +39 055 123 4567", excludeEmptyString: true });

/** Facoltativa: vuota va bene, altrimenti una data valida e non futura. */
export const regolaDataDiNascita = () =>
  yup.string()
    .defined()
    .test("data-valida", "Data di nascita non valida", (valore) => {
      if (!valore) return true;
      const data = new Date(valore);
      return !isNaN(data.getTime()) && data <= new Date();
    });

export const regolaResidenza = () => yup.string().defined();

/** Email come la salva il server: minuscole e senza spazi ai lati. */
export const normalizzaEmail = (email: string) => email.trim().toLowerCase();
