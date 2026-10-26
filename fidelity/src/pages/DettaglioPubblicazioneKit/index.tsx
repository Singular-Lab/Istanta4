import { FC } from 'react';
import withSessionCheck from "@/components/SessionChecker";

const DettaglioPubblicazioneKit: FC = () => {
    return <div>Dettaglio Pubblicazione Kit</div>;
};

export default withSessionCheck(DettaglioPubblicazioneKit);
