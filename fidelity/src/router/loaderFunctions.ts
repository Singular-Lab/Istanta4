import { ServerCall } from "../../lib/server_call";
import type {
  ConfigWebpliant,
  DESIGN_KIT_MONGO,
  FileItemKit,
  IPromo,
  OrdiniDiStampaAttributes,
  OrdiniDiStampaInviiAttributes,
  PuntiVenditaAttributes,
  RUNTIME_KIT_MONGO,
  ReferenzeIstanta,
  Ricette,
  TipiDiExportAttributes,
  GDOWhatsappTemplateAttributes
} from "../../lib/types";

// Extend ImportMeta interface to include 'env'
// Rimosso vecchio sistema IndexedDB - ora uso il nuovo sistema centralizzato
import { getColor } from "@/utils/colors";
import ReactGA from "react-ga4";
import type { LoaderFunction, LoaderFunctionArgs, Params } from "react-router-dom";
import { STATO_LAVORAZIONE_KIT_RUNTIME } from "../../lib/enums";
import type { AreaResponseDTO, CanaleResponseDTO, PromoResponseDTO, TracciatiResponseDTO, ContrattoTipografiaResponseDTO, GDOResponseDTO, OrdiniDiStampaResponseDTO } from "../../server/core/dto";

/**
 * Helper per aggiornare il progresso.
 * Utilizzando totalSteps e mantenendo in locale il contatore,
 * ogni chiamata a updateProgress incrementa il progresso.
 */






//
// FUNZIONI DI LOADER
//



export const funzioneCaricamentoVolantiniPDF = async ({ request }: { request: any }) => {
  let files: any[] | null = null;

  try {
    files = await ServerCall.get<any[]>("/getAllCombinazioniRuntimePDF");
  } catch (error) {
    console.error("Errore durante la chiamata:", error);
  }


  return { files };
};

export const funzioneCaricamentoTuttiIFilePerKit = async ({ request }: { request: any }) => {
  const url = new URL(request.url);
  const idKit = url.searchParams.get("kit") || "";
  const totalSteps = 1;

  let kit: any[] | null = null;

  try {
    kit = await ServerCall.get<any[]>(`/getAllFiles?id=${idKit}`);
  } catch (error) {
    console.error("Errore durante la chiamata:", error);
  }


  return { kit };
};








export const funzioneCaricamentoVolantinoWebPliant = async ({ request }: { request: any }) => {
  const url = new URL(request.url);
  const idWorkspace = url.searchParams.get("id") || "";
  const idArea = url.searchParams.get("idArea") || "";
  const idCanale = url.searchParams.get("idCanale") || "";
  const idGDO = url.searchParams.get("idGDO") || "";
  const date = url.searchParams.get("date") || "";
  // Total steps include 3 richieste (eventualmente più un ulteriore step per il CSS)
  const totalSteps = 4;


  const workspacePromise = ServerCall.get<{
    nomeWorkspace: string;
    idArea: string;
    idCanale: string;
    idGDO: string;
    idWorkspace: string;
    webpliant: Array<{
      id: number;
      type: string;
      content: {
        title: string;
        subtitle: string;
        filters: Array<{ field: string; operator: string; value: string }>;
        src: string;
        text: string;
      };
    }>;
  }>(`/prendiWorkspaceDaID/${idWorkspace}?isEditor=false`);

  const configPromise = ServerCall.get<ConfigWebpliant>("/get_config");

  const referenzePromise = ServerCall.get<Array<{
    id: number;
    foto: string;
    descrizione: string;
    prezzo_promo: string;
    prezzo_origine: string;
    sconto: string;
    meccanica: string;
    mastro: string;
    customData: any;
    prezzo_promo_principale: string;
    prezzo_promo_secondario: string;
  }>>(
    `/getReferenzeWebPliant?id=${idWorkspace}&gdo=${idGDO}&idArea=${idArea}&idCanale=${idCanale}&date=${date}`
  );

  const results = await Promise.allSettled([
    workspacePromise,
    configPromise,
    referenzePromise,
  ]);

  const [dataWebPliant, config, referenze] = results.map((result) => {
    if (result.status === "fulfilled") {
      return result.value;
    } else {
      console.error("Errore durante la chiamata:", result.reason);
      return null;
    }
  });


  return { dataWebPliant, config, referenze };
};

