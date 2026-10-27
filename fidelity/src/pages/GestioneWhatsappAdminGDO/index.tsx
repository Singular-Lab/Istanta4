import Pagina from "@/components/Base/Pagina";
import Sezione from "@/components/Base/Sezione";
import EmptyState from "@/components/EmptyState";
import withSessionCheck from "@/components/SessionChecker";

// La gestione WhatsApp lato GDO non è ancora stata realizzata: la pagina lo dice invece di restare vuota
const GestioneWhatsappAdminGDO: React.FC = () => {
  return (
    <Pagina titolo="Gestione WhatsApp" descrizione="Gestisci i messaggi WhatsApp">
      <Sezione>
        <EmptyState
          icon="MessageCircle"
          title="Funzionalità non ancora disponibile"
          description="La gestione dei messaggi WhatsApp per la GDO non è ancora disponibile."
        />
      </Sezione>
    </Pagina>
  );
};

export default withSessionCheck(GestioneWhatsappAdminGDO);
