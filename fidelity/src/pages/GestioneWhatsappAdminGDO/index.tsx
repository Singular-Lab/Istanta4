import PageHeader from "../../components/Base/PageHeader";
import withSessionCheck from "../../components/SessionChecker";


const GestioneWhatsappAdminGDO: React.FC = () => {
  return (
    <PageHeader
      title="Gestione Whatsapp"
      description="Gestisci i messaggi Whatsapp"
    />
  );
};


export default withSessionCheck(GestioneWhatsappAdminGDO);
