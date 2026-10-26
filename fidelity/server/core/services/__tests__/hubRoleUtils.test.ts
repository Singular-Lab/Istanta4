import { TIPO_UTENTI } from '../../../../lib/enums';
import { describe, expect, it } from 'vitest';
import {
  buildHubUserContext,
  getHubServiceRoleCandidates,
  matchesHubRoles,
  normalizeHubServiceRoleValue,
  normalizeHubTargetRoles,
} from '../hubRoleUtils';

describe('hubRoleUtils', () => {
  it('builds role keys for GDO with explicit role', () => {
    const context = buildHubUserContext(TIPO_UTENTI.GDO, 'GDO_DEVELOPER');
    expect(context.roleKeys).toEqual(['GDO_DEVELOPER', 'GDO']);
    expect(context.ruoloGdoKey).toBe('GDO_DEVELOPER');
  });

  it('falls back to GDO_ADMIN when role is missing', () => {
    const context = buildHubUserContext(TIPO_UTENTI.GDO);
    expect(context.roleKeys).toEqual(['GDO_ADMIN', 'GDO']);
    expect(context.ruoloGdoKey).toBe('GDO_ADMIN');
  });

  it('uses only user type for non-GDO users without role', () => {
    const context = buildHubUserContext(TIPO_UTENTI.AGENZIA);
    expect(context.roleKeys).toEqual([TIPO_UTENTI.AGENZIA]);
    expect(context.ruoloGdoKey).toBeUndefined();
  });

  it('includes role for non-GDO users with explicit role (IT, MARKETING, etc.)', () => {
    const context = buildHubUserContext(TIPO_UTENTI.IT, 'GDO_IMPIEGATO');
    expect(context.userType).toBe(TIPO_UTENTI.IT);
    expect(context.ruoloGdoKey).toBe('GDO_IMPIEGATO');
    expect(context.roleKeys).toEqual(['GDO_IMPIEGATO', TIPO_UTENTI.IT]);
  });

  it('normalizes non-GDO role key the same way as GDO', () => {
    const context = buildHubUserContext(TIPO_UTENTI.MARKETING, 'impiegato');
    expect(context.ruoloGdoKey).toBe('GDO_IMPIEGATO');
    expect(context.roleKeys).toContain('GDO_IMPIEGATO');
    expect(context.roleKeys).toContain(TIPO_UTENTI.MARKETING);
  });

  it('non-GDO without role returns no ruoloGdoKey even if undefined passed', () => {
    const context = buildHubUserContext(TIPO_UTENTI.IT, undefined);
    expect(context.ruoloGdoKey).toBeUndefined();
    expect(context.roleKeys).toEqual([TIPO_UTENTI.IT]);
  });

  it('matchesHubRoles works with role keys (used by HubNews)', () => {
    const context = buildHubUserContext(TIPO_UTENTI.GDO, 'GDO_ADMIN');
    expect(matchesHubRoles(['GDO_ADMIN'], context)).toBe(true);
    expect(matchesHubRoles(['GDO'], context)).toBe(true);
    expect(matchesHubRoles(['Agenzia'], context)).toBe(false);
    expect(matchesHubRoles([], context)).toBe(true);
  });

  it('normalizes hub service role values for persistence', () => {
    expect(normalizeHubServiceRoleValue('amministratore_delegato')).toBe('GDO_AMMINISTRATORE_DELEGATO');
    expect(normalizeHubServiceRoleValue('GDO_DEVELOPER')).toBe('GDO_DEVELOPER');
    expect(normalizeHubServiceRoleValue(null)).toBeNull();
  });

  it('builds service role candidates for legacy and normalized records', () => {
    expect(getHubServiceRoleCandidates('GDO_AMMINISTRATORE_DELEGATO')).toEqual([
      'GDO_AMMINISTRATORE_DELEGATO',
      'AMMINISTRATORE_DELEGATO',
    ]);
  });

  it('normalizes target roles for admin news payloads', () => {
    expect(normalizeHubTargetRoles(['gdo_admin', 'agenzia', 'GDO'])).toEqual([
      'GDO_ADMIN',
      TIPO_UTENTI.AGENZIA,
      TIPO_UTENTI.GDO,
    ]);
  });
});
