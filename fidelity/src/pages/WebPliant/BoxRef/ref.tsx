
// Definizione delle interfacce

import styleWp from "@/assets/css/webpliant/stylewp.module.scss";
import { Events, GRAVITA_PROBLEMA } from "@/stores/errorSlice";
import parse from "html-react-parser";
import React from "react";
import { v4 as uuidv4 } from "uuid";
import { CompiledField, Config, ConfigurazioneCampoPersonalizzato, ConfigWebpliant, ForcedStyles, ReferenzeIstanta, Struttura } from "../../../../lib/types";
import styleBox from "./boxref.module.scss";


// Definizione dell'interfaccia per Referenza
// export interface Referenza {
//   [key: string]: any;
// }
// Unisce i campi personalizzati a `referenza` in base alla configurazione dei campi.
export const unisciDatiPersonalizzati = (referenza: ReferenzeIstanta, config: ConfigWebpliant): ReferenzeIstanta => {
  const referenzaUnita = referenza;
  const meccanicaConfig = config?.stili.find(stile => stile.nome_stile === (referenza.meccanica || 'default'));
  const campiConfig: { [key: string]: ConfigurazioneCampoPersonalizzato | undefined } = meccanicaConfig?.azioni?.reduce((acc, azione) => ({ ...acc, ...azione.campi }), {}) || {};

  for (const [campoPersonalizzato, valore] of Object.entries(referenzaUnita || {})) {
    const campoConfig = campiConfig[campoPersonalizzato];
    if (campoConfig?.azione === 'sostituisci' && campoConfig.campoDestinazione) {
      const field = referenzaUnita.compiledFields.find((f) => f.label_name === campoConfig.campoDestinazione);
      if (field) {
        field.content = valore;
      }
    }
    // else if (campoConfig?.azione === 'rimuovi') {
    //   delete referenzaUnita[campoPersonalizzato];
    // }
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
      "gi",
    );
    filteredContent = filteredContent.replace(regex, "");
  }
  return filteredContent;
};

// --------------------------------------------------
// FUNZIONE: Rimozione / Divisione del contenuto del prezzo
// --------------------------------------------------
export function renderPrezzoConDivisione(
  campo: CompiledField,
  divisione_contenuto?: { actions: any[] },
) {
  if (!divisione_contenuto?.actions?.length) {
    return campo.content;
  }

  const plainContent = campo.content.replace(/<[^>]*>/g, "").replace(/€/g, "").trim();
  let pointer = 0;
  let output = "";

  for (const action of divisione_contenuto.actions) {
    switch (action.comportamento) {
      case "untilFind": {
        const idx = plainContent.indexOf(action.charachter, pointer);
        if (idx === -1) {
          output += `<${action.tag}>${plainContent.substring(pointer)}</${action.tag
            }>`;
          pointer = plainContent.length;
        } else {
          const part = plainContent.substring(pointer, idx);
          output += `<${action.tag}>${part}</${action.tag}>`;
          pointer = idx;
        }
        break;
      }
      case "getChar": {
        if (
          pointer < plainContent.length &&
          plainContent.charAt(pointer) === action.charachter
        ) {
          output += `<${action.tag}>${action.charachter}</${action.tag}>`;
          pointer++;
        }
        break;
      }
      case "rest": {
        output += `<${action.tag}>${plainContent.substring(pointer)}</${action.tag
          }>`;
        pointer = plainContent.length;
        break;
      }
      default: {
        if (process.env.NODE_ENV !== "production") {
          console.warn(`Comportamento non gestito: ${action.comportamento}`);
        }
        break;
      }
    }
  }

  // Se è rimasto qualcosa, lo appendiamo
  if (pointer < plainContent.length) {
    output += plainContent.substring(pointer);
  }

  return output;
}

// --------------------------------------------------
// REDUCER PER IL CONTENUTO
// --------------------------------------------------
export type ContentState = {
  fullContent: React.ReactNode | null;
  miniContent: React.ReactNode | null;
};

export type ContentAction = {
  type: "SET_CONTENT" | "SET_MINI_CONTENT";
  payload: React.ReactNode | null;
};

