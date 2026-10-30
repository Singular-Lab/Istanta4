import { useEtichettePercorsoPuntoVendita } from '@/components/PuntiVendita/breadcrumb';
import { idPromoDalPercorso, useNomePromo } from '@/hooks/usePromoName';
import { isUUID } from '@/utils/validation';
import React from 'react';
import { useLocation } from 'react-router-dom';
import Breadcrumb from './Breadcrumb';

interface BreadcrumbItem {
  path: string;
  label: string;
  isLast: boolean;
}

// Parole dei segmenti con una grafia propria: le sigle in maiuscolo, i marchi come si scrivono
const PAROLE_SPECIALI: Record<string, string> = {
  api: "API",
  gdo: "GDO",
  ods: "ODS",
  pop: "POP",
  whatsapp: "WhatsApp",
};

/** "ods-in-corso" → "ODS in corso", "pop" → "POP", "punti-vendita" → "Punti vendita". */
const etichettaSegmento = (segmento: string) => {
  const parole = segmento.split(/[-_]/).filter(Boolean).map(parola => PAROLE_SPECIALI[parola.toLowerCase()] ?? parola);
  const testo = parole.join(" ");
  return testo.charAt(0).toUpperCase() + testo.slice(1);
};

interface SmartBreadcrumbProps {
  light?: boolean;
  small?: boolean;
  className?: string;
  startPage?: string | undefined
}

const SmartBreadcrumb: React.FC<SmartBreadcrumbProps> = ({
  light = false,
  small = false,
  className = "",
  startPage = undefined
}) => {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);

  // Solo il segmento che nelle rotte è l'id della promo: kit, tracciati e confronti non si chiedono a /promo/:id
  const idPromo = idPromoDalPercorso(pathnames);
  const nomePromo = useNomePromo(idPromo);
  // Punti vendita: il nome al posto dell'id, la promo del volantino e il nome della referenza
  const percorsoPuntoVendita = useEtichettePercorsoPuntoVendita(pathnames);

  // Funzione per formattare il breadcrumb con nomi delle promo
  const getBreadcrumbItems = (): BreadcrumbItem[] => {
    const items: BreadcrumbItem[] = [];
    let currentPath = '';

    pathnames.forEach((value, index) => {
      const isLast = index === pathnames.length - 1;

      // Segmenti che non sono pagine (per esempio "volantini" fra il punto vendita e un suo volantino)
      if (percorsoPuntoVendita.saltati.has(index)) {
        currentPath += `/${value}`;
        return;
      }
      const etichettaPuntoVendita = percorsoPuntoVendita.etichette.get(index);
      if (etichettaPuntoVendita) {
        currentPath += `/${value}`;
        items.push({ path: currentPath, label: etichettaPuntoVendita, isLast });
        return;
      }

      if (isUUID(value)) {
        // È un ID: se è la promo se ne mostra il nome
        const promoName = value === idPromo ? nomePromo.nome : null;
        if (promoName) {
          currentPath += `/${value}`;
          items.push({
            path: currentPath,
            label: promoName,
            isLast
          });
        } else {
          // Se non abbiamo ancora il nome, mostra l'ID abbreviato
          currentPath += `/${value}`;
          items.push({
            path: currentPath,
            label: value === idPromo && nomePromo.isLoading ? "Caricamento..." : `${value.substring(0, 8)}...`,
            isLast
          });
        }
      } else {
        // Non è un ID, formatta normalmente
        currentPath += `/${value}`;
        items.push({
          path: currentPath,
          label: etichettaSegmento(value),
          isLast
        });
      }
    });

    return items;
  };

  const breadcrumbItems = getBreadcrumbItems();

  return (
    // Mai oltre il suo spazio nella barra. Da sm una riga sola: ogni voce ha una larghezza massima e
    // si tronca con i puntini (il nome intero nel title), l'ultima prende lo spazio che resta e cede
    // per ultima. Su mobile restano FP e la pagina corrente, che va al più su due righe.
    <Breadcrumb light={light} small={small} className={`min-w-0 overflow-hidden ${className}`}>
      <Breadcrumb.Link breadcrumbKey={"0"} to={startPage} className="flex-none">FP</Breadcrumb.Link>
      <>
        {breadcrumbItems.map((item, index) => {
          return item.isLast ? (
            <Breadcrumb.Link key={index} breadcrumbKey={index + 1} to={item.path} active={true} className="min-w-0 max-sm:ml-4">
              <span className="block max-sm:line-clamp-2 max-sm:[overflow-wrap:anywhere] sm:truncate" title={item.label}>
                {item.label}
              </span>
            </Breadcrumb.Link>
          ) : (
            <Breadcrumb.Link key={index} breadcrumbKey={index + 1} to={item.path} className="min-w-[2.5rem] max-w-[11rem] shrink-[8] max-sm:hidden">
              <span className="block truncate" title={item.label}>
                {item.label}
              </span>
            </Breadcrumb.Link>
          );
        })}
      </>
    </Breadcrumb>
  );
};

export default SmartBreadcrumb;
