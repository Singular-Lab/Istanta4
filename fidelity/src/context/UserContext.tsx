// UserContext.tsx
import { createContext, ReactNode, useContext, useState } from 'react';
import { UtenteResponseDTO } from "../../server/core/dto/UtenteDTO.ts";

interface UserContextType {
  user: UtenteResponseDTO | null;
  setUser: (user: UtenteResponseDTO | null) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UtenteResponseDTO | null>(null);

  return (
    <UserContext.Provider value={{ user, setUser }}>
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