export function contentReducer(
  state: ContentState,
  action: ContentAction,
): ContentState {
  switch (action.type) {
    case "SET_CONTENT":
      return { ...state, fullContent: action.payload };
    case "SET_MINI_CONTENT":
      return { ...state, miniContent: action.payload };
    default:
      return state;
  }
}

// --------------------------------------------------
// FUNZIONE AUSILIARIA PER LE IMMAGINI / SWIPER
// --------------------------------------------------
export function renderPhotos(
  photos: string[],
  attributi: any,
  dispatchErrore: (msg: string, arrFoto: string[]) => void,
) {

  // Se "src" === "{foto}", controlliamo se c'è 1 foto o più
  if (attributi["src"] === "{foto}") {
    // if (photos.length === 1) {
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
          src={photos[0] ? photos[0] : "https://placehold.co/600x400"}
          onError={() => {
            dispatchErrore(
              `Immagine non trovata. Foto: ${photos.join(", ")}`,
              photos,
            );
          }}
          alt="Foto"
          className="object-contain rounded-md img_ref_no_sfondo "
          style={{ height: "inherit" }}
          loading="lazy"
        />
      </div>
    );
    // }

    // Più immagini: utilizziamo lo swiper
    // return (
    //   <Swiper
    //     loop={true}
    //     modules={[Autoplay, Pagination, Navigation]}
    //     slidesPerView={1}
    //     autoplay={{
    //       delay: 3000,
    //       disableOnInteraction: false,
    //     }}
    //     style={{ overflow: "hidden", height: "100%" }}
    //     autoHeight={false}
    //     allowTouchMove={false}
    //   >
    //     {photos.map((photo, index) => (
    //       <SwiperSlide
    //         key={uuidv4()}
    //         style={{
    //           display: "flex",
    //           justifyContent: "center",
    //           alignItems: "center",
    //           height: "100%",
    //           overflow: "hidden",
    //         }}
    //       >
    //         <img
    //           src={photo}
    //           alt={`Foto ${index + 1}`}
    //           style={{
    //             height: "inherit",
    //             maxHeight: "100%",
    //             maxWidth: "100%",
    //             objectFit: "contain",
    //           }}
    //           loading="lazy"
    //           onError={() => {
    //             dispatchErrore(
    //               "Immagine non trovata. Foto: " + photos.join(", "),
    //               photos,
    //             );
    //           }}
    //         />
    //       </SwiperSlide>
    //     ))}
    //   </Swiper>
    // );
  }
  // Altrimenti è un'immagine singola con attributi "risolti"
  return (
    <img
      {...attributi}
      alt="Foto"
      className="object-contain rounded-md img_ref_no_sfondo "
      style={{ height: "inherit" }}
      loading="lazy"
      onError={() => {
        dispatchErrore("Immagine non trovata (renderPhotos fallback)", [
          attributi["src"],
        ]);
      }}
    />
  );
}