export const funzioneCaricamentoWebpliantLayout = async ({ params, request }: { params: Params, request: any }) => {
  const url = new URL(request.url);
  const idWorkspace = url.searchParams.get("id") || "";
  const idArea = url.searchParams.get("idArea") || "";
  const idCanale = url.searchParams.get("idCanale") || "";
  const idGDO = url.searchParams.get("idGDO") || "";
  const idPV = url.searchParams.get("idPV") || "";

  const totalSteps = 1;

  console.log(params)
  const workspacePromise = ServerCall.get<{
    nomeWorkspace: string;
    idArea: string;
    idCanale: string;
    idGDO: string;
    idWorkspace: string;
    webpliant: Array<{
      id: number;
      type: string;
      content: {
        title: string;
        subtitle: string;
        filters: Array<{ field: string; operator: string; value: string }>;
        src: string;
        text: string;
      };
    }>;
  }>(`/prendiWorkspaceDaID/${idWorkspace}?isEditor=false`);

  const configPromise = ServerCall.get<ConfigWebpliant>("/get_config");

  // Il nuovo sistema gestisce automaticamente sessioni e wishlist
  // Non è più necessario gestire questo nel loader

  //@ts-ignore
  if (import.meta.env.VITE_USER_NODE_ENV === "production") {
    ReactGA.initialize('G-BEQBR17LCC');
    ReactGA.set({
      timestamp: Date.now(),
      idCanale: idCanale || "unknown",
      idArea: idArea || "unknown",
    });
  }
  const result = await Promise.allSettled([workspacePromise, configPromise]);
  const [dataWebPliant, config] = result.map((r) =>
    r.status === "fulfilled" ? r.value : (console.error("Errore:", r.reason), null)
  );

  // Gestione degli stili
  const styleId = "webpliant-styles";

  const loadStyles = async () => {
    const existingStyle = document.getElementById(styleId);

    // Se il tag <style> esiste già e il numero di stili è maggiore di uno, rimuovilo
    if (existingStyle && document.querySelectorAll(`#${styleId}`).length > 1) {
      console.log("Più di uno stile trovato, rimuovendo...");
      existingStyle.remove();
    }

    // Crea un nuovo tag <style>
    const style = document.createElement("style");
    style.id = styleId; // Assegna un ID al tag <style>
    document.head.appendChild(style);

    let stylesContent = "";

    try {
      // Carica CSS dal server
      const cssServerCall = await ServerCall.get<string>("/getStiliToText");
      stylesContent += cssServerCall;
    } catch (error) {
      console.error("Errore durante il caricamento dei CSS dal server:", error);
    }

    // Applica lo stile al documento
    style.innerHTML = stylesContent;
  };

  await loadStyles();


  console.log("dataWebPliant", dataWebPliant);
  console.log("config", config);
  return { dataWebPliant, config };
};

export const funzioneCaricamentoRicetta = async ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  const idRicetta = url.searchParams.get("id") || "";
  const totalSteps = 2;


  const ricettaPromise = ServerCall.get<Ricette>(`/get_ricetta?id=${idRicetta}`);
  const referenzeRicettaPromise = ServerCall.get<ReferenzeIstanta[]>(`/get_referenze_ricetta?id=${idRicetta}`);
  const configPromise = ServerCall.get<ConfigWebpliant>("/get_config");

  const results = await Promise.allSettled([ricettaPromise, configPromise, referenzeRicettaPromise]);
  const [ricetta, config, referenzeRicetta] = results.map((r) =>
    r.status === "fulfilled" ? r.value : (console.error("Errore:", r.reason), null)
  );

  return { ricetta, config, referenzeRicetta };
};

export const funzioneCaricamentoWorkspace = async () => {
  const totalSteps = 4;


  const areePromise = ServerCall.get<AreaResponseDTO[]>("/all_aree");
  const canaliPromise = ServerCall.get<CanaleResponseDTO[]>("/all_canali");
  const workspacesPromise = ServerCall.get<
    { idWorkspace: string; nomeWorkspace: string; idArea: string; idCanale: string; idGDO: string }[]
  >("/allWorkspace");
  const puntiVenditaPromise = ServerCall.get<any[]>("/getAllPV");

  const results = await Promise.allSettled([areePromise, canaliPromise, workspacesPromise, puntiVenditaPromise]);
  const [aree, canali, workspaces, puntiVendita] = results.map((r) =>
    r.status === "fulfilled" ? r.value : (console.error("Errore:", r.reason), null)
  );


  return { aree, canali, workspaces, puntiVendita };
};

export const funzioneCaricamentoConfigWebpliant = async () => {
  const totalSteps = 1;


  const configPromise = ServerCall.get<ConfigWebpliant>("/get_config");

  const results = await Promise.allSettled([configPromise]);
  const [config] = results.map((r) =>
    r.status === "fulfilled" ? r.value : (console.error("Errore:", r.reason), null)
  );

  return { config };
};

