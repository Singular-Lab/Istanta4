import IstantaLogo from "@/assets/images/logo_ext.png";
import type { ReactNode } from "react";
import HubBackground from "./HubBackground";

interface CardAccessoProps {
  /** Titolo della schermata (h1); se manca lo scrive chi usa la card. */
  titolo?: string;
  /** Riga sotto il titolo. */
  descrizione?: ReactNode;
  children: ReactNode;
}

/**
 * Guscio comune delle schermate di accesso (login, recupero e reimpostazione della password):
 * sfondo animato e card in vetro con il logo, il titolo e la firma in fondo.
 */
const CardAccesso: React.FC<CardAccessoProps> = ({ titolo, descrizione, children }) => (
  <>
    <HubBackground />
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
      <div className="w-full max-w-md">
        {/* Card in vetro: sullo sfondo a gradiente l'ombra standard della card non la stacca */}
        <div className="rounded-card border border-white/30 bg-white/75 p-8 shadow-2xl backdrop-blur-xl sm:p-10">
          <div className="mb-6 flex justify-center">
            <img src={IstantaLogo} alt="Istanta 2 GDO Suite" className="h-12 sm:h-14" />
          </div>
          {titolo && (
            <div className="mb-6 text-center">
              <h1 className="title-page text-slate-800">{titolo}</h1>
              {descrizione && <p className="mt-1 text-sm text-slate-500">{descrizione}</p>}
            </div>
          )}
          {children}
          <div className="mt-8 text-center text-xs text-slate-400">Powered by Singular Lab</div>
        </div>
      </div>
    </div>
  </>
);

export default CardAccesso;
