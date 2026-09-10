/**
 * BoxRefServer.tsx
 * Componente React per rendering server-side delle referenze
 * Port di src/pages/WebPliant/BoxRef/ref.tsx per uso con renderToStaticMarkup
 */

import parse from 'html-react-parser';
import React from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  CompiledField,
  ConfigWebpliant,
  ConfigurazioneCampoPersonalizzato,
  ForcedStyles,
  ReferenzeIstanta,
  Struttura
} from '../../../lib/types';

// ============================================
// INTERFACCE
// ============================================

export interface BoxRefServerProps {
  referenza: ReferenzeIstanta;
  config: ConfigWebpliant;
  options?: {
    baseUrl: string;
    removeBackground?: boolean;
    removeBorder?: boolean;
  };
  forcedStyles?: ForcedStyles[];
}

interface RenderOptions {
  baseUrl: string;
  removeBackground?: boolean;
  removeBorder?: boolean;
}

// ============================================
// FUNZIONI HELPER
// ============================================

/**
 * Unisce i campi personalizzati a `referenza` in base alla configurazione dei campi.
 */
export const unisciDatiPersonalizzati = (
  referenza: ReferenzeIstanta,
  config: ConfigWebpliant
): ReferenzeIstanta => {
  const referenzaUnita = { ...referenza };
  const meccanicaConfig = config?.stili?.find(
    stile => stile.nome_stile === (referenza.meccanica || 'default')
  );
  const campiConfig: { [key: string]: ConfigurazioneCampoPersonalizzato | undefined } =
    meccanicaConfig?.azioni?.reduce((acc, azione) => ({ ...acc, ...azione.campi }), {}) || {};

  for (const [campoPersonalizzato, valore] of Object.entries(referenzaUnita || {})) {
    const campoConfig = campiConfig[campoPersonalizzato];
    if (campoConfig?.azione === 'sostituisci' && campoConfig.campoDestinazione) {
      const field = referenzaUnita.compiledFields?.find(
        (f) => f.label_name === campoConfig.campoDestinazione
      );
      if (field) {
        field.content = valore as string;
      }
    }
  }

  return referenzaUnita;
};

/**
 * Funzione per applicare filtri HTML (rimuove tag specifici).
 */
export const applyHtmlFilters = (content: string, filters: string[] = []): string => {
  let filteredContent = content.toLowerCase();
  for (const filter of filters) {
    const regex = new RegExp(
      `<${filter}[^>]*>([\\s\\S]*?)<\\/${filter}>`,
      'gi'
    );
    filteredContent = filteredContent.replace(regex, '');
  }
  return filteredContent;
};

/**
 * Render del prezzo con divisione (es: separare euro da centesimi)
 */
export function renderPrezzoConDivisione(
  campo: CompiledField,
  divisione_contenuto?: { actions: any[] }
): string {
  if (!divisione_contenuto?.actions?.length) {
    return campo.content;
  }

  const plainContent = campo.content.replace(/<[^>]*>/g, '').replace(/€/g, '').trim();
  let pointer = 0;
  let output = '';

  for (const action of divisione_contenuto.actions) {
    switch (action.comportamento) {
      case 'untilFind': {
        const idx = plainContent.indexOf(action.charachter, pointer);
        if (idx === -1) {
          output += `<${action.tag}>${plainContent.substring(pointer)}</${action.tag}>`;
          pointer = plainContent.length;
        } else {
          const part = plainContent.substring(pointer, idx);
          output += `<${action.tag}>${part}</${action.tag}>`;
          pointer = idx;
        }
        break;
      }
      case 'getChar': {
        if (
          pointer < plainContent.length &&
          plainContent.charAt(pointer) === action.charachter
        ) {
          output += `<${action.tag}>${action.charachter}</${action.tag}>`;
          pointer++;
        }
        break;
      }
      case 'rest': {
        output += `<${action.tag}>${plainContent.substring(pointer)}</${action.tag}>`;
        pointer = plainContent.length;
        break;
      }
      default:
        break;
    }
  }

  if (pointer < plainContent.length) {
    output += plainContent.substring(pointer);
  }

  return output;
}

