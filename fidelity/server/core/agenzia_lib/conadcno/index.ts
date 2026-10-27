import { STATO_UTENTI, TIPO_UTENTI } from "../../../../lib/enums.js";
import { ForbiddenError, NotFoundError, UnauthorizedError } from "../../../../lib/errors/index.js";
import type { OidcUserClaims } from "../../interfaces/IOidcService.js";
import type { IUserService } from "../../interfaces/IUserService.js";
import { GDO } from "../../models/gdo.js";
import { UtentiGDO } from "../../models/utenti_gdo.js";
import { DefaultAgenziaLib } from "../default/index.js";
import type { ExternalAuthContext, ParsedOIDCUtente } from "../types.js";
import { importPuntiVenditaConadCno } from "./punti-vendita.js";
import { storicoVolantinoDB1 } from "./storico-db1.js";

const DEFAULT_BIRTH_DATE = "1970-01-01";
const ENTRA_ROLE_TO_USER_TYPE = new Map<string, TIPO_UTENTI>([
  [TIPO_UTENTI.GDO.toLowerCase(), TIPO_UTENTI.GDO],
  [TIPO_UTENTI.CATEGORY.toLowerCase(), TIPO_UTENTI.CATEGORY],
  [TIPO_UTENTI.MARKETING.toLowerCase(), TIPO_UTENTI.MARKETING],
  [TIPO_UTENTI.IT.toLowerCase(), TIPO_UTENTI.IT],
]);

function normalized(value: string): string {
  return value.trim().toLowerCase();
}

function resolveEntraUserType(
  claims: OidcUserClaims,
  allowedUserTypes: readonly string[] | null | undefined,
): TIPO_UTENTI {
  const roles = claims.roles ?? [];
  if (roles.some((role) => normalized(role) === TIPO_UTENTI.SUPERADMIN.toLowerCase())) {
    throw new UnauthorizedError({ message: "Il ruolo Superadmin non puo' essere assegnato da Microsoft Entra ID" });
  }

  const recognizedTypes = new Set<TIPO_UTENTI>();
  for (const role of roles) {
    const userType = ENTRA_ROLE_TO_USER_TYPE.get(normalized(role));
    if (userType) recognizedTypes.add(userType);
  }

  if (recognizedTypes.size !== 1) {
    throw new UnauthorizedError({
      message: recognizedTypes.size === 0
        ? "Microsoft Entra ID non ha restituito un ruolo Fidelity riconosciuto"
        : "Microsoft Entra ID ha restituito piu' ruoli Fidelity incompatibili",
    });
  }

  const userType = recognizedTypes.values().next().value as TIPO_UTENTI;
  if (Array.isArray(allowedUserTypes) && allowedUserTypes.length > 0 && !allowedUserTypes.includes(userType)) {
    throw new ForbiddenError({
      message: `Il tipo utente ${userType} non e' ammesso per questo metodo di accesso`,
    });
  }

  return userType;
}

function ensureAllowedEmailDomain(email: string, allowedDomains: readonly string[] | null | undefined): void {
  if (!Array.isArray(allowedDomains) || allowedDomains.length === 0) return;
  const domain = email.split('@').pop()?.toLowerCase() ?? '';
  const normalizedDomains = allowedDomains
    .filter((allowedDomain): allowedDomain is string => typeof allowedDomain === 'string')
    .map(normalized);
  if (!normalizedDomains.includes(domain)) {
    throw new ForbiddenError({
      message: `Il dominio email ${domain || '(assente)'} non e' ammesso per questo metodo di accesso`,
    });
  }
}

function userNames(claims: OidcUserClaims, email: string): { nome: string; cognome: string } {
  const givenName = claims.given_name?.trim();
  const familyName = claims.family_name?.trim();
  const fullNameParts = claims.name?.trim().split(/\s+/).filter(Boolean) ?? [];
  const emailName = email.split('@')[0]?.trim() || 'Utente';

  return {
    nome: givenName || fullNameParts[0] || emailName,
    cognome: familyName || fullNameParts.slice(1).join(' ') || 'Utente',
  };
}

/**
 * CONAD CNO. Per tutto il resto vale il comportamento di default, che e quello
 * che il loader usava gia per questo cliente; in piu ha lo storico dei volantini su DB1
 * e il proprio tracciato del file punti vendita.
 */
export class ConadcnoAgenziaLib extends DefaultAgenziaLib {
  constructor(private readonly conadcnoUserService: IUserService) {
    super(conadcnoUserService);
  }

  storicoVolantino = storicoVolantinoDB1;
  importPuntiVendita = importPuntiVenditaConadCno;

  async parseUtenteOIDC(
    email: string,
    claims: OidcUserClaims,
    context?: ExternalAuthContext,
  ): Promise<ParsedOIDCUtente> {
    // SAML e link di servizio mantengono il comportamento preesistente:
    // il provisioning da App Roles vale esclusivamente per il callback OIDC reale.
    if (context?.source !== 'oidc') return super.parseUtenteOIDC(email, claims);

    const normalizedEmail = email.trim().toLowerCase();
    ensureAllowedEmailDomain(normalizedEmail, context.allowedEmailDomains);
    const userType = resolveEntraUserType(claims, context.allowedUserTypes);
    const existingUser = await this.conadcnoUserService.getUserByEmail(normalizedEmail);

    if (existingUser) {
      // Un account non attivo non deve essere modificato durante un tentativo di accesso.
      await this.conadcnoUserService.verificaAccountAttivo(existingUser.id);
      if (existingUser.tipo !== userType) {
        await this.conadcnoUserService.updateProfile(existingUser.id, { tipo: userType });
      }

      let idGdo = existingUser.id_gdo;
      if (!idGdo) {
        const association = await UtentiGDO.findOne({
          where: { id_utente_utentegdo: existingUser.id },
        });
        idGdo = association?.id_gdo_utentegdo;
      }

      return {
        id: existingUser.id,
        private_key: await this.conadcnoUserService.getPrivateKey(existingUser.id),
        id_gdo: idGdo,
        email: existingUser.email,
        tipo_utente: userType,
      };
    }

    const gdo = await GDO.findOne();
    if (!gdo) {
      throw new NotFoundError({
        message: "GDO non presente nel database",
        entityType: "GDO",
      });
    }

    const names = userNames(claims, normalizedEmail);
    const createdUser = await this.conadcnoUserService.registerUserWithTransaction({
      email: normalizedEmail,
      nome: names.nome,
      cognome: names.cognome,
      tipo: userType,
      stato: STATO_UTENTI.ATTIVO,
      residenza: "Non specificata",
      dataDiNascita: DEFAULT_BIRTH_DATE,
      gdoScelta: gdo.id_gdo,
    }, "System");

    return {
      id: createdUser.id_utenti,
      private_key: await this.conadcnoUserService.getPrivateKey(createdUser.id_utenti),
      id_gdo: gdo.id_gdo,
      email: normalizedEmail,
      tipo_utente: userType,
    };
  }
}
