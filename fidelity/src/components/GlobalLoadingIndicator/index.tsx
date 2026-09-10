import { useEffect } from 'react';
import { useLocation, useNavigation } from 'react-router-dom';
import { useLoading } from '@/context/LoadingContext';
import { useIsFetching, useIsMutating } from '@tanstack/react-query';
import React from 'react';

const GlobalLoadingIndicator: React.FC = () => {
    const { showLoader, hideLoader } = useLoading();
    const navigation = useNavigation();
    const location = useLocation();
    const isMutating = useIsMutating();

    const isWebpliantRoute = location.pathname.startsWith('/webpliant');

    const isVisible = navigation.state === 'loading' || navigation.state === 'submitting';

    useEffect(() => {
        if (isWebpliantRoute) {
            hideLoader();
            return;
        }

        if (isVisible) {
            showLoader('Caricamento pagina...');
        } else {
            hideLoader();
        }
    }, [isVisible, isWebpliantRoute, showLoader, hideLoader]);

    if (!isVisible) return null;

    return null;
};

export default GlobalLoadingIndicator; 