/**
 * Render delle foto
 */
export function renderPhotos(
  photos: string[],
  attributi: any,
  resolvedClassi?: string,
  dispatchErrore?: (msg: string, arrFoto: string[]) => void,
) {
  // Estrai gli attributi specifici per l'img (escluso src che gestiamo separatamente)
  const { src, ...otherAttributi } = attributi || {};

  // Combina le classi risolte con quelle di default
  const baseClasses = "object-contain rounded-md img_ref_no_sfondo";
  const finalClassName = resolvedClassi
    ? `${baseClasses} ${resolvedClassi}`.trim()
    : baseClasses;

  // Se "src" === "{foto}", controlliamo se c'è 1 foto o più
  if (src === "{foto}") {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100%",
        }}
      >
        <img
          {...otherAttributi}
          src={photos[0] ? photos[0] : "https://placehold.co/600x400"}
          onError={() => {
            dispatchErrore &&
              dispatchErrore(
                `Immagine non trovata. Foto: ${photos.join(", ")}`,
                photos,
              );
          }}
          alt={otherAttributi.alt || "Foto"}
          className={finalClassName}
          style={{ height: "inherit" }}
          loading="lazy"
        />
      </div>
    );
  }
  // Altrimenti è un'immagine singola con attributi "risolti"
  return (
    <img
      {...otherAttributi}
      src={src}
      alt={otherAttributi.alt || "Foto"}
      className={finalClassName}
      style={{ height: "inherit" }}
      loading="lazy"
      onError={() => {
        dispatchErrore && dispatchErrore(`Immagine non trovata. Foto: ${photos.join(", ")}`, photos);
      }}
    />
  );
}


/**
 * Render dei loghi extra
 */
export function renderFotoExtra(
  fotoExtra: { tipo: number; sigla: string; guidId: string }[],
  options: RenderOptions
): React.ReactNode[] {
  return fotoExtra.map((logo) => {
    const url = logo.guidId.startsWith('http') ? logo.guidId : `${options.baseUrl}${logo.guidId}`;
    return (
      <img
        data-tipo={logo.tipo}
        data-sigla={logo.sigla}
        key={logo.guidId}
        src={url}
        alt={`Logo-${logo.sigla}`}
        className={`logo_${logo.sigla.replace(/ /g, '_')}`}
        loading="lazy"
      />
    );
  });
}

// ============================================
// FUNZIONE PRINCIPALE DI RENDERING
// ============================================

/**
 * Genera il contenuto dinamico - port di generaContenutoDinamico da ref.tsx
 */