export const funzioneCaricamentoWebpliant = async () => {
  const totalSteps = 1;


  const allDataPromise = ServerCall.put<any[]>("/datoMassivoPerWebPliant", {});

  const results = await Promise.allSettled([allDataPromise]);
  const [allData] = results.map((r) =>
    r.status === "fulfilled" ? r.value : (console.error("Errore:", r.reason), null)
  );
  return { allData };
};



export const funzioneLavorazioniInCorso = async () => {
  const totalSteps = 1;



  const lavorazioniPromise = ServerCall.get<PromoResponseDTO[]>("/promo/in-corso");

  const results = await Promise.allSettled([lavorazioniPromise]);
  const [dataLavorazioniInCorso] = results.map((r) =>
    r.status === "fulfilled" ? r.value : (console.error("Errore:", r.reason), null)
  );


  return { dataLavorazioniInCorso };
};

export const funzioneGestionePuntoVendita: LoaderFunction = async ({ request, params }) => {
  const idPV = params.id;

  const totalSteps = 1;




  const puntoVenditaPromise = ServerCall.get<PuntiVenditaAttributes>(`/get_pv_by_id?idPv=${idPV}`);

  const results = await Promise.allSettled([puntoVenditaPromise]);
  const [puntoVendita] = results.map((r) =>
    r.status === "fulfilled" ? r.value : (console.error("Errore:", r.reason), null)
  );


  return { puntoVendita };
}

export const funzioneDettagliLavorazioniInCorso = async ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  const pathSegments = url.pathname.split("/");
  const idPromo = pathSegments[pathSegments.length - 1] || "";

  type KitResponseType = {
    lavorazioni: ((DESIGN_KIT_MONGO & { nomeCanale: string, nomeArea: string, lavorazioneStarted: boolean, isDesignKit: boolean }) | (RUNTIME_KIT_MONGO & { nomeCanale: string, nomeArea: string, lavorazioneStarted: boolean, isDesignKit: boolean, files: FileItemKit[], tipiExport: TipiDiExportAttributes[] }))[];
    volantini: Array<{
      guidId: string;
      titolo: string;
      nomeArea?: string;
      nomeCanale?: string;
      stato_lavorazione: string;
      files: FileItemKit[];
    }>;
  };

  const kitPromise = ServerCall.get<KitResponseType>(`/getAllKitPerGestioneLavorazione/${idPromo}`);
  const tracciatiPromise = ServerCall.get<TracciatiResponseDTO[]>(`/tracciati/promo/${idPromo}?page=1&pageSize=20`);
  const allAreeGDOPromise = ServerCall.get<AreaResponseDTO[]>("/allAreeForGDO");
  const allCanaliGDOPromise = ServerCall.get<CanaleResponseDTO[]>("/allCanaliForGDO");
  const datoGraficoPaginaLavorazioniPromise = kitPromise.then(result => {
    const lavorazioni = result.lavorazioni;
    const completate = Array.isArray(lavorazioni) ? lavorazioni.filter(item => (item as RUNTIME_KIT_MONGO).stato_lavorazione === STATO_LAVORAZIONE_KIT_RUNTIME.PUBBLICATO).length : 0;
    const partite = Array.isArray(lavorazioni) ? lavorazioni.filter(item => (item as RUNTIME_KIT_MONGO).stato_lavorazione === STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE).length : 0;
    const daPartire = Array.isArray(lavorazioni) ? lavorazioni.filter(item => item.isDesignKit === true).length : 0;
    const inRevisione = Array.isArray(lavorazioni) ? lavorazioni.filter(item => (item as RUNTIME_KIT_MONGO).stato_lavorazione === STATO_LAVORAZIONE_KIT_RUNTIME.IN_REVISIONE).length : 0;
    return {
      datasets: [
        {
          label: 'Lavorazioni',
          data: [
            completate,
            partite,
            inRevisione,
            daPartire
          ],
          backgroundColor: [
            getColor("success", 0.5),
            getColor("primary", 0.5),
            getColor("warning", 0.5),
            getColor("danger", 0.5)
          ],
          borderColor: [
            getColor("success", 1),
            getColor("primary", 1),
            getColor("warning", 1),
            getColor("danger", 1)
          ],
          borderWidth: 1
        }
      ],
      labels: [
        'Lavorazioni Completate',
        'Lavorazioni Partite',
        'Lavorazioni In Revisione',
        'Lavorazioni da Partire'
      ]
    };
  });

  return {
    lavorazioni: kitPromise.then(r => r.lavorazioni),
    volantini: kitPromise.then(r => r.volantini),
    datiTracciatiCaricati: tracciatiPromise,
    datoGraficoPaginaLavorazioni: datoGraficoPaginaLavorazioniPromise,
    allAreeGDO: allAreeGDOPromise,
    allCanaliGDO: allCanaliGDOPromise
  };
};

