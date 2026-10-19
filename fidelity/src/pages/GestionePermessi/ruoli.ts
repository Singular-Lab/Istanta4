import { TIPO_UTENTI } from '../../../lib/enums';

export const ETICHETTE_TIPO: Record<string, string> = {
  [TIPO_UTENTI.AGENZIA]: 'Agenzia',
  [TIPO_UTENTI.CATEGORY]: 'Category',
  [TIPO_UTENTI.GDO]: 'GDO',
  [TIPO_UTENTI.MARKETING]: 'Marketing',
  [TIPO_UTENTI.PUNTOVENDITA]: 'Punto vendita',
  [TIPO_UTENTI.IT]: 'Reparto IT',
  [TIPO_UTENTI.GUEST]: 'Guest',
  [TIPO_UTENTI.SUPERADMIN]: 'Superadmin',
};

export const ICONE_TIPO: Record<string, string> = {
  [TIPO_UTENTI.AGENZIA]: 'Briefcase',
  [TIPO_UTENTI.CATEGORY]: 'Layers',
  [TIPO_UTENTI.GDO]: 'Building',
  [TIPO_UTENTI.MARKETING]: 'TrendingUp',
  [TIPO_UTENTI.PUNTOVENDITA]: 'Store',
  [TIPO_UTENTI.IT]: 'Computer',
  [TIPO_UTENTI.GUEST]: 'User',
  [TIPO_UTENTI.SUPERADMIN]: 'ShieldCheck',
};

/** "AMMINISTRATORE_DELEGATO" → "Amministratore delegato". */
export const etichettaSottoRuolo = (nome: string): string => {
  const testo = nome.replace(/^GDO_/i, '').replace(/_/g, ' ').toLowerCase();
  return testo.charAt(0).toUpperCase() + testo.slice(1);
};
