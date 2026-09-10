import { contentReducer, generaContenutoDinamico } from "./ref";
import React, {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useCallback,
  useState,
} from "react";
import styleBox from "./boxref.module.scss";
import { v4 as uuidv4 } from "uuid";
import { Events, GRAVITA_PROBLEMA } from "@/stores/errorSlice";
import clsx from "clsx";
import { useAppDispatch } from "@/stores/hooks";
import {
  Config,
  ConfigWebpliant,
  DataFields,
  ForcedStyles,
  ReferenzeIstanta,
  StileBoxReferenza,
} from "../../../../lib/types";
import { useGestioneReferenze } from "@/context/GestioneReferenzeContext";
import { motion } from "framer-motion";
import parse from "html-react-parser";
import styleWp from "@/assets/css/webpliant/stylewp.module.scss";
import iconaWishlistWhite from "@/assets/images/webpliant/ico_wish_white.png"
import iconaWishlistRed from "@/assets/images/webpliant/ico_wish_red.png"
import cuore from "@/assets/images/webpliant/cuore.png";
import { ServerCall } from "../../../../lib/server_call";
import { useWebpliantParamsManager } from "@/hooks/useWebpliantParamsManager";
import focusAPNG from "@/assets/images/webpliant/ani_focus.apng";
import wishAPNG from "@/assets/images/webpliant/ani_wish.apng";
import rotatingStar from "@/assets/images/webpliant/rot_star.gif";

// --------------------------------------------------
// INTERFACES E UTILITY
// --------------------------------------------------
export interface BoxReferenzeProps extends React.HTMLAttributes<HTMLDivElement> {
  referenza: ReferenzeIstanta;
  config: Config | undefined;
  forzaturaBox?: string;
  forcedStyles?: ForcedStyles[];
  dateDiValidita?: {
    enabled: boolean;
    dataDiPartenza: string;
    dataDiScadenza: string;
  };
  isInWishlist?: boolean;
  options?: {
    removeBackground?: boolean;
    removeBorder?: boolean;
  }
}

// Funzione per creare un singolo cuoricino

function createHeart(button: HTMLButtonElement): void {
  // Get button position
  const rect = button.getBoundingClientRect();

  // Create heart element
  const heart = document.createElement('div');
  heart.className = 'heart';

  // Calculate position relative to viewport
  const startX = rect.left + Math.random() * rect.width;
  const startY = rect.top + rect.height / 2;

  // Fixed positioning based on viewport
  heart.style.position = 'fixed';
  heart.style.left = `${startX}px`;
  heart.style.top = `${startY}px`;

  // Add heart to body
  document.body.appendChild(heart);

  // Random animation duration
  const animationDuration = 1.2 + Math.random() * 0.6;
  heart.style.animation = `floatHeart ${animationDuration}s ease-out forwards`;

  // Remove heart element after animation
  setTimeout(() => {
    heart.remove();
  }, animationDuration * 1000);
}

// Funzione per generare più cuoricini al click


function generateHearts(button: HTMLButtonElement): void {
  // Aggiungi classe per l'animazione del bottone
  button.classList.add('button-clicked');

  // Rimuovi la classe dopo che l'animazione è completata
  setTimeout((): void => {
    button.classList.remove('button-clicked');
  }, 300);

  // Crea più cuoricini (5-8)
  const heartsCount: number = 5 + Math.floor(Math.random() * 6);

  for (let i = 0; i < heartsCount; i++) {
    // Ritarda leggermente la creazione di ogni cuoricino
    setTimeout((): void => {
      createHeart(button);
    }, i * 60);
  }
}