export const funzioneDettagliKitManualiInCorso = async ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  const pathSegments = url.pathname.split("/");
  const idPromo = pathSegments[pathSegments.length - 2] || "";

  const totalSteps = 2;



  const lavorazionePromise = ServerCall.get<IPromo>(`/promo/${idPromo}`);
  const kitPromise = ServerCall.get<{ lavorazioni: any[]; volantini: any[] }>(`/getAllKitPerGestioneLavorazione/${idPromo}`);

  const results = await Promise.allSettled([
    kitPromise,
    lavorazionePromise,
  ]) as [
      PromiseSettledResult<{ lavorazioni: any[]; volantini: any[] }>,
      PromiseSettledResult<IPromo>
    ];

  const kitResult = results[0].status === "fulfilled" ? results[0].value : (console.error("Errore:", results[0].reason), null);
  const datiLavorazione = results[1].status === "fulfilled" ? results[1].value : (console.error("Errore:", results[1].reason), null);

  // Estrai l'array lavorazioni dalla risposta API
  const lavorazioniManuali = kitResult?.lavorazioni ?? [];

  return { lavorazioniManuali, datiLavorazione };
}

export const funzioneDettagliKit = async ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  const pathSegments = url.pathname.split("/");

  // Estrai idPromo e idKit dal percorso
  // Per un URL come /dettagli/681dc9e4ca1cd52a18c0b69e/kits/be404d69-4338-422f-91d2-f6277f0a937f
  const idKit = pathSegments.pop() || ""; // Ultimo segmento (idKit)
  pathSegments.pop(); // Rimuove "kits"
  const idPromo = pathSegments.pop() || ""; // Segmento idPromo

  const totalSteps = 1;

  const kitPromise = ServerCall.get<any>(`/get_kit_per_gestione_lavorazione/${idPromo}/${idKit}`);
  const results = await Promise.allSettled([kitPromise]);
  const [kit] = results.map((r) =>
    r.status === "fulfilled" ? r.value : (console.error("Errore:", r.reason), null)
  );
  return { kit };
}

export const funzioneCaricamentoEditWorkspace: LoaderFunction = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const idWorkspace = url.searchParams.get("id") || "";
  // Qui ci sono 2 richieste, quindi totalSteps è 2 (non è necessario chiamare updateProgress() all'esterno)
  const totalSteps = 3;


  const workspacePromise = ServerCall.get<{
    nomeWorkspace: string;
    idWorkspace: string;
    idGDO: string;
    idCanale: string;
    idArea: string;
    webpliant: Element[];
  }>(`/prendiWorkspaceDaID/${idWorkspace}?isEditor=true`);
  const configPromise = ServerCall.get<ConfigWebpliant>("/get_config");
  const linksPromise = ServerCall.get<{ id: string; nome: string }[]>("/getIdsWorkspace");
  const contenutiAggiuntiviPromise = ServerCall.get<any[]>("/getAllContenutiAggiuntivi");
  const listaUtentiOperatoriPromise = ServerCall.get<any[]>("/getAllUtentiOperatori");

  const promosPromise = ServerCall.get<PromoResponseDTO[]>("/promo/timeline");
  const results = await Promise.allSettled([workspacePromise, linksPromise, configPromise, contenutiAggiuntiviPromise, listaUtentiOperatoriPromise, promosPromise]);
  const [dataWorkspace, linkWorkspaces, config, contenutiAggiuntivi, listaUtentiOperatori, promos] = results.map((r) =>
    r.status === "fulfilled" ? r.value : (console.error("Errore:", r.reason), null)
  );
  const styleId = "webpliant-styles";

  const loadStyles = async () => {
    const existingStyle = document.getElementById(styleId);

    // Se il tag <style> esiste già e il numero di stili è maggiore di uno, rimuovilo
    if (existingStyle && document.querySelectorAll(`#${styleId}`).length > 1) {
      console.log("Più di uno stile trovato, rimuovendo...");
      existingStyle.remove();
    }

    // Crea un nuovo tag <style>
    const style = document.createElement("style");
    style.id = styleId; // Assegna un ID al tag <style>
    document.head.appendChild(style);

    let stylesContent = "";

    try {
      // Carica CSS dal server
      const cssServerCall = await ServerCall.get<string>("/getStiliToText");
      stylesContent += cssServerCall;
    } catch (error) {
      console.error("Errore durante il caricamento dei CSS dal server:", error);
    }

    // Applica lo stile al documento
    style.innerHTML = stylesContent;
  };

  await loadStyles();


  return { dataWorkspace, linkWorkspaces, config, contenutiAggiuntivi, listaUtentiOperatori, promos };
};

