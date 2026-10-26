import EmptyState from "@/components/EmptyState";

const UnauthorizedState = () => {
  return (
    <div className="box box--stacked mt-6 p-6">
      <EmptyState
        icon="ShieldX"
        title="Accesso non autorizzato"
        description="Questa sezione è disponibile solo per gli utenti Superadmin con i permessi corretti."
      />
    </div>
  );
};

export default UnauthorizedState;
