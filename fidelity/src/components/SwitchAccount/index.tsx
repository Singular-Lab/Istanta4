import userIcon from "@/assets/images/users/user_icon_profile.png";
import Alert from "@/components/Base/Alert";
import Button from "@/components/Base/Button";
import { FormCheck, FormField } from "@/components/Base/Form";
import { Dialog } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import CampoPassword from "@/pages/HubLogin/components/CampoPassword";
import { useFetchAllAccount } from "@/query/query";
import { useEffect, useState } from "react";
import { ServerCall } from "../../../lib/server_call";
interface MainProps {
  switchAccount: boolean;
  setSwitchAccount: (val: boolean) => void;
  currentUserId?: string;
}

function CambiaAccount(props: MainProps) {
  const [switchAccount, setSwitchAccount] = useState("");
  const [isPassordModalOpen, setIsPassordModalOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [isPasswordValid, setIsPasswordValid] = useState(false);
  const [accessoInCorso, setAccessoInCorso] = useState(false);
  const [erroreAccesso, setErroreAccesso] = useState<string | null>(null);
  const accounts = useFetchAllAccount();


  useEffect(() => {
    if (accounts.data) {
      setSwitchAccount(accounts.data[0]?.id);
    }
  }, [accounts.data])

  return (
    <>
      <Dialog
        open={isPassordModalOpen}
        onClose={() => {
          setIsPassordModalOpen(false);
        }}
      >
        <Dialog.Panel>
          <Dialog.Title>Cambia account</Dialog.Title>
          <Dialog.Description className="space-y-4">
            <FormField etichetta="Inserisci la tua password">
              <CampoPassword
                id="switch-account-password"
                placeholder="Password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErroreAccesso(null);
                }}
              />
            </FormField>
            {erroreAccesso && (
              <Alert variant="soft-danger" icona="CircleAlert" className="text-sm">
                {erroreAccesso}
              </Alert>
            )}
          </Dialog.Description>
          <Dialog.Footer>
            <Button type="button" variant="outline-secondary" onClick={() => setIsPassordModalOpen(false)}>
              Annulla
            </Button>
            <Button
              type="button"
              variant="primary"
              loading={accessoInCorso}
              onClick={() => {
                // Handle password validation logic here
                setIsPasswordValid(password.length > 0);
                setAccessoInCorso(true);
                setErroreAccesso(null);
                ServerCall.post("/login_user", {
                  email: accounts.data?.find((account) => account.id === switchAccount)?.email,
                  password
                }).then((res) => {
                  window.location.reload();
                }).catch((errore: unknown) => {
                  // Prima l'errore restava silenzioso: ora resta nella finestra
                  setAccessoInCorso(false);
                  setErroreAccesso(errore instanceof Error && errore.message ? errore.message : "Accesso non riuscito. Verifica la password.");
                })
              }}
            >
              Conferma
            </Button>
          </Dialog.Footer>
        </Dialog.Panel>
      </Dialog>
      <Dialog
        open={props.switchAccount}
        onClose={() => {
          props.setSwitchAccount(false);
        }}
      >
        <Dialog.Panel>
          <Dialog.Title>Cambia account</Dialog.Title>
          <Dialog.Description className="px-2.5 pt-3.5 pb-4">
            <div className="flex flex-col gap-1.5">
              {accounts.data?.map((faker, fakerKey) => (
                <FormCheck.Label
                  htmlFor={`switch-account-${fakerKey}`}
                  className="flex items-center px-2.5 py-1 rounded-control hover:bg-slate-100 cursor-pointer"
                  key={fakerKey}
                >
                  <div className="overflow-hidden rounded-full w-11 h-11 image-fit border-2 border-slate-200/70">
                    <img
                      alt=""
                      src={faker.photo ? `data:image/png;base64,${faker.photo}` : userIcon}
                    />
                  </div>
                  <div className="ml-3.5">
                    <div className="font-medium">{faker.nome} {faker.cognome}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {faker.email}
                    </div>
                  </div>
                  <div className="relative ml-auto w-7 h-7">
                    <FormCheck.Input
                      id={`switch-account-${fakerKey}`}
                      type="checkbox"
                      value="switch-account"
                      checked={switchAccount === faker.id}
                      onChange={() => {
                        setSwitchAccount(faker.id);
                      }}
                      className="absolute z-10 w-full h-full opacity-0 peer"
                    />
                    <div className="absolute inset-0 flex items-center justify-center w-6 h-6 m-auto text-white transition-all border rounded-full opacity-0 bg-theme-1/80 border-theme-1 peer-checked:opacity-100">
                      <Lucide icon="Check" aria-hidden="true" className="w-3 h-3" />
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center w-6 h-6 m-auto transition-all border rounded-full text-primary border-theme-1/20 bg-theme-1/5 peer-checked:opacity-0 peer-hover:bg-theme-1/10"></div>
                  </div>
                </FormCheck.Label>
              ))}
            </div>
          </Dialog.Description>
          <Dialog.Footer>
            {switchAccount === props.currentUserId && (
              <span className="self-center text-sm text-slate-400 sm:mr-auto">
                Account attualmente in uso
              </span>
            )}
            <Button type="button" variant="outline-secondary" onClick={() => props.setSwitchAccount(false)}>
              Chiudi
            </Button>
            {switchAccount !== props.currentUserId && (
              <Button
                type="button"
                variant="primary"
                onClick={() => {
                  setIsPassordModalOpen(true);
                }}
              >
                Esegui il login con questo account
              </Button>
            )}
          </Dialog.Footer>
        </Dialog.Panel>
      </Dialog>
    </>
  );
}

export default CambiaAccount;