// --------------------------------------------------
// FUNZIONE PRINCIPALE DI RENDERING CONTENUTO DINAMICO
// --------------------------------------------------
export function generaContenutoDinamico({
  struttura,
  referenza,
  stiliForzati,
  dispatchErrore,
  config,
  extraLogoRenderedRef,
  appDispatch,
  options,
}: {
  struttura: Struttura;
  referenza: ReferenzeIstanta;
  stiliForzati?: ForcedStyles[];
  dispatchErrore: (msg: string, arrFoto: string[]) => void;
  config?: Config;
  extraLogoRenderedRef?: React.MutableRefObject<boolean>;
  appDispatch?: any;
  options?: {
    removeBackground?: boolean;
    removeBorder?: boolean;
  }
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

  if (stiliForzati) {
    for (const stile of stiliForzati) {
      // Se "campi" include "container" e siamo su root, applichiamo
      if (stile.campi.length === 0) {
        continue;
      }
      if (isRoot) {
        stiliPerTag = {
          ...(stiliPerTag || {}),
          backgroundColor: stile.backgroundColor !== undefined || stile.backgroundColor !== "" ? stile.backgroundColor : stiliPerTag?.backgroundColor,
          color: stile.color !== undefined || stile.color !== "" ? stile.color : stiliPerTag?.color,
          padding: stile.padding !== undefined || stile.padding !== "" ? stile.padding : stiliPerTag?.padding,
          borderRadius: stile.borderRadius !== undefined || stile.borderRadius !== "" ? stile.borderRadius : stiliPerTag?.borderRadius,
          border: stile.border !== undefined || stile.border !== "" ? stile.border : stiliPerTag?.border,
          height: stile.height !== undefined || stile.height !== "" ? stile.height : stiliPerTag?.height,
          width: stile.width !== undefined || stile.width !== "" ? stile.width : stiliPerTag?.width,

        };
      }
    }
  }
  if (deleted_field) {
    if (deleted_field.some((field) => referenza.deletedFields.includes(field))) {
      return null;
    }
  }
  if (tag === "br") {
    return <br key={uuidv4()} />;
  }

  // --------------------------------------------------
  // 1) Risolvi classi
  // --------------------------------------------------
  const resolvedClassi = (classi_css || [])
    .map((classe) => {
      if (typeof classe === "string") {
        if (classe.includes("{")) {
          return classe.replace(/{(.*?)}/g, (_: any, g: string) => {
            const val = referenza[g as keyof ReferenzeIstanta];
            if (typeof val === "string") {
              return val;
            }
            return "";
          });
        }
        const resolvedClass = styleWp[classe] || classe;
        return resolvedClass;
      } else {
        const referenzaSpiattellata = { ...referenza, ...referenza.dataFields };
        const matchField = Object.entries(referenzaSpiattellata).find(([key, value]) => {
          if (key === classe.nome_campo) {
            switch (classe.operatore) {
              case "contains":
                if (Array.isArray(value)) {
                  return value.includes(classe.valore);
                } else if (typeof value === "string") {
                  return value.includes(classe.valore);
                } else if (typeof value === "number") {
                  return value.toString().includes(classe.valore);
                } else if (typeof value === "object" && value !== null) {
                  console.warn("Object value found, using JSON.stringify");
                  console.warn(value);
                  console.warn(classe.valore);
                  console.warn(JSON.stringify(value));
                  console.warn(JSON.stringify(value).includes(classe.valore));
                  return JSON.stringify(value).includes(classe.valore);
                }
              case "equal":
                if (Array.isArray(value)) {
                  return value.includes(classe.valore);
                }
                return value === classe.valore;
              case "not-equal":
                if (Array.isArray(value)) {
                  return !value.includes(classe.valore);
                }
                return value !== classe.valore;
              case "startsWith":
                if (typeof value === "string") {
                  return value.startsWith(classe.valore);
                }
                return false;
              case "endsWith":
                if (typeof value === "string") {
                  return value.endsWith(classe.valore);
                }
                return false;
              case "greater-than":
                const fieldValue = referenzaSpiattellata[key as keyof typeof referenzaSpiattellata] || "0";
                const parsedValue = parseFloat(fieldValue.replace(",", ".").replace("%", "").trim());
                return parseFloat(classe.valore) < (isNaN(parsedValue) ? 0 : parsedValue);
              case "less-than":
                const fieldValueLess = referenzaSpiattellata[key as keyof typeof referenzaSpiattellata] || "0";
                const parsedValueLess = parseFloat(fieldValueLess.replace(",", ".").replace("%", "").trim());
                return parseFloat(classe.valore) > (isNaN(parsedValueLess) ? 0 : parsedValueLess);
              default:
                return false;
            }
          }
        });
        if (matchField) {
          return classe.classi_css.join(" ");
        }
      }
    })
    .join(" ");

  // --------------------------------------------------
  // 2) Risolvi attributi
  // --------------------------------------------------
  const resolvedAttributi = Object.fromEntries(
    Object.entries(attributi || {}).map(([key, val]) => {
      return [
        key,
        String(val).replace(/{(.*?)}/g, (_, g: string) => {
          const repl = referenza[g as keyof ReferenzeIstanta];
          return typeof repl === "string" ? repl : "";
        }),
      ];
    }),
  );

  // --------------------------------------------------
  // 3) Risoluzione del contenuto con placeholders
  // --------------------------------------------------
  // Enhanced content resolution section in the generaContenutoDinamico function
  // Modifiche alla funzione generaContenutoDinamico, sezione risoluzione contenuto
  // Sostituire la sezione relativa alla risoluzione del contenuto con questo codice:

  // --------------------------------------------------
  // 3) Risoluzione del contenuto con placeholders
  // --------------------------------------------------
  let resolvedContenuto: string | undefined = undefined;
  if (contenuto) {
    // First pass: collect all placeholders with their surrounding text
    const placeholderInfo: {
      placeholder: string;
      fullMatch: string;
      hasContent: boolean;
    }[] = [];

    // Find all placeholders and check if they have content
    const contenutoString = typeof contenuto === 'string' ? contenuto : String(contenuto || '');
    contenutoString.replace(/{(.*?)}/g, (fullMatch, fieldName: string) => {
      const campo = referenza.compiledFields.find(field => field.label_name === fieldName);
      placeholderInfo.push({
        placeholder: fieldName,
        fullMatch,
        hasContent: !!(campo && campo.content)
      });
      return fullMatch; // Just for the regex, doesn't affect the original string
    });

    // Second pass: process the content with surrounding text consideration
    resolvedContenuto = contenutoString;

    // Process in reverse order to avoid index shifts when removing content
    for (let i = placeholderInfo.length - 1; i >= 0; i--) {
      const { placeholder, hasContent } = placeholderInfo[i];

      if (!hasContent) {
        // Rimuove il placeholder insieme al testo statico circostante
        // Caso 1: controlla se il placeholder è preceduto da testo statico senza spazi
        // Esempio: "all'etto {prezzo_offerta_etto}"
        const prefixRegex = new RegExp(`([^\\s{}]+)\\s*{${placeholder}}`, 'g');
        resolvedContenuto = resolvedContenuto.replace(prefixRegex, '');

        // Caso 2: controlla se il placeholder è seguito da testo statico senza spazi
        // Esempio: "{prezzo_offerta_etto} all'etto"
        const suffixRegex = new RegExp(`{${placeholder}}\\s*([^\\s{}]+)`, 'g');
        resolvedContenuto = resolvedContenuto.replace(suffixRegex, '');

        // Caso 3: controlla se il placeholder è circondato da testo statico
        // Esempio: "prefix {prezzo_offerta_etto} suffix"
        const contextRegex = new RegExp(`([^\\s{}]*)\\s*{${placeholder}}\\s*([^\\s{}]*)`, 'g');
        resolvedContenuto = resolvedContenuto.replace(contextRegex, '');

        // Rimuove il placeholder nudo se ancora presente
        const bareRegex = new RegExp(`{${placeholder}}`, 'g');
        resolvedContenuto = resolvedContenuto.replace(bareRegex, '');
      } else {
        // Se abbiamo contenuto, lo processiamo normalmente
        const campo = referenza.compiledFields.find(field => field.label_name === placeholder);
        if (campo && campo.content) {
          const hasForcedLineBreak = campo.content.includes("FORCED_LINE_BREAK");
          let replacement = campo.content;

          // Handle $BR case - replace with <br /> tag
          const hasDollaroBR = campo.content.toLowerCase().includes("$br");
          if (hasDollaroBR) {
            replacement = replacement.replace(/\$BR/gi, "");
          }

          // Handle bullet points (•) - remove them
          const hasPuntino = replacement.includes("•") ||
            replacement.includes("\u2022") ||
            replacement.includes("\u25CF");
          if (hasPuntino) {
            replacement = replacement.replace(/[•\u2022\u25CF]/g, "");
          }

          // Handle special case with $br prefix
          if (replacement.toLowerCase().startsWith("$br")) {
            replacement = `<br />${replacement.substring(3)}`;
          }

          if (hasForcedLineBreak) {
            replacement = divisione_contenuto
              ? renderPrezzoConDivisione(campo, divisione_contenuto)
              : campo.content.replace(/FORCED_LINE_BREAK/g, "<br />");
          } else if (divisione_contenuto) {
            replacement = renderPrezzoConDivisione(campo, divisione_contenuto);
          }

          // Sostituisce il placeholder con il suo contenuto
          const regex = new RegExp(`{${placeholder}}`, 'g');
          resolvedContenuto = resolvedContenuto.replace(regex, replacement);
        }
      }
    }

    // Pulisce eventuali spazi multipli lasciati dalle rimozioni
    resolvedContenuto = resolvedContenuto.replace(/\s+/g, ' ').trim();

    // Se il contenuto è solo spazi, lo rende undefined
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
        "gi",
      );
      resolvedContenuto = resolvedContenuto.replace(
        regex,
        (_match, p1, p2, p3) => {
          const cleaned = p2.replace(/<br\s*\/?>/gi, "");
          if (element.tag_to_insert === "br") {
            return `${p1}${cleaned}${p3}<${element.tag_to_insert} />`;
          }
          return `${p1}${cleaned}${p3}<${element.tag_to_insert}></${element.tag_to_insert}>`;
        },
      );
    }
  }
  if (resolvedContenuto) {
    // Sostituisce gli underscore e spazi con trattini nei nomi dei tag
    // Gestisce anche tag in maiuscolo e con spazi
    resolvedContenuto = resolvedContenuto.replace(/<\s*\/?\s*([a-zA-Z0-9_\-\s]+)\s*([^>]*)>/gi, (match, tagName, attributes) => {
      // Normalizza il nome del tag: converte in minuscolo e sostituisce spazi/underscore con trattini
      const normalizedTagName = tagName.toLowerCase().replace(/[_\s]+/g, "-");
      // Rimuove trattini multipli consecutivi
      const cleanTagName = normalizedTagName.replace(/-+/g, "-");
      // Rimuove trattini iniziali e finali
      const finalTagName = cleanTagName.replace(/^-+|-+$/g, "");

      return `<${match.includes('/') ? '/' : ''}${finalTagName}${attributes}>`;
    });
  }
  // --------------------------------------------------
  // 5) Applica i filtri HTML
  if (resolvedContenuto && filtri_html) {
    resolvedContenuto = applyHtmlFilters(resolvedContenuto, filtri_html);
  }

  // --------------------------------------------------
  // 6) Applica stili forzati se definito
  // --------------------------------------------------



  // --------------------------------------------------
  // 7) Se HTML puro, inietta classi HTML se definito
  // --------------------------------------------------
  if (html_puro && resolvedContenuto) {
    if (inietta_classi_css) {
      for (const element of inietta_classi_css) {
        const regex = new RegExp(`(<${element.tag}[^>]*>)`, "gi");
        resolvedContenuto = resolvedContenuto.replace(regex, (match) => {
          if (match.includes('class="')) {
            return match.replace(
              'class="',
              `class="${element.classi_css.join(" ")} `,
            );
          }
          return match.replace(
            /<(\w+)/,
            `<$1 class="${element.classi_css.join(" ")}"`,
          );
        });
      }
    }

    try {
      if (!tag || typeof tag !== "string") {
        return null;
      }
      return React.createElement(
        tag,
        {
          ...resolvedAttributi,
          class: resolvedClassi, // Changed `class` to `className`
          style: stiliPerTag,
          key: uuidv4(),
        },
        <>
          {parse(resolvedContenuto)}
          {Array.isArray(figli) &&
            figli.map((figlio) =>
              typeof figlio === "string" ? (
                figlio === "&nbsp;" ? (
                  <React.Fragment key={uuidv4()}>&nbsp;</React.Fragment>
                ) : null
              ) : (
                generaContenutoDinamico({
                  struttura: figlio,
                  referenza,
                  stiliForzati,
                  dispatchErrore,
                  config,
                  extraLogoRenderedRef,
                  appDispatch,
                  options,
                })
              ),
            )}
        </>,
      );
    } catch (error: any) {
      console.error("Errore durante il parsing HTML:", error);
      return null;

    }
  }

  // --------------------------------------------------
  // 8) Risolve i figli non HTML puro
  // --------------------------------------------------
  const resolvedFigli = Array.isArray(figli)
    ? figli.map((figlio: Struttura | string, i: number) => {
      // Se figlio è stringa speciale
      if (typeof figlio === "string") {
        if (figlio === "&nbsp;") {
          return <React.Fragment key={uuidv4()}>&nbsp;</React.Fragment>;
        }
        if (figlio === "img") {
          if (referenza.fotoGruppo && referenza.fotoSingolaForzata === false) {
            const fotoGruppo = [referenza.fotoGruppo];
            return renderPhotos(fotoGruppo, attributi, (msg, arr) => {
              dispatchErrore(msg, arr);
            });
          } else {
            return renderPhotos(referenza.foto, attributi, (msg, arr) => {
              dispatchErrore(msg, arr);
            });
          }
        }
        // Se non è 'img' né '&nbsp;', non stampiamo nulla (o potremmo stampare testualmente)
        return null;
      }

      // Se è un oggetto Struttura
      if (figlio.condizioni && typeof figlio.condizioni !== "string") {
        // Verifichiamo se tutte le condizioni sono soddisfatte
        const referenzaSpiattellata = { ...referenza, ...referenza.dataFields, ...referenza.compiledFields };
        const condizioneSoddisfatta = figlio.condizioni.every((cond) => {
          const compiledFieldValue = referenza.compiledFields.find((f) => f.label_name === cond.nome_campo)?.content;
          const dataFieldValue = (referenzaSpiattellata as Record<string, any>)[cond.nome_campo];
          const fieldValue = compiledFieldValue ?? dataFieldValue;

          switch (cond.operatore) {
            case "equal":
              if (Array.isArray(fieldValue)) {
                return fieldValue.includes(cond.valore);
              }
              if (typeof fieldValue === "string") {
                return fieldValue === cond.valore;
              } else if (typeof fieldValue === "number") {
                return fieldValue.toString() === cond.valore;
              }
            case "not-equal":
              if (Array.isArray(fieldValue)) {
                return !fieldValue.includes(cond.valore);
              }
              if (typeof fieldValue === "string") {
                return fieldValue !== cond.valore;
              } else if (typeof fieldValue === "number") {
                return fieldValue.toString() !== cond.valore;
              }
            case "greater-than": {
              const fieldValueStr = typeof fieldValue === 'string' ? fieldValue : String(fieldValue || '');
              const parsedValue = parseFloat(fieldValueStr.replace(",", ".").replace("%", "").trim());
              return parseFloat(cond.valore) < (isNaN(parsedValue) ? 0 : parsedValue);
            }
            case "less-than": {
              const fieldValueStr = typeof fieldValue === 'string' ? fieldValue : String(fieldValue || '');
              const parsedValue = parseFloat(fieldValueStr.replace(",", ".").replace("%", "").trim());
              return parseFloat(cond.valore) > (isNaN(parsedValue) ? 0 : parsedValue);
            }
            case "contains": {
              const fieldValueStr = typeof fieldValue === 'string' ? fieldValue : String(fieldValue || '');
              return fieldValueStr?.includes(cond.valore);
            }
            case "not-contains": {
              const fieldValueStr = typeof fieldValue === 'string' ? fieldValue : String(fieldValue || '');
              return !fieldValueStr?.includes(cond.valore);
            }
            case "startsWith": {
              const fieldValueStr = typeof fieldValue === 'string' ? fieldValue : String(fieldValue || '');
              return fieldValueStr?.startsWith(cond.valore);
            }
            case "endsWith": {
              const fieldValueStr = typeof fieldValue === 'string' ? fieldValue : String(fieldValue || '');
              return fieldValueStr?.endsWith(cond.valore);
            }
            default:
              return false;
          }
        });
        if (!condizioneSoddisfatta) return null;
      }
      // Se "condizioni" è string => 'default', lo stampiamo
      return generaContenutoDinamico({
        struttura: figlio,
        referenza,
        stiliForzati,
        dispatchErrore,
        config,
        extraLogoRenderedRef,
        appDispatch,
        options,
      });
    })
    : null;

  // --------------------------------------------------
  // 9) Caso particolare se il tag è "img"
  // --------------------------------------------------
  if (tag === "img") {
    let extraLoghi: React.ReactNode = null;
    if (referenza?.fotoExtra?.length > 0 && extraLogoRenderedRef && !extraLogoRenderedRef.current) {
      extraLogoRenderedRef.current = true;
      const fotoExtra = referenza.fotoExtra.filter((logo) => logo.tipo !== 5);
      const staticLogoContainerId = `static-logo-container-${referenza.dataFields.codice_referenza
        ? referenza.dataFields.codice_referenza
        : uuidv4()
        }`;
      if (!resolvedContenuto?.includes(staticLogoContainerId)) {
        extraLoghi = (
          <div
            id={staticLogoContainerId}
            className={styleBox.extraLoghi}
          >
            <div
              style={{
                width: "100%",
              }}
            >
              {(() => {
                const loghi = renderFotoExtra(fotoExtra, appDispatch);
                return loghi.map((logo, index) => {
                  const modifiedLogo = {
                    ...logo,
                    key: `logo-${index}`,
                  };
                  return modifiedLogo;
                });
              })()}
            </div>
          </div>
        );
      }
    }
    if (referenza.fotoGruppo == undefined || (referenza.fotoSingolaForzata === true && referenza.fotoGruppo)) {
      return (
        <div
          {...resolvedAttributi}
          className={resolvedClassi}
          style={stiliPerTag}
          key={uuidv4()}
        >
          {renderPhotos(referenza.foto, attributi, (msg, arr) => {
            dispatchErrore(msg, arr);
          })}
          {extraLoghi}
        </div>
      );
    } else {
      return (
        <div
          {...resolvedAttributi}
          className={resolvedClassi}
          style={stiliPerTag}
          key={uuidv4()}
        >
          {renderPhotos([referenza.fotoGruppo], attributi, (msg, arr) => {
            dispatchErrore(msg, arr);
          })}
          {extraLoghi}
        </div>
      );
    }
  }
  // --------------------------------------------------
  // 11) Creiamo l'elemento React finale
  // --------------------------------------------------
  try {
    if (!tag || typeof tag !== "string") {
      console.log(struttura);
      console.error("Invalid or undefined tag:", tag);
      return null;
    }
    // if (isRoot == true) {
    //   console.group("OGGETTO RENDERING")
    //   console.log("Tag:", tag);
    //   console.log("Classi:", resolvedClassi);
    //   console.log("Attributi:", resolvedAttributi);
    //   console.log("Contenuto:", resolvedContenuto);
    //   console.log("Figli:", resolvedFigli);
    //   console.log("Stili:", stiliPerTag);
    //   console.groupEnd();
    // }
    return React.createElement(
      tag,
      {
        ...resolvedAttributi,
        className: resolvedClassi,
        style: stiliPerTag,
        key: uuidv4(),
      },
      <React.Fragment key={uuidv4()}>
        {resolvedContenuto && !html_puro && (
          <React.Fragment>{parse(resolvedContenuto)}</React.Fragment>
        )}
        {resolvedFigli}
      </React.Fragment>,
    );
  } catch (error: any) {
    console.error("Errore durante il rendering del contenuto:", error);
    return null;
  }
}

// --------------------------------------------------
// FUNZIONE: Render FotoExtra
// --------------------------------------------------
export function renderFotoExtra(
  fotoExtra: { tipo: number; sigla: string; guidId: string }[],
  appDispatch: (action: any) => void,

) {
  return fotoExtra.map((logo) => {
    return <img
      data-tipo={logo.tipo}
      data-sigla={logo.sigla}
      key={logo.guidId}
      src={logo.guidId}
      alt={`Logo-${logo.sigla}`}
      className={`logo_${logo.sigla.replace(/ /g, "_")}`}
      loading="lazy"
      onError={(e) => {
        // Se errore, rimuoviamo quell'elemento
        (e.target as HTMLImageElement).style.display = "none";
        appDispatch({
          type: 'developerConsole/addErrore',
          payload: {
            id: uuidv4(),
            event: Events.MANCATO_LOGO_REFERENZA,
            message: 'L\'url del logo è errato o non esistente',
            gravita: GRAVITA_PROBLEMA.CRITICA,
            logo,
            type: 'LOGO',
          },
        });
      }}
    />
  });
}