export function generaContenutoDinamicoServer({
  struttura,
  referenza,
  stiliForzati,
  options,
  extraLogoRendered = { current: false },
}: {
  struttura: Struttura;
  referenza: ReferenzeIstanta;
  stiliForzati?: ForcedStyles[];
  options: RenderOptions;
  extraLogoRendered?: { current: boolean };
}): React.ReactNode {
  if (!struttura) return null;

  const {
    tag,
    classi_css,
    attributi,
    figli,
    contenuto,
    html_puro,
    filtri_html,
    inietta_classi_css,
    divisione_contenuto,
    inietta_tag,
    deleted_field,
    root,
  } = struttura;

  let stiliPerTag: React.CSSProperties = {};
  const isRoot = root === true;

  // Applica stili forzati se presenti
  if (stiliForzati) {
    for (const stile of stiliForzati) {
      if (stile.campi.length === 0) continue;
      if (isRoot) {
        stiliPerTag = {
          ...(stiliPerTag || {}),
          backgroundColor: stile.backgroundColor !== undefined && stile.backgroundColor !== '' ? stile.backgroundColor : stiliPerTag?.backgroundColor,
          color: stile.color !== undefined && stile.color !== '' ? stile.color : stiliPerTag?.color,
          padding: stile.padding !== undefined && stile.padding !== '' ? stile.padding : stiliPerTag?.padding,
          borderRadius: stile.borderRadius !== undefined && stile.borderRadius !== '' ? stile.borderRadius : stiliPerTag?.borderRadius,
          border: stile.border !== undefined && stile.border !== '' ? stile.border : stiliPerTag?.border,
          height: stile.height !== undefined && stile.height !== '' ? stile.height : stiliPerTag?.height,
          width: stile.width !== undefined && stile.width !== '' ? stile.width : stiliPerTag?.width,
        };
      }
    }
  }

  // Gestione deleted_field
  if (deleted_field) {
    if (deleted_field.some((field) => referenza.deletedFields?.includes(field))) {
      return null;
    }
  }

  // Tag br
  if (tag === 'br') {
    return <br key={uuidv4()} />;
  }

  // --------------------------------------------------
  // 1) Risolvi classi
  // --------------------------------------------------
  const resolvedClassi = (classi_css || [])
    .map((classe) => {
      if (typeof classe === 'string') {
        if (classe.includes('{')) {
          return classe.replace(/{(.*?)}/g, (_: any, g: string) => {
            const val = referenza[g as keyof ReferenzeIstanta];
            if (typeof val === 'string') {
              return val;
            }
            return '';
          });
        }
        return classe;
      } else {
        // Classe condizionale
        const referenzaSpiattellata = { ...referenza, ...referenza.dataFields };
        const matchField = Object.entries(referenzaSpiattellata).find(([key, value]) => {
          if (key === classe.nome_campo) {
            switch (classe.operatore) {
              case 'contains':
                if (Array.isArray(value)) {
                  return value.includes(classe.valore);
                } else if (typeof value === 'string') {
                  return value.includes(classe.valore);
                } else if (typeof value === 'number') {
                  return value.toString().includes(classe.valore);
                } else if (typeof value === 'object' && value !== null) {
                  return JSON.stringify(value).includes(classe.valore);
                }
                return false;
              case 'equal':
                if (Array.isArray(value)) {
                  return value.includes(classe.valore);
                }
                return value === classe.valore;
              case 'not-equal':
                if (Array.isArray(value)) {
                  return !value.includes(classe.valore);
                }
                return value !== classe.valore;
              case 'startsWith':
                if (typeof value === 'string') {
                  return value.startsWith(classe.valore);
                }
                return false;
              case 'endsWith':
                if (typeof value === 'string') {
                  return value.endsWith(classe.valore);
                }
                return false;
              case 'greater-than': {
                const fieldValue = referenzaSpiattellata[key as keyof typeof referenzaSpiattellata] || '0';
                const parsedValue = parseFloat(String(fieldValue).replace(',', '.').replace('%', '').trim());
                return parseFloat(classe.valore) < (isNaN(parsedValue) ? 0 : parsedValue);
              }
              case 'less-than': {
                const fieldValueLess = referenzaSpiattellata[key as keyof typeof referenzaSpiattellata] || '0';
                const parsedValueLess = parseFloat(String(fieldValueLess).replace(',', '.').replace('%', '').trim());
                return parseFloat(classe.valore) > (isNaN(parsedValueLess) ? 0 : parsedValueLess);
              }
              default:
                return false;
            }
          }
          return false;
        });
        if (matchField) {
          return classe.classi_css.join(' ');
        }
        return '';
      }
    })
    .filter(Boolean)
    .join(' ');

  // --------------------------------------------------
  // 2) Risolvi attributi
  // --------------------------------------------------
  const resolvedAttributi = Object.fromEntries(
    Object.entries(attributi || {}).map(([key, val]) => {
      return [
        key,
        String(val).replace(/{(.*?)}/g, (_, g: string) => {
          // Cerca prima in referenza, poi in referenza.dataFields
          const repl = referenza[g as keyof ReferenzeIstanta] ??
            (referenza.dataFields as Record<string, unknown> | undefined)?.[g];
          return typeof repl === 'string' ? repl : '';
        }),
      ];
    })
  );

  // --------------------------------------------------
  // 3) Risoluzione del contenuto con placeholders
  // --------------------------------------------------
  let resolvedContenuto: string | undefined = undefined;
  if (contenuto) {
    const placeholderInfo: {
      placeholder: string;
      fullMatch: string;
      hasContent: boolean;
    }[] = [];

    const contenutoString = typeof contenuto === 'string' ? contenuto : String(contenuto || '');
    contenutoString.replace(/{(.*?)}/g, (fullMatch, fieldName: string) => {
      const campo = referenza.compiledFields?.find(field => field.label_name === fieldName);
      placeholderInfo.push({
        placeholder: fieldName,
        fullMatch,
        hasContent: !!(campo && campo.content)
      });
      return fullMatch;
    });

    resolvedContenuto = contenutoString;

    for (let i = placeholderInfo.length - 1; i >= 0; i--) {
      const { placeholder, hasContent } = placeholderInfo[i];

      if (!hasContent) {
        const prefixRegex = new RegExp(`([^\\s{}]+)\\s*{${placeholder}}`, 'g');
        resolvedContenuto = resolvedContenuto.replace(prefixRegex, '');

        const suffixRegex = new RegExp(`{${placeholder}}\\s*([^\\s{}]+)`, 'g');
        resolvedContenuto = resolvedContenuto.replace(suffixRegex, '');

        const contextRegex = new RegExp(`([^\\s{}]*)\\s*{${placeholder}}\\s*([^\\s{}]*)`, 'g');
        resolvedContenuto = resolvedContenuto.replace(contextRegex, '');

        const bareRegex = new RegExp(`{${placeholder}}`, 'g');
        resolvedContenuto = resolvedContenuto.replace(bareRegex, '');
      } else {
        const campo = referenza.compiledFields?.find(field => field.label_name === placeholder);
        if (campo && campo.content) {
          const hasForcedLineBreak = campo.content.includes('FORCED_LINE_BREAK');
          let replacement = campo.content;

          const hasDollaroBR = campo.content.toLowerCase().includes('$br');
          if (hasDollaroBR) {
            replacement = replacement.replace(/\$BR/gi, '');
          }

          const hasPuntino = replacement.includes('•') ||
            replacement.includes('\u2022') ||
            replacement.includes('\u25CF');
          if (hasPuntino) {
            replacement = replacement.replace(/[•\u2022\u25CF]/g, '');
          }

          if (replacement.toLowerCase().startsWith('$br')) {
            replacement = `<br />${replacement.substring(3)}`;
          }

          if (hasForcedLineBreak) {
            replacement = divisione_contenuto
              ? renderPrezzoConDivisione(campo, divisione_contenuto)
              : campo.content.replace(/FORCED_LINE_BREAK/g, '<br />');
          } else if (divisione_contenuto) {
            replacement = renderPrezzoConDivisione(campo, divisione_contenuto);
          }

          const regex = new RegExp(`{${placeholder}}`, 'g');
          resolvedContenuto = resolvedContenuto.replace(regex, replacement);
        }
      }
    }

    resolvedContenuto = resolvedContenuto.replace(/\s+/g, ' ').trim();

    if (resolvedContenuto.trim() === '') {
      resolvedContenuto = undefined;
    }
  }

  // --------------------------------------------------
  // 4) Inietta nuovi tag se definito
  // --------------------------------------------------
  if (resolvedContenuto && inietta_tag) {
    for (const element of inietta_tag) {
      const regex = new RegExp(
        `(<${element.tag_to_find}[^>]*>)([\\s\\S]*?)(</${element.tag_to_find}>)`,
        'gi'
      );
      resolvedContenuto = resolvedContenuto.replace(
        regex,
        (_match, p1, p2, p3) => {
          const cleaned = p2.replace(/<br\s*\/?>/gi, '');
          if (element.tag_to_insert === 'br') {
            return `${p1}${cleaned}${p3}<${element.tag_to_insert} />`;
          }
          return `${p1}${cleaned}${p3}<${element.tag_to_insert}></${element.tag_to_insert}>`;
        }
      );
    }
  }

  // Normalizza tag names
  if (resolvedContenuto) {
    resolvedContenuto = resolvedContenuto.replace(/<\s*\/?\s*([a-zA-Z0-9_\-\s]+)\s*([^>]*)>/gi, (match, tagName, attributes) => {
      const normalizedTagName = tagName.toLowerCase().replace(/[_\s]+/g, '-');
      const cleanTagName = normalizedTagName.replace(/-+/g, '-');
      const finalTagName = cleanTagName.replace(/^-+|-+$/g, '');
      return `<${match.includes('/') ? '/' : ''}${finalTagName}${attributes}>`;
    });
  }

  // --------------------------------------------------
  // 5) Applica i filtri HTML
  // --------------------------------------------------
  if (resolvedContenuto && filtri_html) {
    resolvedContenuto = applyHtmlFilters(resolvedContenuto, filtri_html);
  }

  // --------------------------------------------------
  // 6) Se HTML puro, inietta classi HTML se definito
  // --------------------------------------------------
  if (html_puro && resolvedContenuto) {
    if (inietta_classi_css) {
      for (const element of inietta_classi_css) {
        const regex = new RegExp(`(<${element.tag}[^>]*>)`, 'gi');
        resolvedContenuto = resolvedContenuto.replace(regex, (match) => {
          if (match.includes('class="')) {
            return match.replace(
              'class="',
              `class="${element.classi_css.join(' ')} `
            );
          }
          return match.replace(
            /<(\w+)/,
            `<$1 class="${element.classi_css.join(' ')}"`
          );
        });
      }
    }

    try {
      if (!tag || typeof tag !== 'string') {
        return null;
      }
      return React.createElement(
        tag,
        {
          ...resolvedAttributi,
          className: resolvedClassi || undefined,
          style: Object.keys(stiliPerTag).length > 0 ? stiliPerTag : undefined,
          key: uuidv4(),
        },
        <>
          {parse(resolvedContenuto)}
          {Array.isArray(figli) &&
            figli.map((figlio) =>
              typeof figlio === 'string' ? (
                figlio === '&nbsp;' ? (
                  <React.Fragment key={uuidv4()}>&nbsp;</React.Fragment>
                ) : null
              ) : (
                generaContenutoDinamicoServer({
                  struttura: figlio,
                  referenza,
                  stiliForzati,
                  options,
                  extraLogoRendered,
                })
              )
            )}
        </>
      );
    } catch (error: any) {
      console.error('Errore durante il parsing HTML:', error);
      return null;
    }
  }

  // --------------------------------------------------
  // 7) Risolve i figli non HTML puro
  // --------------------------------------------------
  const resolvedFigli = Array.isArray(figli)
    ? figli.map((figlio: Struttura | string) => {
      if (typeof figlio === 'string') {
        if (figlio === '&nbsp;') {
          return <React.Fragment key={uuidv4()}>&nbsp;</React.Fragment>;
        }
        if (figlio === 'img') {
          if (referenza.fotoGruppo && referenza.fotoSingolaForzata === false) {
            const fotoGruppo = [referenza.fotoGruppo];
            return renderPhotos(fotoGruppo, attributi, undefined);
          } else {
            return renderPhotos(referenza.foto || [], attributi, undefined);
          }
        }
        return null;
      }

      // Se è un oggetto Struttura con condizioni
      if (figlio.condizioni && typeof figlio.condizioni !== 'string') {
        const referenzaSpiattellata = { ...referenza, ...referenza.dataFields, ...referenza.compiledFields };
        const condizioneSoddisfatta = figlio.condizioni.every((cond) => {
          const compiledFieldValue = referenza.compiledFields?.find((f) => f.label_name === cond.nome_campo)?.content;
          const dataFieldValue = (referenzaSpiattellata as Record<string, any>)[cond.nome_campo];
          const fieldValue = compiledFieldValue ?? dataFieldValue;

          switch (cond.operatore) {
            case 'equal':
              if (Array.isArray(fieldValue)) {
                return fieldValue.includes(cond.valore);
              }
              if (typeof fieldValue === 'string') {
                return fieldValue === cond.valore;
              } else if (typeof fieldValue === 'number') {
                return fieldValue.toString() === cond.valore;
              }
              return false;
            case 'not-equal':
              if (Array.isArray(fieldValue)) {
                return !fieldValue.includes(cond.valore);
              }
              if (typeof fieldValue === 'string') {
                return fieldValue !== cond.valore;
              } else if (typeof fieldValue === 'number') {
                return fieldValue.toString() !== cond.valore;
              }
              return false;
            case 'greater-than': {
              const fieldValueStr = typeof fieldValue === 'string' ? fieldValue : String(fieldValue || '');
              const parsedValue = parseFloat(fieldValueStr.replace(',', '.').replace('%', '').trim());
              return parseFloat(cond.valore) < (isNaN(parsedValue) ? 0 : parsedValue);
            }
            case 'less-than': {
              const fieldValueStr = typeof fieldValue === 'string' ? fieldValue : String(fieldValue || '');
              const parsedValue = parseFloat(fieldValueStr.replace(',', '.').replace('%', '').trim());
              return parseFloat(cond.valore) > (isNaN(parsedValue) ? 0 : parsedValue);
            }
            case 'contains': {
              const fieldValueStr = typeof fieldValue === 'string' ? fieldValue : String(fieldValue || '');
              return fieldValueStr?.includes(cond.valore);
            }
            case 'not-contains': {
              const fieldValueStr = typeof fieldValue === 'string' ? fieldValue : String(fieldValue || '');
              return !fieldValueStr?.includes(cond.valore);
            }
            case 'startsWith': {
              const fieldValueStr = typeof fieldValue === 'string' ? fieldValue : String(fieldValue || '');
              return fieldValueStr?.startsWith(cond.valore);
            }
            case 'endsWith': {
              const fieldValueStr = typeof fieldValue === 'string' ? fieldValue : String(fieldValue || '');
              return fieldValueStr?.endsWith(cond.valore);
            }
            default:
              return false;
          }
        });
        if (!condizioneSoddisfatta) return null;
      }

      return generaContenutoDinamicoServer({
        struttura: figlio,
        referenza,
        stiliForzati,
        options,
        extraLogoRendered,
      });
    })
    : null;

  // --------------------------------------------------
  // 8) Caso particolare se il tag è "img"
  // --------------------------------------------------
  if (tag === 'img') {
    let extraLoghi: React.ReactNode = null;
    if (referenza?.fotoExtra?.length > 0 && !extraLogoRendered.current) {
      extraLogoRendered.current = true;
      const fotoExtraFiltered = referenza.fotoExtra.filter((logo) => logo.tipo !== 5);
      const staticLogoContainerId = `static-logo-container-${referenza.dataFields?.codice_referenza || uuidv4()}`;

      if (!resolvedContenuto?.includes(staticLogoContainerId)) {
        extraLoghi = (
          <div
            id={staticLogoContainerId}
            className="extraLoghi"
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexWrap: 'nowrap',
              position: 'absolute',
              flexDirection: 'column-reverse',
            }}
          >
            {renderFotoExtra(fotoExtraFiltered, options).map((logo, index) =>
              React.cloneElement(logo as React.ReactElement, { key: `logo-${index}` })
            )}
          </div>
        );
      }
    }

    const photos = referenza.fotoGruppo == undefined || (referenza.fotoSingolaForzata === true && referenza.fotoGruppo)
      ? referenza.foto || []
      : [referenza.fotoGruppo];

    // Filtra gli attributi specifici dell'img che non devono essere sul div wrapper
    const imgOnlyAttrs = ['src', 'width', 'height', 'alt', 'loading'];
    const divAttributi = Object.fromEntries(
      Object.entries(resolvedAttributi).filter(([key]) => !imgOnlyAttrs.includes(key))
    );

    return (
      <div
        {...divAttributi}
        className={resolvedClassi || undefined}
        style={Object.keys(stiliPerTag).length > 0 ? stiliPerTag : undefined}
        key={uuidv4()}
      >
        {renderPhotos(photos, attributi, resolvedClassi)}
        {extraLoghi}
      </div>
    );
  }

  // --------------------------------------------------
  // 9) Creiamo l'elemento React finale
  // --------------------------------------------------
  try {
    if (!tag || typeof tag !== 'string') {
      return null;
    }

    return React.createElement(
      tag,
      {
        ...resolvedAttributi,
        className: resolvedClassi || undefined,
        style: Object.keys(stiliPerTag).length > 0 ? stiliPerTag : undefined,
        key: uuidv4(),
      },
      <React.Fragment key={uuidv4()}>
        {resolvedContenuto && !html_puro && (
          <React.Fragment>{parse(resolvedContenuto)}</React.Fragment>
        )}
        {resolvedFigli}
      </React.Fragment>
    );
  } catch (error: any) {
    console.error('Errore durante il rendering del contenuto:', error);
    return null;
  }
}

