import styleWp from "@/assets/css/webpliant/stylewp.module.scss";
import { useDatiWebpliantPagina, usePosizioneWebpliant } from '@/ssr/webpliant';
import clsx from 'clsx';
import dayjs from 'dayjs';
import React, { memo, useEffect, useMemo, useState } from 'react';
import { ServerCall } from '../../../../lib/server_call';
import { Config, DataFields, PageLayoutItem, ReferenzeIstanta } from '../../../../lib/types';
import BoxRef from '../BoxRef';
import { ConGestoreParametriWebpliant } from '../gestoreParametri';

interface GridReferenzeProps {
    item: PageLayoutItem;
    config: Config;
    refsWishlist?: DataFields[] | null;
}

// Prop costanti delle card: un oggetto nuovo a ogni render rendeva inutile il memo di BoxRef
const OPZIONI_CARD = {
    removeBackground: true,
    removeBorder: true,
};

const GridReferenze: React.FC<GridReferenzeProps> = memo(function GridReferenze({
    item,
    config,
    refsWishlist = []
}) {
    const location = usePosizioneWebpliant();
    const datiSsr = useDatiWebpliantPagina();
    const iniziale = datiSsr?.blocchi[item.id];
    const [referenze, setReferenze] = useState<ReferenzeIstanta[]>(iniziale?.referenze ?? []);
    const [isLoading, setIsLoading] = useState(true);

    const url = new URL(location.pathname + location.search, 'http://ssr.local');
    const idCanale = url.searchParams.get('idCanale');
    const idArea = url.searchParams.get('idArea');
    const idPV = url.searchParams.get('idPV');
    const idWorkspace = url.searchParams.get('id');
    const date = url.searchParams.get("date") || datiSsr?.giorno || dayjs().format("YYYY-MM-DD");

    useEffect(() => {
        if (iniziale) {
            setReferenze(iniziale.referenze);
            return;
        }
        const fetchReferenze = async () => {
            const response = await ServerCall.post<ReferenzeIstanta[]>('/get_filtered_referenze', {
                idWorkspace,
                idArea,
                idCanale,
                idPV,
                dataSelezionata: date,
                item,
            });
            if (response) {
                setReferenze(response);
            }
        };

        fetchReferenze();
    }, [item.content?.filters, item.content?.filtriContesto, idWorkspace, idArea, idCanale, idPV, date, iniziale]);

    // Un solo passaggio sulla wishlist invece di uno per card
    const codiciInWishlist = useMemo(
        () => new Set((refsWishlist ?? []).map((r) => r.codice_referenza)),
        [refsWishlist]
    );

    return (
        <ConGestoreParametriWebpliant>
        <div
            className={clsx(
                "grid xl:grid-cols-4 lg:grid-cols-3 md:grid-cols-2 p-14 xl:px-40",
                styleWp["wp-grid-referenze"]
            )}
        >
            {referenze.map((ref, idx) => {
                const refCode = ref.dataFields?.codice_referenza?.toString() || '';
                const isInWishlist = codiciInWishlist.has(refCode);

                return (
                    <BoxRef
                        className={clsx(styleWp["wp-border"], "p-4")}
                        key={refCode || idx}
                        referenza={ref}
                        config={config}
                        forzaturaBox={item.content?.options?.forzaturaBox}
                        style={item.content?.customStyles}
                        isInWishlist={isInWishlist}
                        options={OPZIONI_CARD}
                    />
                );
            })}
        </div>
        </ConGestoreParametriWebpliant>
    );
});

export default GridReferenze;
