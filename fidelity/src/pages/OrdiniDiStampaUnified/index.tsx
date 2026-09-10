import PageHeader from "@/components/Base/PageHeader";
import { PermissionGate } from "@/components/PermissionGate";
import { PERMISSIONS } from "@/constants/permissions";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useLoaderData, useNavigate, useRevalidator } from "react-router-dom";
import { ServerCall } from "../../../lib/server_call";
import { PromoResponseDTO, type OrdiniDiStampaResponseDTO } from "../../../server/core/dto";
import withSessionCheck from "../../components/SessionChecker";
import CreateOrderDialog from "./components/CreateOrderDialog";
import NuovoODSSection from "./components/NuovoODSSection";
import ODSCompletatiSection from "./components/ODSCompletatiSection";
import ODSInCorsoSection from "./components/ODSInCorsoSection";
import SearchSection from "./components/SearchSection";

type OrdineWithPromo = OrdiniDiStampaResponseDTO & { nomePromo: string };

export interface OrdiniDiStampaLoaderData {
  title: string;
  description: string;
  filterType: 'nuovo' | 'in-corso' | 'completati';
  data: {
    promo: PromoResponseDTO[];
    ordini: OrdineWithPromo[];
  };
}

function OrdiniDiStampaUnified() {
  const loaderData = useLoaderData() as OrdiniDiStampaLoaderData;
  const { filterType, title, description, data } = loaderData;

  const [searchQuery, setSearchQuery] = useState("");
  const [openDialogAvviaLavorazione, setOpenDialogAvviaLavorazione] = useState(false);
  const [selectedPromo, setSelectedPromo] = useState<PromoResponseDTO | null>(null);

  const navigate = useNavigate();
  const revalidator = useRevalidator();

  const creaOrdineDiStampa = useMutation({
    mutationKey: ["creaOrdineDiStampa"],
    mutationFn: async (dataToSend: { idPromo: string }) => {
      return await ServerCall.put<any>("/creaOrdineDiStampa", dataToSend);
    },
    onSuccess: () => {
      setSelectedPromo(null);
      setOpenDialogAvviaLavorazione(false);
      // Navigate to in-corso view after creation
      navigate('/ods-in-corso');
      revalidator.revalidate();
    }
  });

  const handleCreateOrder = (promo: PromoResponseDTO) => {
    setSelectedPromo(promo);
    setOpenDialogAvviaLavorazione(true);
  };

  const handleConfirmCreateOrder = () => {
    if (selectedPromo?.id) {
      creaOrdineDiStampa.mutate({ idPromo: selectedPromo.id });
    }
  };

  const handleRevisioneClick = (ordineId: string) => {
    navigate(`/ods-in-corso/revisione?id=${ordineId}`);
  };

  const handleViewDetails = (ordineId: string) => {
    navigate(`/ods-completati/dettagli?id=${ordineId}`);
  };

  return (
    <>
      <div className="grid grid-cols-12 gap-y-10 gap-x-6">
        <div className="col-span-12">
          <PageHeader
            title={title}
            description={description}
          />

          <div className="flex flex-col gap-8 mt-3.5">
            <SearchSection
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
            />

            {filterType === 'nuovo' && (
              <NuovoODSSection
                promo={data.promo}
                searchQuery={searchQuery}
                onCreateOrder={handleCreateOrder}
              />
            )}

            {filterType === 'in-corso' && (
              <ODSInCorsoSection
                ordini={data.ordini}
                searchQuery={searchQuery}
                onRevisioneClick={handleRevisioneClick}
              />
            )}

            {filterType === 'completati' && (
              <ODSCompletatiSection
                ordini={data.ordini}
                searchQuery={searchQuery}
                onViewDetails={handleViewDetails}
              />
            )}
          </div>
        </div>
      </div>

      {filterType === 'nuovo' && (
        <PermissionGate permission={PERMISSIONS.ORDINI_STAMPA.CREA}>
          <CreateOrderDialog
            open={openDialogAvviaLavorazione}
            selectedPromo={selectedPromo}
            onClose={() => setOpenDialogAvviaLavorazione(false)}
            onConfirm={handleConfirmCreateOrder}
            isPending={creaOrdineDiStampa.isPending}
          />
        </PermissionGate>
      )}
    </>
  );
}

export default withSessionCheck(OrdiniDiStampaUnified);
