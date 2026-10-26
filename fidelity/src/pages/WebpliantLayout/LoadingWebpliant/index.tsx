import { FC } from "react";
import styles from '../WebpliantLayout.module.css';
import clsx from "clsx";


export const LoadingWebpliant: FC = () => {
    return (
        <div className={styles.loadingOverlayWebpliant}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <span className={clsx(styles.loadingIcon, styles.spinnerWebpliant)} />
                <span className={styles.loadingText}>Caricamento in corso...</span>
            </div>
        </div>
    );
};