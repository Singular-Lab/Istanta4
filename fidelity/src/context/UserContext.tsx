// UserContext.tsx
import { createContext, ReactNode, useContext, useMemo, useState } from 'react';
import { UtenteResponseDTO } from "../../server/core/dto/UtenteDTO.ts";

interface UserContextType {
  user: UtenteResponseDTO | null;
  setUser: (user: UtenteResponseDTO | null) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UtenteResponseDTO | null>(null);
  // Valore nuovo solo quando cambia l'utente
  const value = useMemo(() => ({ user, setUser }), [user]);

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
};