export const funzioneCaricamentoGestioneAI = async ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  const idWorkspace = url.pathname.split("/").pop() || "";
  // Due richieste → totalSteps = 2
  const totalSteps = 2;



  return {};
};




export const funzioneCaricamentoGestionePagineSingular = async ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  // Due richieste → totalSteps = 2
  const totalSteps = 2;


  const gestionePagineSingular = ServerCall.get<any>("/getGestionePagineSingular");

  const results = await Promise.allSettled([gestionePagineSingular]);
  const [tipo] = results.map((r) =>
    r.status === "fulfilled" ? r.value : (console.error("Errore:", r.reason), null)
  );


  const { TIPO_UTENTI } = tipo;
  return { TIPO_UTENTI };
}

export const funzioneCaricamentoImpostazioniTipografia = async () => {
  const totalSteps = 1;


  const impostazioniTipografia = ServerCall.get<any>("/get_all_tipi_export");
  const contrattoTipografia = ServerCall.get<ContrattoTipografiaResponseDTO>("/get_contratto_tipografia");
  const all_canali = ServerCall.get<CanaleResponseDTO[]>("/allCanaliForGDO");
  const all_aree = ServerCall.get<AreaResponseDTO[]>("/allAreeForGDO");
  const results = await Promise.allSettled([impostazioniTipografia, contrattoTipografia, all_canali, all_aree]);
  const [impostazioni, contratto, canali, aree] = results.map((r) =>
    r.status === "fulfilled" ? r.value : (console.error("Errore:", r.reason), null)
  );


  return { impostazioni, contratto, canali, aree };
}


export const funzioneCaricamentoOrdiniStampa = async () => {
  const totalSteps = 3;


  const ordiniStampa = ServerCall.get<(OrdiniDiStampaResponseDTO & { nomePromo: string })[]>("/getOrdiniDiStampaInCorso");
  const ordiniStampaCompletati = ServerCall.get<(OrdiniDiStampaResponseDTO & { nomePromo: string })[]>("/getAllOrdiniDiStampaFiniti");
  const allPromo = ServerCall.get<PromoResponseDTO[]>("/promo/in-corso");

  const results = await Promise.allSettled([ordiniStampa, allPromo, ordiniStampaCompletati]);
  const [ordiniDiStampa, promo, ordiniStampaFiniti]: [OrdiniDiStampaResponseDTO[] | null, PromoResponseDTO[] | null, OrdiniDiStampaResponseDTO & { nomePromo: string }] = results.map((r) =>
    r.status === "fulfilled" ? r.value : (console.error("Errore:", r.reason), null)
  ) as [OrdiniDiStampaResponseDTO[] | null, PromoResponseDTO[] | null, OrdiniDiStampaResponseDTO & { nomePromo: string }];


  let newPromo;
  if (ordiniDiStampa && promo) {
    newPromo = promo.filter((p) => !ordiniDiStampa?.some((o) => o.id_promo === p.id));
  }


  return { ordiniDiStampa, promo: newPromo, ordiniStampaFiniti };
}

export const funzioneCaricamentoDettagliOrdiniDiStampa = async ({ request }: { request: Request }) => {
  const idOrdineDiStampa = new URL(request.url).searchParams.get("id") || "";
  const totalSteps = 4;


  const dettagliOrdineDiStampa = ServerCall.get<RUNTIME_KIT_MONGO[]>(`/getDettagliOrdineDiStampa?id=${idOrdineDiStampa}`);
  const ordineDiStampa = ServerCall.get<OrdiniDiStampaAttributes>(`/getOrdineDiStampaById?id=${idOrdineDiStampa}`);
  const promoDaIdStampa = ServerCall.get<IPromo>(`/getPromoDaIdStampa?id=${idOrdineDiStampa}`);
  const getOrdiniInvii = ServerCall.get<OrdiniDiStampaInviiAttributes[]>(`/getOrdiniInviiByOrdineStampa?id=${idOrdineDiStampa}`);
  const results = await Promise.allSettled([dettagliOrdineDiStampa, promoDaIdStampa, ordineDiStampa, getOrdiniInvii]);
  const [dettagli, promo, ordine, ordiniInvii] = results.map((r) =>
    r.status === "fulfilled" ? r.value : (console.error("Errore:", r.reason), null)
  );

  return { dettagli, promo, ordine, ordiniInvii };
}

