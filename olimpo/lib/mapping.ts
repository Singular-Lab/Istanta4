import { TIPO_UTENTE_FICO_FINALE } from '@enums/enums';

const tipoUtenteMapping: { [key: number]: TIPO_UTENTE_FICO_FINALE } = {
  1: TIPO_UTENTE_FICO_FINALE.SUPERADMIN,
  2: TIPO_UTENTE_FICO_FINALE.AGENZIA,
  3: TIPO_UTENTE_FICO_FINALE.GUEST,
  4: TIPO_UTENTE_FICO_FINALE.GDO,
  5: TIPO_UTENTE_FICO_FINALE.PUNTOVENDITA,
  6: TIPO_UTENTE_FICO_FINALE.CATEGORY,
};

export function mapTipoUtente(numericValue: number): TIPO_UTENTE_FICO_FINALE {
  const tipoUtente = tipoUtenteMapping[numericValue];
  if (!tipoUtente) {
    throw new Error(`Valore numerico non valido per tipoUtente: ${numericValue}`);
  }
  return tipoUtente;
}