// ============================================
// COMPONENTE PRINCIPALE
// ============================================

/**
 * Componente React per rendering server-side di una singola referenza
 */
export function BoxRefServer({
  referenza,
  config,
  options = { baseUrl: '' },
  forcedStyles,
}: BoxRefServerProps): React.ReactElement | null {
  // Trova lo stile corrispondente
  const stile = findMatchingStile(referenza, config);
  if (!stile) {
    return null;
  }

  // Unisci dati personalizzati
  const mergedRef = unisciDatiPersonalizzati(referenza, config);

  // Genera contenuto dinamico
  const content = generaContenutoDinamicoServer({
    struttura: stile.struttura,
    referenza: mergedRef,
    stiliForzati: forcedStyles,
    options,
  });

  return <>{content}</>;
}

/**
 * Trova lo stile che corrisponde alla referenza
 */
function findMatchingStile(
  referenza: ReferenzeIstanta,
  config: ConfigWebpliant
): { struttura: Struttura; nome_stile: string } | null {
  if (!config.stili || config.stili.length === 0) {
    return null;
  }

  // Se c'è una forzatura box nella referenza, usa quella
  const forzaturaBox = (referenza as any).forzaturaBox;
  if (forzaturaBox) {
    const forced = config.stili.find(s => s.nome_stile === forzaturaBox);
    if (forced) return forced;
  }

  // Cerca stile che matcha le condizioni
  const stileConfig = config.stili.find((stile) => {
    if (!stile.condizioni) return false;

    if (typeof stile.condizioni === 'string') {
      return stile.condizioni === 'default';
    }

    const referenzaSpiattellata = { ...referenza, ...referenza.dataFields };
    return stile.condizioni.every((cond) => {
      return Object.entries(referenzaSpiattellata).some(([key, value]) => {
        if (key === cond.nome_campo) {
          if (Array.isArray(value)) {
            return cond.valori.every((val) => value.includes(val));
          }
          return value === cond.valori[0];
        }
        return false;
      });
    });
  });

  if (stileConfig) return stileConfig;

  // Fallback: cerca stile 'default'
  return config.stili.find(s =>
    typeof s.condizioni === 'string' && s.condizioni === 'default'
  ) || config.stili[0] || null;
}

export default BoxRefServer;