export const funzioneCaricamentoDettagliFineLavorazione = async ({ request }: { request: Request }) => {
  const idOrdineDiStampa = new URL(request.url).searchParams.get("id") || "";
  const totalSteps = 4;

  const dettagliOrdineDiStampa = ServerCall.get<RUNTIME_KIT_MONGO[]>(`/getDettagliOrdineDiStampa?id=${idOrdineDiStampa}`);
  const ordineDiStampa = ServerCall.get<OrdiniDiStampaAttributes>(`/getOrdineDiStampaById?id=${idOrdineDiStampa}`);
  const promoDaIdStampa = ServerCall.get<IPromo>(`/getPromoDaIdStampa?id=${idOrdineDiStampa}`);
  const getOrdiniInvii = ServerCall.get<OrdiniDiStampaInviiAttributes[]>(`/getOrdiniInviiByOrdineStampa?id=${idOrdineDiStampa}`);
  const results = await Promise.allSettled([dettagliOrdineDiStampa, ordineDiStampa, promoDaIdStampa, getOrdiniInvii]);
  const [dettagli, ordine, promo, ordiniInvii] = results.map((r) =>
    r.status === "fulfilled" ? r.value : (console.error("Errore:", r.reason), null)
  );

  return { dettagli, ordine, promo, ordiniInvii };
}

// Unified ODS Loader Functions (New Pattern)
export const funzioneCaricamentoNuovoODS = async () => {
  const promo = await ServerCall.get<PromoResponseDTO[]>("/promo/in-corso");
  return {
    title: "Nuovo Ordine di Stampa",
    description: "Crea un nuovo ordine di stampa da una promozione attiva",
    filterType: 'nuovo' as const,
    data: { promo: promo || [], ordini: [] }
  };
};

export const funzioneCaricamentoODSInCorso = async () => {
  const ordiniInCorso = await ServerCall.get<OrdiniDiStampaResponseDTO[]>("/getOrdiniDiStampaInCorso");
  return {
    title: "Ordine di Stampa in corso",
    description: "Ordini di stampa in fase di revisione e lavorazione",
    filterType: 'in-corso' as const,
    data: { ordini: ordiniInCorso || [], promo: [] }
  };
};

export const funzioneCaricamentoODSCompletati = async () => {
  const ordiniCompletati = await ServerCall.get<OrdiniDiStampaResponseDTO[]>("/getAllOrdiniDiStampaFiniti");
  return {
    title: "Ordine di Stampa completati",
    description: "Ordini di stampa inviati alla tipografia",
    filterType: 'completati' as const,
    data: { ordini: ordiniCompletati || [], promo: [] }
  };
}

export const funzioneCaricamentoTuttiIfFilesOrdiniDiStampa = async ({ request }: { request: Request }) => {
  const idKit = new URL(request.url).searchParams.get("id");
  // Kit metadata only — files are loaded via React Query with server-side pagination
  const myKit = ServerCall.get(`/getKitRunTimeById?get_files=false&id=${idKit}`)
  const myProperties = ServerCall.get(`/external/files/metadata-fields`)
  const results = await Promise.allSettled([myKit, myProperties])
  const [kit, proprieta] = results.map((r) =>
    r.status === "fulfilled" ? r.value : (console.error("Errore:", r.reason), null)
  )
  return { kit, proprieta, idKit }
}

export const funzioneCaricamentoModificaRicetta = async ({ request }: { request: Request }) => {
  const idRicetta = new URL(request.url).searchParams.get("id") || "";
  const ricettaPromise = ServerCall.get<Ricette>(`/get_ricetta?id=${idRicetta}`);
  const getReferenzePromise = ServerCall.get<any[]>(`/get_referenze_ricetta?id=${idRicetta}`);
  const results = await Promise.allSettled([ricettaPromise, getReferenzePromise]);
  const [ricetta, referenze] = results.map((r) =>
    r.status === "fulfilled" ? r.value : (console.error("Errore:", r.reason), null)
  );

  return { ricetta, referenze };
}


export const funzioneCaricamentoAuth = async ({ request, params }: { request: Request, params: Params }) => {
  const totalSteps = 1;
  const context = params.context;
  if (!context) {
    throw new Error("Context non trovato");
  }
  const promiseAuth = ServerCall.get<any>(`/autentica_utente_fico?context=${context}`);
  const results = await Promise.allSettled([promiseAuth]);
  const [auth] = results.map((r) =>
    r.status === "fulfilled" ? r.value : (console.error("Errore:", r.reason), null)
  );

  return { auth };
}


export const funzioneCaricamentoAuthAD = async ({ params }: { request: Request, params: Params }) => {
  const context = params.context;
  if (!context) {
    throw new Error("Context non trovato");
  }
  const promiseAuth = ServerCall.get<any>(`/autentica_utente_ad?context=${context}`);
  const results = await Promise.allSettled([promiseAuth]);
  const [auth] = results.map((r) =>
    r.status === "fulfilled" ? r.value : (console.error("Errore:", r.reason), null)
  );

  return { auth };
}


