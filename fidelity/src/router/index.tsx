import {
  RouteObject,
  redirect,
  type ShouldRevalidateFunctionArgs,
} from "react-router-dom";


import NotFoundPage from "@/components/NotFoundPage";

type LoaderFunctionsModule = typeof import("./loaderFunctions");

const createLazyLoader = <K extends keyof LoaderFunctionsModule>(
  loaderName: K
): LoaderFunctionsModule[K] =>
  (async (...args: any[]) => {
    const module = await import("./loaderFunctions");
    const loader = module[loaderName] as (...params: any[]) => any;
    return loader(...args);
  }) as LoaderFunctionsModule[K];

const dashboard3Loader = createLazyLoader("dashboard3Loader");
const superadminDashboardLoader = createLazyLoader("superadminDashboardLoader");
const funzioneCaricamentoAuth = createLazyLoader("funzioneCaricamentoAuth");
const funzioneCaricamentoAuthAD = createLazyLoader("funzioneCaricamentoAuthAD");
const funzioneCaricamentoConfigWebpliant = createLazyLoader("funzioneCaricamentoConfigWebpliant");
const funzioneCaricamentoDettagliFineLavorazione = createLazyLoader("funzioneCaricamentoDettagliFineLavorazione");
const funzioneCaricamentoDettagliOrdiniDiStampa = createLazyLoader("funzioneCaricamentoDettagliOrdiniDiStampa");
const funzioneCaricamentoDettagliTemplateWhatsappAdmin = createLazyLoader("funzioneCaricamentoDettagliTemplateWhatsappAdmin");
const funzioneCaricamentoEditWorkspace = createLazyLoader("funzioneCaricamentoEditWorkspace");
const funzioneCaricamentoGestioneApi = createLazyLoader("funzioneCaricamentoGestioneApi");
const funzioneCaricamentoGestionePagineSingular = createLazyLoader("funzioneCaricamentoGestionePagineSingular");
const funzioneCaricamentoGestioneSetupWhatsappSuperAdmin = createLazyLoader("funzioneCaricamentoGestioneSetupWhatsappSuperAdmin");
const funzioneCaricamentoGestioneTemplatesWhatsappAdmin = createLazyLoader("funzioneCaricamentoGestioneTemplatesWhatsappAdmin");
const funzioneCaricamentoGestioneWhatsappSuperAdmin = createLazyLoader("funzioneCaricamentoGestioneWhatsappSuperAdmin");
const funzioneCaricamentoImpostazioniTipografia = createLazyLoader("funzioneCaricamentoImpostazioniTipografia");
const funzioneCaricamentoInvioCampagnaWhatsapp = createLazyLoader("funzioneCaricamentoInvioCampagnaWhatsapp");
const funzioneCaricamentoKitPop = createLazyLoader("funzioneCaricamentoKitPop");
const funzioneCaricamentoMaterialiAttivi = createLazyLoader("funzioneCaricamentoMaterialiAttivi");
const funzioneCaricamentoMaterialiInCorso = createLazyLoader("funzioneCaricamentoMaterialiInCorso");
const funzioneCaricamentoMaterialiPromo = createLazyLoader("funzioneCaricamentoMaterialiPromo");
const funzioneCaricamentoModificaRicetta = createLazyLoader("funzioneCaricamentoModificaRicetta");
const funzioneCaricamentoNuovoODS = createLazyLoader("funzioneCaricamentoNuovoODS");
const funzioneCaricamentoODSCompletati = createLazyLoader("funzioneCaricamentoODSCompletati");
const funzioneCaricamentoODSInCorso = createLazyLoader("funzioneCaricamentoODSInCorso");
const funzioneCaricamentoRicetta = createLazyLoader("funzioneCaricamentoRicetta");
const funzioneCaricamentoStoricoLavorazioni = createLazyLoader("funzioneCaricamentoStoricoLavorazioni");
const funzioneCaricamentoStoricoMateriali = createLazyLoader("funzioneCaricamentoStoricoMateriali");
const funzioneCaricamentoTuttiIFilePerKit = createLazyLoader("funzioneCaricamentoTuttiIFilePerKit");
const funzioneCaricamentoTuttiIfFilesOrdiniDiStampa = createLazyLoader("funzioneCaricamentoTuttiIfFilesOrdiniDiStampa");
const funzioneCaricamentoVolantiniPDF = createLazyLoader("funzioneCaricamentoVolantiniPDF");
const funzioneCaricamentoVolantinoWebPliant = createLazyLoader("funzioneCaricamentoVolantinoWebPliant");
const funzioneCaricamentoWebpliant = createLazyLoader("funzioneCaricamentoWebpliant");
const funzioneCaricamentoWebpliantLayout = createLazyLoader("funzioneCaricamentoWebpliantLayout");
const funzioneCaricamentoWorkspace = createLazyLoader("funzioneCaricamentoWorkspace");
const funzioneDettagliKit = createLazyLoader("funzioneDettagliKit");
const funzioneDettagliKitManualiInCorso = createLazyLoader("funzioneDettagliKitManualiInCorso");
const funzioneDettagliLavorazioniInCorso = createLazyLoader("funzioneDettagliLavorazioniInCorso");
const funzioneGestionePuntoVendita = createLazyLoader("funzioneGestionePuntoVendita");
const funzioneLavorazioniInCorso = createLazyLoader("funzioneLavorazioniInCorso");
const throw404 = () => {
  throw new Response(null, { status: 404 });
};

