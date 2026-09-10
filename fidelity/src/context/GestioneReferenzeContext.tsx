import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { ServerCall } from "../../lib/server_call";
import { ReferenzeIstanta, RUNTIME_KIT_MONGO } from "../../lib/types";



interface GestioneReferenzeContextProps {
  referenza: ReferenzeIstanta | undefined;
  setReferenza: (referenza: ReferenzeIstanta | undefined) => void;
  kit: RUNTIME_KIT_MONGO | undefined;
}

const GestioneReferenzeContext = createContext<GestioneReferenzeContextProps | undefined>(undefined);

export const useGestioneReferenze = () => {
  const context = useContext(GestioneReferenzeContext);
  if (!context) {
    throw new Error("useGestioneReferenze must be used within a GestioneReferenzeProvider");
  }
  return context;
};

export const GestioneReferenzeProvider = ({ children }: { children: ReactNode }) => {
  const [referenza, setReferenza] = useState<ReferenzeIstanta>();
  const [kit, setKit] = useState<RUNTIME_KIT_MONGO>();
  const handleSetReferenza = (newReferenza: ReferenzeIstanta | undefined) => {
    console.log("setReferenza", newReferenza);

    if (newReferenza && referenza && newReferenza.guidIdKitRuntime !== referenza.guidIdKitRuntime) {
      console.log("setReferenza", newReferenza, referenza);
      setReferenza(undefined);
    } else {
      console.log("setReferenza", newReferenza, referenza);
      setReferenza(newReferenza);
    }
  };
  useEffect(() => {
    const fetchKit = async () => {
      if (referenza && referenza.guidIdKitRuntime && typeof referenza.guidIdKitRuntime === 'string') {
        const kit = await ServerCall.get<RUNTIME_KIT_MONGO>(`/getKitRuntimeById?get_files=false&id=${referenza.guidIdKitRuntime}`);
        setKit(kit);
      } else {
        setKit(undefined);
      }
    };
    fetchKit();
  }, [referenza]);

  return (
    <GestioneReferenzeContext.Provider value={{ referenza, setReferenza: handleSetReferenza, kit }}>
      {children}
    </GestioneReferenzeContext.Provider>
  );
};