export const funzioneCaricamentoStoricoLavorazioni = async () => {
  // Rimossa la chiamata API - ora gestita da React Query
  return {};
}


export const funzioneCaricamentoGestioneApi = async () => {
  const totalSteps = 1;
  const apiKeyPromise = ServerCall.get<string>("/external/get_api_key");
  const templatePromise = ServerCall.get<string[]>("/get_all_template_combinazioni_design");
  const filterTemplatePromise = ServerCall.get("/external/filter-templates?includeInactive=true")
  const results = await Promise.allSettled([apiKeyPromise, templatePromise, filterTemplatePromise]);
  const [apiKey, template, template_filters] = results.map((r) =>
    r.status === "fulfilled" ? r.value : (console.error("Errore:", r.reason), null)
  );
  console.log(template_filters)

  return { apiKey, template, template_filters };
}
export const funzioneCaricamentoGestioneWhatsappSuperAdmin = async () => {
  const totalSteps = 1;
  const gdosListaPromise = ServerCall.get<GDOResponseDTO[]>("/whatsapp/get_all_gdo_whatsapp");
  const results = await Promise.allSettled([gdosListaPromise]);
  const [gdos_lista] = results.map((r) =>
    r.status === "fulfilled" ? r.value : (console.error("Errore:", r.reason), null)
  );

  return { gdos_lista };
}

export const funzioneCaricamentoGestioneSetupWhatsappSuperAdmin = async ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  const idGDO = url.searchParams.get("id") || "";
  const totalSteps = 1;
  const dettagliGDOPromise = ServerCall.get<{
    id: string;
    id_gdo: string;
    nome: string;
    id_numero_whatsapp: string;
    display_name: string;
    stato: string;
    provider: string;
    whatsapp_business_account_id: string;
    access_token?: string;
    verify_token?: string;
    createdat?: Date;
    updatedat?: Date;
  } | null>(`/whatsapp/get_whatsapp_gdo_by_id?id=${idGDO}`);
  const results = await Promise.allSettled([dettagliGDOPromise]);
  const [dettagliGDO] = results.map((r) =>
    r.status === "fulfilled" ? r.value : (console.error("Errore:", r.reason), null)
  );

  return { dettagliGDO };
}




export const funzioneCaricamentoGestioneTemplatesWhatsappAdmin = async ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  const idGDO = url.searchParams.get("id") || "";
  const totalSteps = 1;
  const templatesWhatsappPromise = ServerCall.get<{
    id: string;
    nome_template: string;
    lingua: string;
    stato: string;
    categoria: string;
    contenuto: string;
    id_gdo_whatsapp: string;
    createdat?: Date;
    updatedat?: Date;
  }[]>(`/whatsapp/get_all_templates_whatsapp_by_gdo?id=${idGDO}`);
  const dettagliGDOPromise = ServerCall.get<(GDOWhatsappTemplateAttributes & { preset_count: number })[]>(`/whatsapp/get_whatsapp_gdo_by_id?id=${idGDO}`);
  const results = await Promise.allSettled([templatesWhatsappPromise, dettagliGDOPromise]);
  const [templatesWhatsapp, dettagliGDO] = results.map((r) =>
    r.status === "fulfilled" ? r.value : (console.error("Errore:", r.reason), null)
  );

  return { templatesWhatsapp, dettagliGDO };
}

export const funzioneCaricamentoDettagliTemplateWhatsappAdmin = async ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  const idTemplate = url.searchParams.get("id") || "";
  const totalSteps = 1;
  const templateWhatsappPromise = ServerCall.get<GDOWhatsappTemplateAttributes>(`/whatsapp/get_whatsapp_template_by_id?id=${idTemplate}`);
  const presetsPromise = ServerCall.get<any[]>(`/whatsapp/get_all_presets_template_whatsapp?id_template=${idTemplate}`);
  const results = await Promise.allSettled([templateWhatsappPromise, presetsPromise]);
  const [template, presets] = results.map((r) =>
    r.status === "fulfilled" ? r.value : (console.error("Errore:", r.reason), null)
  );

  return { template, presets };
}

export const funzioneCaricamentoInvioCampagnaWhatsapp = async ({ request }: { request: Request }) => {
  const gdoPromise = ServerCall.get<GDOResponseDTO | null>("/whatsapp/get_current_gdo_whatsapp_for_campaign");
  const gdo = await gdoPromise;
  const templatesWhatsappPromise = ServerCall.get<{
    id: string;
    nome_template: string;
    lingua: string;
    stato: string;
    categoria: string;
    contenuto: string;
    id_gdo_whatsapp: string;
    createdat?: Date;
    updatedat?: Date;
  }[]>(`/whatsapp/get_all_templates_whatsapp_by_gdo?id=${gdo?.id}`);
  const getPuntiLatLonPVPromise = ServerCall.get<any[]>("/get_all_punti_lat_lon_pv");

  return {
    templatesWhatsappPromise,
    getPuntiLatLonPVPromise
  };
}

