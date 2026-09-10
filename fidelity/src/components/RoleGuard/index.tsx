import { FC, ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { TIPO_UTENTI } from "../../../lib/enums";
import { useUser } from "../../context/UserContext";

interface RoleGuardProps {
    allowedRoles: TIPO_UTENTI[];
    children: ReactNode;
    redirectTo?: string;
}

/**
 * Protegge il contenuto in base al ruolo dell'utente.
 * Se il ruolo non è autorizzato, redirige alla pagina specificata.
 */
const RoleGuard: FC<RoleGuardProps> = ({
    allowedRoles,
    children,
    redirectTo = "/gdo/dashboard",
}) => {
    const { user } = useUser();

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (!allowedRoles.includes(user.tipo as TIPO_UTENTI)) {
        return <Navigate to={redirectTo} replace />;
    }

    return <>{children}</>;
};

export default RoleGuard;
