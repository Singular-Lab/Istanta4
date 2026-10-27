import { FC } from "react";
import { SpinnerPubblico } from "../StatiPubblici";
import styles from '../WebpliantLayout.module.css';

/** Caricamento a tutta pagina della vetrina: stesso spinner degli stati pubblici. */
export const LoadingWebpliant: FC = () => {
    return (
        <div role="status" className={styles.loadingOverlayWebpliant}>
            <div className="flex flex-col items-center gap-3">
                <SpinnerPubblico />
                <span className={styles.loadingTextWebpliant}>Caricamento in corso...</span>
            </div>
        </div>
    );
};
