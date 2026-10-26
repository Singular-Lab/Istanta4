import { TIPO_UTENTI } from '../../../lib/enums';

export interface HubUserContext {
  userType: string;
  roleKeys: string[];
  ruoloGdoKey?: string;
}

function dedupe(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function normalizeGdoRoleKey(ruoloGdoKey?: string): string {
  const raw = (ruoloGdoKey || '').trim();
  if (!raw) return 'GDO_ADMIN';
  return /^gdo_/i.test(raw) ? raw.toUpperCase() : `GDO_${raw.toUpperCase()}`;
}

export function normalizeHubServiceRoleValue(ruoloGdoKey?: string | null): string | null {
  const raw = (ruoloGdoKey || '').trim();
  if (!raw) return null;
  return normalizeGdoRoleKey(raw);
}

export function getHubServiceRoleCandidates(ruoloGdoKey?: string | null): string[] {
  const raw = (ruoloGdoKey || '').trim();
  const normalized = normalizeHubServiceRoleValue(raw);

  if (!normalized) {
    return [];
  }

  const upper = raw.toUpperCase();
  const rawWithoutPrefix = /^gdo_/i.test(raw) ? raw.replace(/^gdo_/i, '') : raw;
  const upperWithoutPrefix = /^GDO_/i.test(upper) ? upper.replace(/^GDO_/i, '') : upper;

  return dedupe([
    normalized,
    raw,
    upper,
    rawWithoutPrefix,
    upperWithoutPrefix,
  ]);
}

export function normalizeHubTargetRole(role: string): string {
  const raw = role.trim();
  if (!raw) return '';

  const upper = raw.toUpperCase();
  const userType = Object.values(TIPO_UTENTI).find((value) => value.toUpperCase() === upper);
  if (userType) {
    return userType;
  }

  return normalizeGdoRoleKey(raw);
}

export function normalizeHubTargetRoles(roles?: string[] | null): string[] {
  return dedupe((roles || []).map((role) => normalizeHubTargetRole(role)));
}

/**
 * Verifica se i ruoli target (es. ruoli_destinatari delle news) matchano il contesto utente.
 * Usato ancora per HubNews che mantiene il sistema ruoli_destinatari JSONB.
 */
export function matchesHubRoles(targetRoles: string[] | null | undefined, context: HubUserContext): boolean {
  if (!targetRoles || targetRoles.length === 0) return true;
  return targetRoles.some((role) => context.roleKeys.includes(role));
}

export function buildHubUserContext(userType: string, ruoloGdoKey?: string): HubUserContext {
  if (userType === TIPO_UTENTI.GDO) {
    // Per GDO: il ruolo è sempre presente (default GDO_ADMIN se non specificato)
    const normalizedRole = normalizeGdoRoleKey(ruoloGdoKey);
    return {
      userType,
      ruoloGdoKey: normalizedRole,
      roleKeys: dedupe([normalizedRole, TIPO_UTENTI.GDO]),
    };
  }

  // Per altri tipi (IT, MARKETING, ecc.): usa il ruolo solo se esplicitamente fornito
  if (ruoloGdoKey) {
    const normalizedRole = normalizeGdoRoleKey(ruoloGdoKey);
    return {
      userType,
      ruoloGdoKey: normalizedRole,
      roleKeys: dedupe([normalizedRole, userType]),
    };
  }

  return {
    userType,
    roleKeys: dedupe([userType]),
  };
}
