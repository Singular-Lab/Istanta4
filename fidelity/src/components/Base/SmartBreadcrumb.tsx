import { usePromoNames } from '@/hooks/usePromoName';
import { isUUID } from '@/utils/validation';
import React from 'react';
import { useLocation } from 'react-router-dom';
import Breadcrumb from './Breadcrumb';

interface BreadcrumbItem {
  path: string;
  label: string;
  isLast: boolean;
}

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

  // Estrai gli ID delle promo dal pathname
  const promoIds = pathnames.filter((value) => isUUID(value));
  // Usa il hook personalizzato per recuperare i nomi delle promo
  const promoNamesQuery = usePromoNames(promoIds);

  // Funzione per formattare il breadcrumb con nomi delle promo
  const getBreadcrumbItems = (): BreadcrumbItem[] => {
    const items: BreadcrumbItem[] = [];
    let currentPath = '';

    pathnames.forEach((value, index) => {
      const isLast = index === pathnames.length - 1;

      if (isUUID(value)) {
        // È un ID, cerca il nome della promo
        const promoName = promoNamesQuery.data?.[value];
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
            label: promoNamesQuery.isLoading ? "Caricamento..." : `${value.substring(0, 8)}...`,
            isLast
          });
        }
      } else {
        // Non è un ID, formatta normalmente
        currentPath += `/${value}`;
        const formattedValue = value.charAt(0).toUpperCase() + value.slice(1).replace(/[-_]/g, ' ');
        items.push({
          path: currentPath,
          label: formattedValue,
          isLast
        });
      }
    });

    return items;
  };

  const breadcrumbItems = getBreadcrumbItems();

  return (
    <Breadcrumb light={light} small={small} className={className}>
      <Breadcrumb.Link breadcrumbKey={"0"} to={startPage}>FP</Breadcrumb.Link>
      <>
        {breadcrumbItems.map((item, index) => {
          return item.isLast ? (
            <Breadcrumb.Link key={index} breadcrumbKey={index + 1} to={item.path} active={true}>
              {item.label}
            </Breadcrumb.Link>
          ) : (
            <Breadcrumb.Link key={index} breadcrumbKey={index + 1} to={item.path}>
              {item.label}
            </Breadcrumb.Link>
          );
        })}
      </>
    </Breadcrumb>
  );
};

export default SmartBreadcrumb;
