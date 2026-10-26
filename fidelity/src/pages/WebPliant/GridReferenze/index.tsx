import React, { memo, useEffect, useState } from 'react';
import clsx from 'clsx';
import { Config, PageLayoutItem, ReferenzeIstanta, DataFields } from '../../../../lib/types';
import BoxRef from '../BoxRef';
import styleWp from "@/assets/css/webpliant/stylewp.module.scss";
import { ServerCall } from '../../../../lib/server_call';
import dayjs from 'dayjs';

interface GridReferenzeProps {
    item: PageLayoutItem;
    config: Config;
    refsWishlist?: DataFields[] | null;
}

const GridReferenze: React.FC<GridReferenzeProps> = memo(function GridReferenze({
    item,
    config,
    refsWishlist = []
}) {
    const [referenze, setReferenze] = useState<ReferenzeIstanta[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
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
    }, [item.content?.filters, item.content?.filtriContesto]);

    const url = new URL(window.location.href);
    const idCanale = url.searchParams.get('idCanale');
    const idArea = url.searchParams.get('idArea');
    const idPV = url.searchParams.get('idPV');
    const idWorkspace = url.searchParams.get('id');
    const date = url.searchParams.get("date") || dayjs().format("YYYY-MM-DD");


    return (
        <div
            className={clsx(
                "grid xl:grid-cols-4 lg:grid-cols-3 md:grid-cols-2 p-14 xl:px-40",
                styleWp["wp-grid-referenze"]
            )}
        >
            {referenze.map((ref, idx) => {
                const refCode = ref.dataFields?.codice_referenza?.toString() || '';
                const isInWishlist = refsWishlist?.some(
                    (r) => r.codice_referenza === refCode
                );

                return (
                    <BoxRef
                        className="border border-gray-200 rounded-md p-4"
                        key={refCode || idx}
                        referenza={ref}
                        config={config}
                        forzaturaBox={item.content?.options?.forzaturaBox}
                        style={item.content?.customStyles}
                        isInWishlist={isInWishlist}
                        options={{
                            removeBackground: true,
                            removeBorder: true,
                        }}
                    />
                );
            })}
        </div>
    );
});

export default GridReferenze;