// --------------------------------------------------
// COMPONENTE PRINCIPALE: BoxRef
// --------------------------------------------------
const BoxRef: React.FC<BoxReferenzeProps> = ({
  referenza,
  config,
  forzaturaBox,
  forcedStyles,
  isInWishlist,
  options,
  style,
  ...divProps
}) => {
  const appDispatch = useAppDispatch();
  const containerRef = useRef<HTMLDivElement>(null);
  const { setReferenza } = useGestioneReferenze();
  const buttonRef = useRef<HTMLButtonElement>(null); // Riferimento al pulsante
  //NOTE : extraLogoRenderedRef NON DEVE ESSERE TOCCATO
  // Ref per controllare il rendering dei loghi extra (assicurarsi che siano renderizzati una sola volta)
  const [isInWishListState, setIsInWishListState] = useState(isInWishlist || false);
  
  // Usa il nuovo sistema centralizzato per i parametri
  const { sessionWishlistId } = useWebpliantParamsManager();
  const ids = { sessionWishlistId }; // Compatibilità temporanea





  // useEffect(() => {
  //   // Se la referenza è già presente nella wishlist, aggiorna lo stato
  //   const isInWishlist = checkReferenzeIsInWishlist(referenza.dataFields);
  //   setIsInWishListState(isInWishlist);
    
  // }, [referenza,checkReferenzeIsInWishlist]);

  const extraLogoRenderedRef = useRef(false);
  useEffect(() => {
    extraLogoRenderedRef.current = false;
  }, [referenza]);
  /**
   * Funzione di dispatch errore centralizzato
   */
  const dispatchErrore = useCallback(
    (message: string, foto: string[]) => {
      appDispatch({
        type: 'developerConsole/addErrore',
        payload: {
          id: uuidv4(),
          event: Events.MANCATA_IMMAGINE_REFERENZA,
          message,
          gravita: GRAVITA_PROBLEMA.CRITICA,
          foto,
          type: 'REFERENZA',
        },
      });
    },
    [appDispatch]
  );
  const saveReferenza = async (referenza: DataFields, fotos: string[]) => {
    try {
      // Register the store (this is idempotent - only creates if needed)
      const refConFoto = {
        ...referenza,
        foto: fotos,
      };
      console.log("refConFoto", refConFoto);
      const result = await ServerCall.put("/insertReferenzaInWishlist", { referenza: refConFoto, idWishList: ids.sessionWishlistId });
      
      // Emetti evento per notificare l'aggiunta dell'elemento
      const { wishlistEvents } = await import('@/utils/wishlistEvents');
      wishlistEvents.emit('item-added', refConFoto, ids.sessionWishlistId);
      
      console.log('✅ Prodotto aggiunto alla wishlist:', refConFoto.descrizione_uno);
      
    } catch (error) {
      console.error("Errore durante l'inserimento nella wishlist:", error);
    }
  };

  // 1) Unisce i dati personalizzati


  // 2) Trova la struttura in base a forzaturaBox o condizioni
  const struttura = useMemo(() => {
    if (!config) return null;
    // Se c'è forzaturaBox, la priorizziamo
    if (forzaturaBox && config?.webpliant.stili) {
      const forced =  config?.webpliant.stili?.find((stile: StileBoxReferenza) => stile.nome_stile === forzaturaBox);
      if (forced) return forced.struttura;
    }
    // Altrimenti cerchiamo lo stile con condizioni
    const stileConfig =  config?.webpliant.stili?.find((stile) => {
      if (!stile.condizioni) return false;
      if (typeof stile.condizioni === 'string') {
      return stile.condizioni === 'default';
      }
      return stile.condizioni.every((cond) => {
      const referenzaSpiattellata = { ...referenza, ...referenza.dataFields };
      const matchField = Object.entries(referenzaSpiattellata).find(([key, value]) => {
        if (key === cond.nome_campo) {
        if (Array.isArray(value)) {
          // Check if all values in cond.valori are present in the array
          return cond.valori.every((val) => value.includes(val as any));
        }
        return value === cond.valori[0];
        }
        return false;
      });
      if (!matchField) return false;
      return true;
      });
    });
    return stileConfig?.struttura;
  }, [config, forzaturaBox]);

  const strutturaMini = useMemo(() => {
    if (!config) return null;
    if (!config.webpliant.stili_minimal) return null;
    if (forzaturaBox && config?.webpliant.stili) {
      const forced = config.webpliant.stili_minimal.find((stile: StileBoxReferenza) => stile.nome_stile === forzaturaBox);
      if (forced) return forced.struttura;
    }
    const stileConfig = config.webpliant.stili_minimal.find((stile) => {
      if (!stile.condizioni) return false;
      if (typeof stile.condizioni === 'string') {
        return stile.condizioni === 'default';
      }
      return stile.condizioni.every((cond) => {
        const matchField = Object.entries(referenza).find(([key, value]) => key === cond.nome_campo && value === cond.valori[0]);
        if (!matchField) return false;
        return true;
      });
    });
    return stileConfig?.struttura;
  }, [referenza, config, forzaturaBox]);
  // 3) Gestione di alcuni errori per campi mancanti
  useEffect(() => {
    if (!referenza.foto) {
      dispatchErrore('Immagine non trovata', []);
    } else if (!referenza.dataFields.codice_referenza) {
      appDispatch({
        type: 'developerConsole/addErrore',
        payload: {
          id: uuidv4(),
          event: Events.MANCATO_CAMPO_REFERENZA,
          message: 'Campo codice non trovato',
          gravita: GRAVITA_PROBLEMA.CRITICA,
          foto: referenza.foto,
          type: 'REFERENZA',
        },
      });
    }
  }, [referenza, appDispatch, dispatchErrore]);

  // 4) Usa un reducer per gestire il content
  const [state, dispatch] = useReducer(contentReducer, { fullContent: null, miniContent: null });

  // Aggiungi lo stile CSS per l'animazione dei cuoricini all'inizio del componente
  useEffect(() => {
    // Create style only if it doesn't exist
    const styleId = 'heart-animation-style';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.innerHTML = `
        /* Heart style */
        .heart {
          position: fixed;
          width: 20px;
          height: 20px;
          /* Alternative: use an image instead of SVG */
          background-image: url('${cuore}');
          background-size: contain;
          background-repeat: no-repeat;
          pointer-events: none;
          z-index: 9999999;
          opacity: 1;
          transform: scale(0);
        }

        /* Improved animation */
        @keyframes floatHeart {
          0% {
            opacity: 1;
            transform: scale(0) translateY(0);
          }
          15% {
            opacity: 1;
            transform: scale(1.2) translateY(-5px);
          }
          30% {
            opacity: 1;
            transform: scale(1) translateY(-15px);
          }
          70% {
            opacity: 0.8;
            transform: scale(0.8) translateY(-30px) rotate(10deg);
          }
          100% {
            opacity: 0;
            transform: scale(0.5) translateY(-50px) rotate(30deg);
          }
        }

        /* Button animation */
        @keyframes buttonPulse {
          0% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
          100% {
            transform: scale(1);
          }
        }

        .button-clicked {
          animation: buttonPulse 0.3s ease-in-out;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  const handleAddToCart = async () => {
    try {
      await saveReferenza(referenza.dataFields, referenza.foto);

      // Animazione di aggiunta al carrello
      const button = buttonRef.current;
      if (button) {
        // Genera cuoricini
        generateHearts(button);

        // Manteniamo anche l'animazione originale
        button.classList.add(styleBox.addingToCart);
        setTimeout(() => {
          button.classList.remove(styleBox.addingToCart);
        }, 1000); // Durata dell'animazione
      }
    } catch (error) {
      console.error("Errore nel salvare la referenza:", error);
      appDispatch({
        type: 'developerConsole/addErrore',
        payload: {
          id: uuidv4(),
          event: Events.ERRORE_SALVATAGGIO_REFERENZA,
          message: `Errore nel salvare la referenza: ${error}`,
          gravita: GRAVITA_PROBLEMA.CRITICA,
          type: 'REFERENZA',
        },
      });
    }
  };
  // 5) Costruisci il contenuto dinamico se esiste struttura
  const memoizedContent = useMemo(() => {
    if (!struttura) return null;
    return generaContenutoDinamico({
      struttura,
      referenza,
      stiliForzati:forcedStyles,
      dispatchErrore,
      config,
      extraLogoRenderedRef,
      appDispatch,
  });
  }, [struttura, referenza, forcedStyles, dispatchErrore, config]);


  const memoizedContentMini = useMemo(() => {
    if (!strutturaMini) return null;
    return generaContenutoDinamico({
      struttura:strutturaMini,
      referenza,
      stiliForzati:forcedStyles,
      dispatchErrore,
      config,
      extraLogoRenderedRef,
      appDispatch,
    });
  }, [strutturaMini, referenza, forcedStyles, dispatchErrore, config]);

  // 6) Se manca struttura, cerca eventuale 'error' fallback
  useEffect(() => {
    if (!struttura) {
      const strutturaErrore = config?.webpliant.stili.find(
        (stile) => stile.condizioni === 'error'
      );
      if (strutturaErrore) {
        const content = generaContenutoDinamico({
          struttura:strutturaErrore.struttura,
          referenza,
          stiliForzati:forcedStyles,
          dispatchErrore,
          config,
          extraLogoRenderedRef,
          appDispatch,
        });
        dispatch({ type: 'SET_CONTENT', payload: content });
        appDispatch({
          type: 'developerConsole/addErrore',
          payload: {
            id: uuidv4(),
            event: Events.MANCATA_STRUTTURA_REFERENZA,
            message: `Struttura non trovata per la referenza con campi: ${Object.entries(
              referenza
            )
              .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
              .join(', ')}`,
            foto: referenza.foto,
            gravita: GRAVITA_PROBLEMA.CRITICA,
            type: 'REFERENZA',
          },
        });
      } else {
        // Nessuna struttura di errore
        appDispatch({
          type: 'developerConsole/addErrore',
          payload: {
            id: uuidv4(),
            event: Events.MANCATA_STRUTTURA_REFERENZA,
            message: `Struttura non trovata per la referenza con campi: ${Object.entries(
              referenza
            )
              .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
              .join(', ')}`,
            foto: referenza.foto,
            gravita: GRAVITA_PROBLEMA.CRITICA,
            type: 'REFERENZA',
          },
        });
        dispatch({ type: 'SET_CONTENT', payload: null });
      }
    } else {
      dispatch({ type: 'SET_CONTENT', payload: memoizedContent });
    }
  }, [struttura, memoizedContent, config, referenza, forcedStyles]);


  useEffect(() => {
    if (!strutturaMini && config?.webpliant.stili_minimal) {
      const strutturaMiniErrore = config?.webpliant.stili_minimal.find(
        (stile) => stile.condizioni === 'error'
      );
      if (strutturaMiniErrore) {
        const content = generaContenutoDinamico({
          struttura:strutturaMiniErrore.struttura,
          referenza,
          stiliForzati:forcedStyles,
          dispatchErrore,
          config,
          extraLogoRenderedRef,
          appDispatch,
        });
        dispatch({ type: 'SET_MINI_CONTENT', payload: content });
        appDispatch({
          type: 'developerConsole/addErrore',
          payload: {
            id: uuidv4(),
            event: Events.MANCATA_STRUTTURA_REFERENZA,
            message: `Struttura non trovata per la referenza con campi: ${Object.entries(
              referenza
            )
              .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
              .join(', ')}`,
            foto: referenza.foto,
            gravita: GRAVITA_PROBLEMA.CRITICA,
            type: 'REFERENZA',
          },
        });
      } else {
        // Nessuna struttura di errore
        appDispatch({
          type: 'developerConsole/addErrore',
          payload: {
            id: uuidv4(),
            event: Events.MANCATA_STRUTTURA_REFERENZA,
            message: `Struttura non trovata per la referenza con campi: ${Object.entries(
              referenza
            )
              .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
              .join(', ')}`,
            foto: referenza.foto,
            gravita: GRAVITA_PROBLEMA.CRITICA,
            type: 'REFERENZA',
          },
        });
        dispatch({ type: 'SET_MINI_CONTENT', payload: null });
      }

    }
    else {
      dispatch({ type: 'SET_MINI_CONTENT', payload: memoizedContentMini });
    }
  }, [memoizedContentMini, referenza, config, referenza, forcedStyles])

  const [flipped, setFlipped] = useState(false);
  // 7) Se non c'è contenuto, non renderizziamo
  if (!state.fullContent) {
    return null;
  }

  // 9) Varianti per l'animazione del flip
  const flipVariants = {
    front: {
      rotateY: 0,
      transition: { duration: 0.6, ease: "easeInOut" }
    },
    back: {
      rotateY: 180,
      transition: { duration: 0.6, ease: "easeInOut" }
    }
  };


  // 11) Render finale con motion
  return (
    <div
      ref={containerRef}
      onDoubleClick={() => {
        setReferenza(referenza)
        console.log(referenza);
      }}
      data-tooltip={`ciccio-tooltip-${referenza.dataFields.codice_referenza}`}
      {...divProps}
      style={{
        pointerEvents:flipped ? "auto" : "none",
      }}
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (!target.closest('[data-ignore-flip]') && !target.closest('button')) {
          setFlipped(!flipped);
        }
      }}
      className={styleBox.flipContainer}
    >
      
      <motion.div
        style={{
          backgroundImage: options?.removeBackground
        ? undefined
        : `url(${referenza.fotoExtra.filter((logo) => logo.tipo === 5)[0]?.guidId ?? "https://placehold.co/600x400?text=Hello\nWorld"})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
        animate={flipped ? "back" : "front"}
        variants={flipVariants}
        className={styleBox.card}
      >
        <div style={{
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
          width: "100%",
          height: "100%",
          pointerEvents: flipped ? "none" : "auto",
          perspective:"0"
        }}>
          {React.isValidElement(state.fullContent) &&
            React.cloneElement(state.fullContent as React.ReactElement<any>, {
              style: {
                border: options?.removeBorder ? "0" : undefined,
                backgroundColor: (() => {
                  const hasImage = referenza.fotoExtra.filter((logo) => logo.tipo === 5)[0]?.guidId != undefined;
                  const bgColor = hasImage ? undefined : style?.backgroundColor;
                  return bgColor; // Apply backgroundColor only if no image
                })(),
                ...style,
              },
            })}
          <div style={{ position: "absolute", top: "25%", width: "30px", height: "auto", left: "0px" }}>
            <div style={{ position: "relative", marginBottom: "5px", backgroundColor: "steelblue" }}>
              <img src={wishAPNG} alt="Ricetta abbinata" className="icon-gdo" />
            </div>
            {/* <div style={{ position: "relative", marginBottom: "5px", backgroundColor: "coral" }}>
              <img src={focusAPNG} alt="Ricetta abbinata" className="icon-gdo" />
            </div> */}
            {((referenza.contenutiAggiuntivi ?? []).length > 0) &&
              <div style={{ 
              position: "relative", 
              marginBottom: "5px", 
              backgroundColor: "coral", 
              height: "30px", 
              display: "flex", 
              alignContent: "center", 
              justifyContent: "space-around", 
              alignItems: "center" 
              }}>
              <img style={{width:"80%",height:"80%"}} src={rotatingStar} alt="Ricetta abbinata" className="icon-gdo" />
              </div>
            }
          </div>
        </div>
        <div className={styleBox.backContent}>
          <div className={styleBox.contentWrapper}>
            <div className={styleBox.innerContent}>
              <div className={styleWp["wp-flip_container_ref"]}>
                <img loading="lazy" src={referenza.foto[0]} alt={referenza.dataFields.descrizione_uno?.toString()} />
                {state.miniContent}
              </div>
              {referenza.contenutiAggiuntivi?.map((ca) => (
                <div style={{backgroundColor:ca.contenuto.sfondoLogo}} className={clsx(styleWp["wp-flip_container_value"],"mb-4")} key={ca.guidId}>
                  {ca.contenuto.logo || ca.contenuto.logoUrl ? (
                    <img
                      alt={ca.guidId}
                      loading="lazy"
                      src={ca.contenuto.logo == "custom" ? ca.contenuto.logoUrl : ca.contenuto.logo}
                    />
                  ) : (
                    <img
                      alt={"Logo piu dettagli"}
                      loading="lazy"
                      width={50}
                      src={"../../../../images/custom/ico_more_details.png"}
                    />
                  )}
                  {parse(ca.contenuto.descrizione)}
                </div>
              ))}
              {referenza.groupElements && referenza.groupElements.length > 0 && (
                <>
                  {referenza.groupElements?.map((group, i) => (
                    <div key={`${referenza.dataFields.codice_referenza  }_${  i}`} className={"flip_container_group_record"} style={{ backgroundColor: "#E9EAEC" }}>
                      <div className={"left"}>
                        <span className="ref_descrizionetitolo">{group.descrizione_uno} {group.descrizione_tre}</span>
                        <span className="ref_descrizionegrammatura">&nbsp;{group.descrizione_peso}</span>
                      </div>
                      <div className={"right"} style={{minWidth:"35px"}}>
                        <button className={"wishlist-button"} onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const button = e.currentTarget;

                          // Genera cuoricini
                          generateHearts(button);
                          await saveReferenza(group, referenza.foto);
                          // Manteniamo anche l'animazione originale
                          if (buttonRef.current) {
                            buttonRef.current.classList.add(styleBox.addingToCart);
                            setTimeout(() => {
                              buttonRef.current?.classList.remove(styleBox.addingToCart);
                            }, 1000);
                          }
                        }}>
                          <img style={{ height: 30, verticalAlign: "middle" }} src={iconaWishlistRed} alt="Aggiungi alla Wishlist" />
                        </button>
                      </div>
                    </div>
                  ))}
                  </>
              )}
          

              {(() => {
                // mi devi fare un calcolo per vedere se ci sono piu di un contenuto fra tutti quelli che processo
                const contenutiLength = (referenza.contenutiAggiuntivi?.length || 0) + (referenza.groupElements?.length || 0);
                const buttonText = isInWishListState
                  ? "Prodotto già nella tua wishlist!"
                  : "Aggiungi il prodotto alla tua wishlist!";
                const buttonIcon = isInWishListState ? iconaWishlistRed : iconaWishlistWhite;

                const handleWishlistClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log("Aggiungi alla wishlist");
                  if (!isInWishListState) {
                    await handleAddToCart();
                    setIsInWishListState(true);
                  }
                };

                // if (contenutiLength > 1) {
                //   return (
                //     <footer
                //       className={styleWp["wp-flip_container_footer"]}
                //       style={{ position: "sticky", bottom: 0, marginTop: "auto" }}
                //     >
                //       <div className={styleWp["wp-flip_container_wish_wrapper"]} style={{ position: "sticky", bottom: 0 }}>
                //         <div className={styleWp["wp-flip_container_wish"]}>
                //           <a href="#" style={{ textDecoration: "none" }}>
                //             <motion.button
                //               ref={buttonRef}
                //               onClick={handleWishlistClick}
                //               disabled={isInWishListState}
                //               data-ignore-flip="true"
                //             >
                //               <img
                //                 alt="Wishlist"
                //                 style={{
                //                   height: 25,
                //                   verticalAlign: "middle",
                //                   marginRight: 5,
                //                 }}
                //                 src={buttonIcon}
                //               />
                //               {buttonText}
                //             </motion.button>
                //           </a>
                //         </div>
                //       </div>
                //     </footer>
                //   );
                // } 
                if (referenza.groupElements.length <= 1) {
                  return (
                    <div
                      style={{ textAlign: "center", marginTop: "15px", height: "30%" }}
                      className=""
                    >
                      <a href="#" style={{ textDecoration: "none" }}>
                        <button
                          className={clsx(
                            styleWp["wp-flip_wish_button_big"],
                            styleWp["wp-d-flex"],
                            styleWp["wp-align-items-center"],
                            styleWp["wp-justify-content-center"],
                            "flex-col"
                          )}
                          ref={buttonRef}
                          onClick={handleWishlistClick}
                          disabled={isInWishListState}
                          data-ignore-flip="true"
                        >
                          <img
                            alt="Wishlist"
                            style={{
                              height: "50%",
                              verticalAlign: "middle",
                              marginRight: "5px",
                              objectFit: "contain",
                            }}
                            src={buttonIcon}
                          />
                          {buttonText}
                        </button>
                      </a>
                    </div>
                  );
                }
              })()}
            </div>

          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default React.memo(BoxRef);