// Loader functions per MaterialiDocumentale
export const funzioneCaricamentoMaterialiAttivi = async () => {
  return {
    title: "Materiali Attivi",
    description: "Materiali di promozioni pubblicate ancora valide",
    filterType: 'attivi' as const
  };
};

export const funzioneCaricamentoMaterialiInCorso = async () => {
  return {
    title: "Materiali In Corso",
    description: "Materiali di promozioni in fase di lavorazione",
    filterType: 'in-corso' as const
  };
};

export const funzioneCaricamentoStoricoMateriali = async () => {
  return {
    title: "Storico Materiali",
    description: "Materiali di promozioni pubblicate scadute",
    filterType: 'storico' as const
  };
};

// Tipi per Dashboard3
interface FileAnteprima {
  id: string;
  nome: string;
  nome_originale?: string;
  tipo_export?: string;
  id_olimpo_cloud?: string;
  thumbnailUrl?: string;
  mime?: string;
  pages?: number;
}

interface KitVolantino {
  guidId: string;
  titolo: string;
  nomeArea?: string;
  nomeCanale?: string;
  stato_lavorazione: string;
  idPromo: string;
  validita_al?: string;
  files: FileAnteprima[];
}

interface VolantiniInCorsoResponse {
  totale: number;
  inScadenza: number;
  kit: KitVolantino[];
}

interface VolantiniInLavorazioneResponse {
  totale: number;
  inAttesa: number;
  kit: KitVolantino[];
}

interface VolantiniPubblicatiInLavorazioneResponse {
  totale: number;
  kit: KitVolantino[];
}

// Loader per Dashboard3 - Volantini
export const dashboard3Loader = async () => {
  const volantiniInCorsoPromise = ServerCall.get<VolantiniInCorsoResponse>("/dashboard/volantini-in-corso");
  const volantiniInLavorazionePromise = ServerCall.get<VolantiniInLavorazioneResponse>("/dashboard/volantini-in-lavorazione");
  const volantiniPubblicatiInLavorazionePromise = ServerCall.get<VolantiniPubblicatiInLavorazioneResponse>("/dashboard/volantini-pubblicati-in-lavorazione");
  const areePromise = ServerCall.get<AreaResponseDTO[]>("/allAreeForGDO");
  const canaliPromise = ServerCall.get<CanaleResponseDTO[]>("/allCanaliForGDO");

  return {
    volantiniInCorsoPromise,
    volantiniInLavorazionePromise,
    volantiniPubblicatiInLavorazionePromise,
    areePromise,
    canaliPromise
  };
};

// Loader per SuperadminDashboard
export const superadminDashboardLoader = async () => {
  const overviewPromise = ServerCall.get("/superadmin-dashboard/overview");
  return { overviewPromise };
};

// Loader per Materiali con Promozione preselezionata
// Questa pagina è accessibile sia da promo in corso che da promo pubblicate,
// quindi usiamo 'attivi' per includere le promo pubblicate
export const funzioneCaricamentoMaterialiPromo = async ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  const pathSegments = url.pathname.split("/");

  // Estrai idPromo dal percorso (es: /promozioni/in-corso/dettagli/:idPromo/materiali)
  const materialiIndex = pathSegments.indexOf("materiali");
  const idPromo = materialiIndex > 0 ? pathSegments[materialiIndex - 1] : "";

  return {
    title: "Materiali Promozione",
    description: "Materiali della promozione selezionata",
    filterType: 'attivi' as const,
    preselectedPromoId: idPromo
  };
};

// Loader per Kit POP
export const funzioneCaricamentoKitPop = async ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  const pathSegments = url.pathname.split("/");

  // Estrai idPromo e idKit dal percorso
  // Per un URL come /promozioni/in-corso/dettagli/:idPromo/pop/:idKit
  const idKit = pathSegments.pop() || ""; // Ultimo segmento (idKit)
  pathSegments.pop(); // Rimuove "pop"
  const idPromo = pathSegments.pop() || ""; // Segmento idPromo

  const kitPromise = ServerCall.get<any>(`/get_kit_per_gestione_lavorazione/${idPromo}/${idKit}`);
  const results = await Promise.allSettled([kitPromise]);
  const [kit] = results.map((r) =>
    r.status === "fulfilled" ? r.value : (console.error("Errore:", r.reason), null)
  );
  return { kit };
};