const routes: RouteObject[] = [
  // Public routes - no auth required (must be BEFORE the "/" layout)
  {
    path: "/display/files",
    lazy: async () => {
      const { default: DisplayPage } = await import("@/pages/DisplayPage");
      return { Component: DisplayPage };
    },
  },
  {
    path: "/auth/:context",
    lazy: async () => {
      const { default: Auth } = await import("../pages/Auth");
      return {
        Component: Auth,
        loader: funzioneCaricamentoAuth,
      };
    },
  },
  {
    path: "/auth-ad/:context",
    lazy: async () => {
      const { default: AuthAD } = await import("../pages/AuthAD");
      return {
        Component: AuthAD,
        loader: funzioneCaricamentoAuthAD,
      };
    },
  },
  // Menabo full-screen: fuori dal layout Echo.
  {
    path: "/promozioni/in-corso/dettagli/:idPromo/menabo",
    lazy: async () => {
      const { default: MenaboPromoPage } = await import("@/pages/MenaboPromo");
      return { Component: MenaboPromoPage };
    },
  },
  {
    path: "/promozioni/storico/dettagli/:idPromo/menabo",
    lazy: async () => {
      const { default: MenaboPromoPage } = await import("@/pages/MenaboPromo");
      return { Component: MenaboPromoPage };
    },
  },

  // INDEX: redirect con loader (niente <Navigate/>)
  {
    index: true,
    loader: () => redirect("/gdo/dashboard"),
  },

  // ROOT LAYOUT
  {
    path: "/",
    lazy: async () => {
      const { default: Layout } = await import("../themes/Echo");
      return {
        Component: Layout,
      };
    },
    children: [
      {
        path: "barcode-reader",
        lazy: async () => {
          const { default: BarCodeReaderComponent } = await import(
            "@/pages/BarCodeReader"
          );
          return { Component: BarCodeReaderComponent };
        },
      },
      {
        path: "gestione-permessi",
        lazy: async () => {
          const { default: GestionePermessi } = await import(
            "@/pages/GestionePermessi"
          );
          return { Component: GestionePermessi };
        },
      },
      {
        path: "gestione-hub",
        lazy: async () => {
          const { default: GestioneHub } = await import(
            "@/pages/GestioneHub"
          );
          return { Component: GestioneHub };
        },
      },
      {
        path: "promozioni/nuova",
        lazy: async () => {
          const { default: NuovaLavorazione } = await import(
            "@/pages/NuovaLavorazione"
          );
          return { Component: NuovaLavorazione };
        },
      },
      {
        path: "dashboard",
        loader: () => redirect("/gdo/dashboard"),
      },
      {
        path: "gdo/dashboard",
        loader: dashboard3Loader,
        lazy: async () => {
          const { default: Dashboard } = await import("../pages/Dashboard3");
          return { Component: Dashboard };
        },
      },
      {
        path: "marketing/dashboard",
        // loader: dashboard3Loader,
        lazy: async () => {
          const { default: Dashboard } = await import("../pages/DashboardMarketing");
          return { Component: Dashboard };
        },
      },
      {
        path: "category/dashboard",
        lazy: async () => {
          const { default: Dashboard } = await import("../pages/DashboardCategory");
          return { Component: Dashboard };
        },
      },
      {
        path: "superadmin/dashboard",
        loader: superadminDashboardLoader,
        lazy: async () => {
          const { default: SuperadminDashboard } = await import(
            "../pages/SuperadminDashboard"
          );
          return { Component: SuperadminDashboard };
        },
      },
      {
        path: "volantini",
        lazy: async () => {
          const { default: Volantini } = await import("../pages/Volantini");
          return {
            Component: Volantini,
            loader: funzioneCaricamentoVolantiniPDF,
          };
        },
      },
      {
        path: "volantini/tutti_i_volantini",
        lazy: async () => {
          const { default: TuttiIVolantini } = await import(
            "@/pages/TuttiIVolantini"
          );
          return {
            Component: TuttiIVolantini,
            loader: funzioneCaricamentoTuttiIFilePerKit,
          };
        },
      },
      {
        path: "storico-volantini",
        lazy: async () => {
          const { default: StoricoVolantini } = await import(
            "@/pages/StoricoVolantini"
          );
          return { Component: StoricoVolantini };
        },
      },
      // {
      //   path: "documentale",
      //   lazy: async () => {
      //     const { default: Documentale } = await import("../pages/Documentale");
      //     return { Component: Documentale };
      //   },
      // },
      {
        path: "materiali-attivi",
        lazy: async () => {
          const { default: MaterialiDocumentale } = await import("../pages/MaterialiDocumentale");
          return {
            Component: MaterialiDocumentale,
            loader: funzioneCaricamentoMaterialiAttivi,
          };
        },
      },
      {
        path: "materiali-in-corso",
        lazy: async () => {
          const { default: MaterialiDocumentale } = await import("../pages/MaterialiDocumentale");
          return {
            Component: MaterialiDocumentale,
            loader: funzioneCaricamentoMaterialiInCorso,
          };
        },
      },
      {
        path: "storico-materiali",
        lazy: async () => {
          const { default: MaterialiDocumentale } = await import("../pages/MaterialiDocumentale");
          return {
            Component: MaterialiDocumentale,
            loader: funzioneCaricamentoStoricoMateriali,
          };
        },
      },
      {
        path: "contenuti-digitali",
        lazy: async () => {
          const { default: ContenutiDigitali } = await import(
            "@/pages/ContenutiDigitali"
          );
          return { Component: ContenutiDigitali };
        },
      },
      {
        path: "aree-e-canali",
        lazy: async () => {
          const { default: AreeCanali } = await import("../pages/AreeCanali");
          return { Component: AreeCanali };
        },
      },
      {
        path: "punti-vendita",
        lazy: async () => {
          const { default: PuntiVendita } = await import("../pages/PuntiVendita");
          return { Component: PuntiVendita };
        },
      },
      {
        path: "punti-vendita/:id",
        lazy: async () => {
          const { default: DettaglioPuntoVendita } = await import(
            "../pages/GestionePuntoVendita"
          );
          return {
            Component: DettaglioPuntoVendita,
            loader: funzioneGestionePuntoVendita,
          };
        },
      },
      {
        path: "promozioni",
        lazy: async () => {
          const { default: Promozioni } = await import(
            "@/pages/Promozioni"
          );
          return {
            Component: Promozioni,
            // loader: funzioneLavorazioniInCorso,
          };
        },
      },
      {
        path: "report/tracciati",
        lazy: async () => {
          const { default: ReportTracciati } = await import(
            "@/pages/ReportTracciati"
          );
          return {
            Component: ReportTracciati,
          };
        },
      },
      {
        path: "report/tracciati/risultato",
        lazy: async () => {
          const { default: RisultatoConfrontoTracciati } = await import(
            "@/pages/RisultatoConfrontoTracciati"
          );
          return {
            Component: RisultatoConfrontoTracciati,
          };
        },
      },
      {
        path: "nuova-promozione",
        loader: () => redirect("/promozioni/nuova"),
      },
      {
        path: "promozioni-in-corso",
        loader: () => redirect("/promozioni/in-corso"),
      },
      {
        path: "storico-promozioni",
        loader: () => redirect("/promozioni/storico"),
      },
      {
        path: "promozioni/in-corso",
        lazy: async () => {
          const { default: LavorazioniInCorso } = await import(
            "@/pages/LavorazioniInCorso"
          );
          return {
            Component: LavorazioniInCorso,
            loader: funzioneLavorazioniInCorso,
          };
        },
      },
      {
        path: "promozioni/in-corso/dettagli",
        loader: () => redirect("/promozioni/in-corso"),
      },
      {
        path: "promozioni/in-corso/dettagli/:idPromo",
        lazy: async () => {
          const { default: DettagliLavorazioneInCorso } = await import(
            "@/pages/LavorazioniInCorso/DettagliLavorazioneInCorso"
          );
          return {
            Component: DettagliLavorazioneInCorso,
            loader: funzioneDettagliLavorazioniInCorso,
          };
        },
      },
      {
        path: "promozioni/in-corso/dettagli/:idPromo/report/:guidIdConfronto",
        lazy: async () => {
          const { default: RisultatoConfrontoTracciati } = await import(
            "@/pages/RisultatoConfrontoTracciati"
          );
          return {
            Component: RisultatoConfrontoTracciati,
          };
        },
      },
      {
        path: "promozioni/in-corso/dettagli/:idPromo/kits",
        lazy: async () => {
          const { default: DettagliLavorazioneInCorsoKitManuale } = await import(
            "@/pages/LavorazioniInCorso/DettagliKitManualiInCorso"
          );
          return {
            Component: DettagliLavorazioneInCorsoKitManuale,
            loader: funzioneDettagliKitManualiInCorso,
          };
        },
      },
      {
        path: "promozioni/in-corso/dettagli/:idPromo/kits/:idKit",
        lazy: async () => {
          const { default: DettaglioKit } = await import(
            "@/pages/DettaglioKit"
          );
          return {
            Component: DettaglioKit,
            loader: funzioneDettagliKit,
          };
        },
      },
      {
        path: "promozioni/in-corso/dettagli/:idPromo/materiali",
        lazy: async () => {
          const { default: MaterialiDocumentalePromo } = await import(
            "@/pages/MaterialiDocumentalePromo"
          );
          return {
            Component: MaterialiDocumentalePromo,
            loader: funzioneCaricamentoMaterialiPromo,
          };
        },
      },
      {
        path: "promozioni/in-corso/dettagli/:idPromo/pop/:idKit",
        lazy: async () => {
          const { default: KitPopDettaglio } = await import(
            "@/pages/KitPopDettaglio"
          );
          return {
            Component: KitPopDettaglio,
            loader: funzioneCaricamentoKitPop,
          };
        },
      },
      {
        path: "promozioni/in-corso/dettagli/:idPromo/kits/:idKit/dettagli-pubblicazione",
        lazy: async () => {
          const { default: DettaglioPubblicazioneKit } = await import(
            "@/pages/DettaglioPubblicazioneKit"
          );
          return {
            Component: DettaglioPubblicazioneKit,
            loader: funzioneDettagliKit,
          };
        },
      },
      {
        path: "promozioni/in-corso/dettagli/:idPromo/anteprima-tracciato/:idTracciato",
        lazy: async () => {
          const { default: DettaglioAnteprimaTracciato } = await import(
            "@/pages/DettaglioAnteprimaTracciato"
          );
          return {
            Component: DettaglioAnteprimaTracciato,
            loader: funzioneDettagliLavorazioniInCorso,
          };
        },
      },
      {
        path: "promozioni/storico",
        lazy: async () => {
          const { default: StoricoLavorazioni } = await import(
            "@/pages/StoricoLavorazioni"
          );
          return {
            Component: StoricoLavorazioni,
            loader: funzioneCaricamentoStoricoLavorazioni,
          };
        },
      },
      {
        path: "promozioni/storico/dettagli/:idPromo/anteprima-tracciato/:idTracciato",
        lazy: async () => {
          const { default: DettaglioAnteprimaTracciato } = await import(
            "@/pages/DettaglioAnteprimaTracciato"
          );
          return {
            Component: DettaglioAnteprimaTracciato,
            loader: funzioneDettagliLavorazioniInCorso,
          };
        },
      },
      {
        path: "promozioni/storico/dettagli",
        loader: () => redirect("/promozioni/storico"),
      },
      {
        path: "promozioni/storico/dettagli/:idPromo",
        lazy: async () => {
          const { default: DettagliLavorazioneInCorso } = await import(
            "@/pages/LavorazioniInCorso/DettagliLavorazioneInCorso"
          );
          return {
            Component: DettagliLavorazioneInCorso,
            loader: funzioneDettagliLavorazioniInCorso,
          };
        },
      },
      {
        path: "promozioni/storico/dettagli/:idPromo/kits",
        lazy: async () => {
          const { default: DettagliLavorazioneInCorsoKitManuale } = await import(
            "@/pages/LavorazioniInCorso/DettagliKitManualiInCorso"
          );
          return {
            Component: DettagliLavorazioneInCorsoKitManuale,
            loader: funzioneDettagliKitManualiInCorso,
          };
        },
      },
      {
        path: "promozioni/storico/dettagli/:idPromo/kits/:idKit",
        lazy: async () => {
          const { default: DettaglioKit } = await import(
            "@/pages/DettaglioKit"
          );
          return {
            Component: DettaglioKit,
            loader: funzioneDettagliKit,
          };
        },
      },
      {
        path: "promozioni/storico/dettagli/:idPromo/materiali",
        lazy: async () => {
          const { default: MaterialiDocumentalePromo } = await import(
            "@/pages/MaterialiDocumentalePromo"
          );
          return {
            Component: MaterialiDocumentalePromo,
            loader: funzioneCaricamentoMaterialiPromo,
          };
        },
      },
      {
        path: "impostazioni-tipografia",
        lazy: async () => {
          const { default: ImpostazioniTipografia } = await import(
            "@/pages/ImpostazioniTipografia"
          );
          return {
            Component: ImpostazioniTipografia,
            loader: funzioneCaricamentoImpostazioniTipografia,
          };
        },
      },
      {
        path: "impostazioni-di-produzione",
        lazy: async () => {
          const { default: ImpostazioniDiProduzione } = await import(
            "@/pages/ImpostazioniDiProduzione"
          );
          return { Component: ImpostazioniDiProduzione };
        },
      },
      {
        path: "impostazioni-di-produzione/creazione-kit-automatico",
        lazy: async () => {
          const { default: PaginaCreazioneKitDesignAutomatici } = await import(
            "@/pages/PaginaCreazioneKitDesignAutomatici"
          );
          return { Component: PaginaCreazioneKitDesignAutomatici };
        },
      },
      {
        path: "impostazioni-di-produzione/creazione-kit-manuale",
        lazy: async () => {
          const { default: PaginaCreazioneKitDesignManuali } = await import(
            "@/pages/PaginaCreazioneKitDesignManuali"
          );
          return { Component: PaginaCreazioneKitDesignManuali };
        },
      },
      {
        path: "impostazioni-di-produzione/dettagli",
        lazy: async () => {
          const { default: DettagliCombinazioneProduzione } = await import(
            "@/pages/DettagliCombinazioniProduzione"
          );
          return { Component: DettagliCombinazioneProduzione };
        },
      },
      {
        path: "impostazioni-di-produzione/dettagli-combinazione-produzione",
        lazy: async () => {
          const { default: PaginaDettaglioCombinazione } = await import(
            "@/pages/PaginaDettaglioCombinazione"
          );
          return { Component: PaginaDettaglioCombinazione };
        },
      },
      // {
      //   path: "gestione-pagine-singular",
      //   lazy: async () => {
      //     const { default: GestionePagineSingular } = await import(
      //       "@/pages/GestionePagineSingular"
      //     );
      //     return {
      //       Component: GestionePagineSingular,
      //       loader: funzioneCaricamentoGestionePagineSingular,
      //     };
      //   },
      // },
      {
        path: "webliant/impostazioni-webpliant",
        lazy: async () => {
          const { default: ImpostazioniWebpliant } = await import(
            "@/pages/ImpostazioniWebpliant"
          );
          return {
            Component: ImpostazioniWebpliant,
            loader: funzioneCaricamentoWorkspace,
          };
        },
      },
      {
        path: "webliant/impostazioni-webpliant/configurazione-webpliant",
        lazy: async () => {
          const { default: ConfigurazioneWebpliant } = await import(
            "@/pages/ConfigurazioneWebpliant"
          );
          return {
            Component: ConfigurazioneWebpliant,
            loader: funzioneCaricamentoConfigWebpliant,
          };
        },
      },
      {
        path: "webliant/webpliant-disponibili",
        lazy: async () => {
          const { default: WebPliantDisponibili } = await import(
            "@/pages/WebPliantDisponibili"
          );
          return {
            Component: WebPliantDisponibili,
            loader: funzioneCaricamentoWebpliant,
          };
        },
      },
      {
        path: "gestione-utenti",
        lazy: async () => {
          const { default: GestioneUtenti } = await import("@/pages/GestioneUtenti");
          return { Component: GestioneUtenti };
        },
      },

      // GESTIONE RICETTE (pagine indipendenti)
      {
        path: "gestione-ricette",
        lazy: async () => {
          const { default: GestioneRicette } = await import(
            "@/pages/GestioneGDOAI/GestioneRicette"
          );
          return { Component: GestioneRicette };
        },
      },
      {
        path: "gestione-ricette/modifica",
        lazy: async () => {
          const { default: ModificaRicetta } = await import(
            "@/pages/GestioneGDOAI/ModificaRicette"
          );
          return {
            Component: ModificaRicetta,
            loader: funzioneCaricamentoModificaRicetta,
          };
        },
      },

      // GESTIONE APPROFONDIMENTO VINI (pagine indipendenti)
      {
        path: "gestione-approfondimento-vini",
        lazy: async () => {
          const { default: GestioneApprofondimentoVini } = await import(
            "@/pages/GestioneGDOAI/GestioneApprofondimentoVini"
          );
          return { Component: GestioneApprofondimentoVini };
        },
      },
      {
        path: "gestione-approfondimento-vini/modifica",
        lazy: async () => {
          const { default: ModificaApprofondimentoVini } = await import(
            "@/pages/GestioneGDOAI/ModificaApprofondimentoVini"
          );
          return { Component: ModificaApprofondimentoVini };
        },
      },

      // New Unified ODS Routes
      {
        path: "nuovo-ods",
        lazy: async () => {
          const { default: OrdiniDiStampaUnified } = await import("@/pages/OrdiniDiStampaUnified");
          return {
            Component: OrdiniDiStampaUnified,
            loader: funzioneCaricamentoNuovoODS,
          };
        },
      },
      {
        path: "ods-in-corso",
        lazy: async () => {
          const { default: OrdiniDiStampaUnified } = await import("@/pages/OrdiniDiStampaUnified");
          return {
            Component: OrdiniDiStampaUnified,
            loader: funzioneCaricamentoODSInCorso,
          };
        },
      },
      {
        path: "ods-completati",
        lazy: async () => {
          const { default: OrdiniDiStampaUnified } = await import("@/pages/OrdiniDiStampaUnified");
          return {
            Component: OrdiniDiStampaUnified,
            loader: funzioneCaricamentoODSCompletati,
          };
        },
      },
      {
        path: "ods-in-corso/revisione",
        lazy: async () => {
          const { default: RevisioneOrdiniDiStampaDetail } = await import(
            "@/pages/RevisioneOrdiniDiStampaDetail"
          );
          return {
            Component: RevisioneOrdiniDiStampaDetail,
            loader: funzioneCaricamentoDettagliOrdiniDiStampa,
          };
        },
      },
      {
        path: "ods-in-corso/kit-dettagli",
        lazy: async () => {
          const { default: DettagliKitOrdiniDiStampa } = await import(
            "@/pages/DettagliKitOrdiniDiStampa"
          );
          return {
            Component: DettagliKitOrdiniDiStampa,
            loader: funzioneCaricamentoTuttiIfFilesOrdiniDiStampa,
          };
        },
      },
      {
        path: "ods-completati/dettagli",
        lazy: async () => {
          const { default: RevisioneOrdiniDiStampaDetail } = await import(
            "@/pages/RevisioneOrdiniDiStampaDetail"
          );
          return {
            Component: RevisioneOrdiniDiStampaDetail,
            loader: funzioneCaricamentoDettagliFineLavorazione,
          };
        },
      },
      {
        path: "ods-completati/kit-dettagli",
        lazy: async () => {
          const { default: DettagliKitOrdiniDiStampa } = await import(
            "@/pages/DettagliKitOrdiniDiStampa"
          );
          return {
            Component: DettagliKitOrdiniDiStampa,
            loader: funzioneCaricamentoTuttiIfFilesOrdiniDiStampa,
          };
        },
      },
      // Deprecated ODS Routes (redirect to new routes)
      {
        path: "ordini-di-stampa",
        loader: () => redirect("/ods-in-corso"),
      },
      {
        path: "ordini-di-stampa/revisione",
        loader: ({ request }) => {
          const url = new URL(request.url);
          const id = url.searchParams.get("id");
          return redirect(`/ods-in-corso/revisione${id ? `?id=${id}` : ''}`);
        },
      },
      {
        path: "ordini-di-stampa/revisione/dettagli",
        loader: ({ request }) => {
          const url = new URL(request.url);
          const id = url.searchParams.get("id");
          return redirect(`/ods-in-corso/kit-dettagli${id ? `?id=${id}` : ''}`);
        },
      },
      {
        path: "ordini-di-stampa/dettagli",
        loader: ({ request }) => {
          const url = new URL(request.url);
          const id = url.searchParams.get("id");
          return redirect(`/ods-completati/dettagli${id ? `?id=${id}` : ''}`);
        },
      },
      {
        path: "profilo-utente",
        lazy: async () => {
          const { default: Settings } = await import("@/pages/ImpostazioniUtente");
          return { Component: Settings };
        },
      },
      {
        path: "gestione-webhook",
        lazy: async () => {
          const { default: GestioneWebhook } = await import("@/pages/GestioneWebhook");
          return { Component: GestioneWebhook };
        },
      },
      // GESTIONE API - Pagine standalone
      {
        path: "gestione-api/statistiche",
        lazy: async () => {
          const { default: StatistichePage } = await import("@/pages/Api/Statistiche");
          return { Component: StatistichePage };
        },
      },
      {
        path: "gestione-api/test",
        lazy: async () => {
          const { default: TestApiPage } = await import("@/pages/Api/TestApi");
          return {
            Component: TestApiPage,
            loader: funzioneCaricamentoGestioneApi,
          };
        },
      },
      {
        path: "gestione-api/keys",
        lazy: async () => {
          const { default: ApiKeysPage } = await import("@/pages/Api/Keys");
          return {
            Component: ApiKeysPage,
            loader: funzioneCaricamentoGestioneApi,
          };
        },
      },
      {
        path: "gestione-api/plugin",
        lazy: async () => {
          const { default: PluginPage } = await import("@/pages/Api/Plugin");
          return {
            Component: PluginPage,
            loader: funzioneCaricamentoGestioneApi,
          };
        },
      },
      // DOCUMENTAZIONE - Hub e pagine
      {
        path: "documentazione",
        lazy: async () => {
          const { default: DocumentazioneHubPage } = await import("@/pages/Documentazione");
          return { Component: DocumentazioneHubPage };
        },
      },
      {
        path: "documentazione/panoramica",
        lazy: async () => {
          const { default: DocumentazioneOverviewPage } = await import("@/pages/Documentazione/Overview");
          return { Component: DocumentazioneOverviewPage };
        },
      },
      {
        path: "documentazione/guida-rapida",
        lazy: async () => {
          const { default: DocumentazioneGettingStartedPage } = await import("@/pages/Documentazione/GettingStarted");
          return {
            Component: DocumentazioneGettingStartedPage,
            loader: funzioneCaricamentoGestioneApi,
          };
        },
      },
      {
        path: "documentazione/api",
        lazy: async () => {
          const { default: DocumentazioneApiPage } = await import("@/pages/Documentazione/Api");
          return {
            Component: DocumentazioneApiPage,
            loader: funzioneCaricamentoGestioneApi,
          };
        },
      },
      {
        path: "documentazione/plugin",
        lazy: async () => {
          const { default: DocumentazionePluginPage } = await import("@/pages/Documentazione/Plugin");
          return { Component: DocumentazionePluginPage };
        },
      },
      {
        path: "documentazione/filter-templates",
        lazy: async () => {
          const { default: DocumentazioneFilterTemplatesPage } = await import("@/pages/Documentazione/FilterTemplates");
          return { Component: DocumentazioneFilterTemplatesPage };
        },
      },
      {
        path: "documentazione/statistiche",
        lazy: async () => {
          const { default: DocumentazioneStatisticsPage } = await import("@/pages/Documentazione/Statistics");
          return { Component: DocumentazioneStatisticsPage };
        },
      },
      {
        path: "competitor-analyzer",
        lazy: async () => {
          const { default: RedirectPaginaEsterna } = await import("@/pages/RedirectPaginaEsterna");
          return { Component: RedirectPaginaEsterna };
        },
      },
      {
        path: "whatsapp/invio-campagna-whatsapp",
        lazy: async () => {
          const { default: InvioCampagnaWhatsapp } = await import(
            "@/pages/InvioCampagnaWhatsapp"
          );
          return {
            Component: InvioCampagnaWhatsapp,
            loader: funzioneCaricamentoInvioCampagnaWhatsapp,
            shouldRevalidate: ({
              currentUrl,
              nextUrl,
            }: ShouldRevalidateFunctionArgs) => {
              const ignoreParams = new Set(["step"]);

              const cleanSearch = (url: URL) => {
                const sp = new URLSearchParams(url.search);
                ignoreParams.forEach((p) => sp.delete(p));
                return sp.toString();
              };

              return cleanSearch(currentUrl) !== cleanSearch(nextUrl);
            },
          };
        },

      },
      {
        path: "whatsapp/campagne-whatsapp",
        lazy: async () => {
          const { default: OutboxWhatsapp } = await import(
            "@/pages/OutboxWhatsapp"
          );
          return { Component: OutboxWhatsapp };
        },
      },
      {
        path: "whatsapp/business-chat",
        lazy: async () => {
          const { default: BusinessChatWhatsapp } = await import(
            "@/pages/BusinessChatWhatsapp"
          );
          return { Component: BusinessChatWhatsapp };
        },
      },
      {
        path: "whatsapp/gestione-whatsapp-superadmin",
        lazy: async () => {
          const { default: GestioneWhatsappSuperAdmin } = await import(
            "@/pages/GestioneWhatsappSuperAdmin"
          );
          return {
            Component: GestioneWhatsappSuperAdmin,
            loader: funzioneCaricamentoGestioneWhatsappSuperAdmin,
          };
        },
      },
      {
        path: "whatsapp/gestione-whatsapp-superadmin/setup",
        lazy: async () => {
          const { default: GestioneSetupWhatsappSuperAdmin } = await import(
            "@/pages/GestioneSetupWhatsappSuperAdmin"
          );
          return {
            Component: GestioneSetupWhatsappSuperAdmin,
            loader: funzioneCaricamentoGestioneSetupWhatsappSuperAdmin,
          };
        },
      },
      {
        path: "whatsapp/gestione-whatsapp-superadmin/templates",
        lazy: async () => {
          const { default: GestioneTemplatesWhatsappSuperAdmin } = await import(
            "@/pages/GestioneTemplatesWhatsappSuperAdmin"
          );
          return {
            Component: GestioneTemplatesWhatsappSuperAdmin,
            loader: funzioneCaricamentoGestioneTemplatesWhatsappAdmin,
          };
        },
      },
      {
        path: "whatsapp/gestione-whatsapp-superadmin/templates/nuova-versione",
        lazy: async () => {
          const { default: NuovaVersioneTemplatesWhatsappSuperAdmin } = await import(
            "@/pages/NuovaVersioneTemplatesWhatsappSuperAdmin"
          );
          return {
            Component: NuovaVersioneTemplatesWhatsappSuperAdmin,
            loader: funzioneCaricamentoDettagliTemplateWhatsappAdmin,
          };
        },
      },
      {
        path: "whatsapp/gestione-whatsapp-superadmin/templates/presets",
        lazy: async () => {
          const { default: GestionePresetsWhatsappSuperAdmin } = await import(
            "@/pages/GestionePresetsWhatsappSuperAdmin"
          );
          return {
            Component: GestionePresetsWhatsappSuperAdmin,
            loader: funzioneCaricamentoDettagliTemplateWhatsappAdmin,
          };
        },
      },
      {
        path: "whatsapp/gestione-whatsapp-superadmin/templates/crea",
        lazy: async () => {
          const { default: CreaTemplatesWhatsappSuperAdmin } = await import(
            "@/pages/CreaTemplatesWhatsappSuperAdmin"
          );
          return { Component: CreaTemplatesWhatsappSuperAdmin };
        },
      },
      {
        path: "gestione-whatsapp-admin",
        lazy: async () => {
          const { default: GestioneWhatsappAdmin } = await import(
            "@/pages/GestioneWhatsappAdminGDO"
          );
          return {
            Component: GestioneWhatsappAdmin,
            loader: funzioneCaricamentoGestioneTemplatesWhatsappAdmin,
          };
        },
      },

      // Catch-all della branch root
      {
        path: "*",
        loader: throw404,
        errorElement: <NotFoundPage />,
      },
    ],
  },

  // NODO /webpliant con error boundary e catch-all locale
  {
    path: "/webpliant",
    lazy: async () => {
      const { default: WebpliantLayout } = await import(
        "@/pages/WebpliantLayout/index"
      );
      const { LoadingWebpliant } = await import(
        "@/pages/WebpliantLayout/LoadingWebpliant"
      );
      return {
        Component: () => <WebpliantLayout />,
        loader: funzioneCaricamentoWebpliantLayout,
        HydrateFallback: LoadingWebpliant,
      };
    },
    children: [
      {
        path: "volantino",
        lazy: async () => {
          const { default: WebPliant } = await import("@/pages/WebPliant");
          return {
            Component: WebPliant,
            loader: funzioneCaricamentoVolantinoWebPliant,
          };
        },
      },
      {
        path: "barcode-reader",
        lazy: async () => {
          const { default: BarCodeReaderComponent } = await import(
            "@/pages/BarCodeReader"
          );
          return { Component: BarCodeReaderComponent };
        },
      },
      {
        path: "volantino/ricetta",
        lazy: async () => {
          const { default: Ricette } = await import("@/pages/WebPliant/Ricette");
          return {
            Component: Ricette,
            loader: funzioneCaricamentoRicetta,
          };
        },
      },
      {
        path: "wishlist",
        lazy: async () => {
          const { default: WishlistWebpliant } = await import(
            "@/pages/WishlistWebpliant"
          );
          return { Component: WishlistWebpliant };
        },
      },
      {
        path: "ricerca",
        lazy: async () => {
          const { default: WebpliantRicerca } = await import(
            "@/pages/WebpliantRicerca"
          );
          return { Component: WebpliantRicerca };
        },
      },
      {
        path: "*",
        loader: throw404,
        errorElement: <NotFoundPage />,
      },

    ],
  },

  // Altre top-level routes
  {
    path: "webliant/impostazioni-webpliant/workspace",
    lazy: async () => {
      const { default: CreazioneWebPliant } = await import(
        "@/pages/CreazioneWebPliant"
      );
      return {
        Component: CreazioneWebPliant,
        loader: funzioneCaricamentoEditWorkspace,
      };
    },
  },
  {
    path: "/landing-page",
    lazy: async () => {
      const { default: LandingPage } = await import("@/pages/LandingPage");
      return { Component: LandingPage };
    },
  },
  {
    path: "login",
    lazy: async () => {
      const { default: HubLogin } = await import("@/pages/HubLogin");
      return { Component: HubLogin };
    },
  },
  {
    path: "hub",
    lazy: async () => {
      const { default: ServicesDashboard } = await import("@/pages/ServicesDashboard");
      return { Component: ServicesDashboard };
    },
  },
  {
    path: "recupero-password",
    lazy: async () => {
      const { default: RecuperoPassword } = await import("@/pages/RecuperoPassword");
      return { Component: RecuperoPassword };
    },
  },
  {
    path: "reset-password",
    lazy: async () => {
      const { default: ResetPassword } = await import("@/pages/ResetPassword");
      return { Component: ResetPassword };
    },
  },
  {
    path: "register",
    lazy: async () => {
      const { default: Register } = await import("@/pages/Register");
      return { Component: Register };
    },
  },
  {
    path: "whatsapp/confirm-opt-in/:ctx",
    lazy: async () => {
      const { default: ConfirmOptIn } = await import(
        "@/pages/ConfirmOptInWhatsapp"
      );
      return { Component: ConfirmOptIn, loader: async () => null };
    }
  },
  // {
  //   path: "*",
  //   loader: throw404,
  //   errorElement: <NotFoundPage />,
  // },
];

// routes = addErrorElementToRoutes(routes);

export default routes;
