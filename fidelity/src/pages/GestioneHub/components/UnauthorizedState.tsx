import Sezione from "@/components/Base/Sezione";
import EmptyState from "@/components/EmptyState";

const UnauthorizedState = () => {
  return (
    <Sezione>
      <EmptyState
        icon="ShieldX"
        title="Accesso non autorizzato"
        description="Questa sezione è disponibile solo per gli utenti Superadmin con i permessi corretti."
      />
    </Sezione>
  );
};

export default UnauthorizedState;
