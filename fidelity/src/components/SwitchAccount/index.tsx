
import userIcon from "@/assets/images/users/user_icon_profile.png";
import { FormCheck, FormInput } from "@/components/Base/Form";
import { Dialog } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
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
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
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
        <Dialog.Panel className="p-0">
          <Dialog.Title className="flex items-center justify-center h-14 border-b border-slate-200/60">
            <h2 className="text-lg font-medium">Cambia account</h2>
          </Dialog.Title>
          <Dialog.Description className="p-5">
            <div className="flex flex-col gap-3">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Inserisci la tua password
              </label>
              <div className="relative">
                <FormInput
                  type={isPasswordVisible ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                  }}
                  className="pr-10"
                />
                <div
                  className="absolute right-0 top-0 h-full flex items-center pr-3 cursor-pointer"
                  onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                >
                  <Lucide
                    icon={isPasswordVisible ? "EyeOff" : "Eye"}
                    className="w-5 h-5 text-slate-500 hover:text-slate-700 transition-colors"
                  />
                </div>
              </div>
              <div className="flex justify-end mt-3 space-x-2">
                <button
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-200 rounded-md hover:bg-slate-300 transition-colors"
                  onClick={() => setIsPassordModalOpen(false)}
                >
                  Annulla
                </button>
                <button
                  className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/80 transition-colors"
                  onClick={() => {
                    // Handle password validation logic here
                    setIsPasswordValid(password.length > 0);
                    ServerCall.post("/login_user", {
                      email: accounts.data?.find((account) => account.id === switchAccount)?.email,
                      password
                    }).then((res) => {
                      window.location.reload();
                    })
                  }}
                >
                  Conferma
                </button>
              </div>
            </div>
          </Dialog.Description>
        </Dialog.Panel>
      </Dialog>
      <Dialog
        open={props.switchAccount}
        onClose={() => {
          props.setSwitchAccount(false);
        }}
      >
        <Dialog.Panel>
          <Dialog.Title className="justify-center h-14">
            <h2 className="text-base font-medium">Cambia account</h2>
          </Dialog.Title>
          <Dialog.Description className="px-2.5 pt-3.5 pb-4">
            <div className="flex flex-col gap-1.5">
              {accounts.data?.map((faker, fakerKey) => (
                <FormCheck.Label
                  htmlFor={`switch-account-${fakerKey}`}
                  className="flex items-center px-2.5 py-1 rounded-lg hover:bg-slate-100 cursor-pointer"
                  key={fakerKey}
                >
                  <div className="overflow-hidden rounded-full w-11 h-11 image-fit border-[3px] border-slate-200/70">
                    <img
                      alt="Tailwise - Admin Dashboard Template"
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
                      <Lucide icon="Check" className="stroke-[1.5] w-3 h-3" />
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center w-6 h-6 m-auto transition-all border rounded-full text-primary border-theme-1/20 bg-theme-1/5 peer-checked:opacity-0 peer-hover:bg-theme-1/10"></div>
                  </div>
                </FormCheck.Label>
              ))}
            </div>
          </Dialog.Description>
          <Dialog.Footer className="flex items-center justify-center text-center h-14">
            {switchAccount !== props.currentUserId ? (
              <span
                onClick={() => {
                  setIsPassordModalOpen(true);
                }}
                className="block -mt-1 text-primary hover:cursor-pointer"
              >
                Esegui il login con questo account
              </span>
            ) : (
              <span className="block -mt-1 text-slate-400">
                Account attualmente in uso
              </span>
            )}
          </Dialog.Footer>
        </Dialog.Panel>
      </Dialog>
    </>
  );
}

export default CambiaAccount;
