import Button from '@/components/Base/Button';
import { FormField, FormInput, FormLabel } from '@/components/Base/Form';
import Pagina from '@/components/Base/Pagina';
import Sezione from '@/components/Base/Sezione';
import withSessionCheck from "@/components/SessionChecker";
import TomSelect from '@/components/Base/TomSelect';
import { useNotification } from '@/context/NotificationContext';
import { useMutation } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import { useLoaderData } from 'react-router-dom';
import { ServerCall } from '../../../lib/server_call';
import { RootFileTree } from '../../../lib/types';
import { AreaResponseDTO, CanaleResponseDTO, ContrattoTipografiaResponseDTO, TipiDiExportResponseDTO } from '../../../server/core/dto';
import FileTree from './FileTree';

type ContrattoTipografiaLoaderData = {
  impostazioni: TipiDiExportResponseDTO[] | null;
  contratto: (ContrattoTipografiaResponseDTO & { contratto: RootFileTree }) | null;
  canali: CanaleResponseDTO[] | null;
  aree: AreaResponseDTO[] | null;
};

type ContrattoTipografiaMutationData = {
  nome: string;
  idTipiExport: string[];
  contratto: RootFileTree;
  hostFtp?: string | null;
  userFtp?: string | null;
  pwdFtp?: string | null;
  portFtp?: number | null;
};

const ImpostazioniTipografia: React.FC = () => {
  const { impostazioni, contratto, canali, aree } = useLoaderData() as ContrattoTipografiaLoaderData;

  const [tipiExport, setTipiExport] = useState<string[]>([]);
  const [nomeContratto, setNomeContratto] = useState<string>('');
  const [hostFtp, setHostFtp] = useState<string>('');
  const [userFtp, setUserFtp] = useState<string>('');
  const [pwdFtp, setPwdFtp] = useState<string>('');
  const [portFtp, setPortFtp] = useState<string>('');
  const [contrattoTipografia, setContrattoTipografia] = useState<(ContrattoTipografiaResponseDTO & { contratto: RootFileTree }) | undefined>();

  const { showNotification } = useNotification();

  useEffect(() => {
    if (!contratto) {
      return;
    }

    setNomeContratto(contratto.nome);
    setTipiExport(contratto.tipi_export);
    setHostFtp(contratto.host_ftp ?? '');
    setUserFtp(contratto.user_ftp ?? '');
    setPwdFtp(contratto.pwd_ftp ?? '');
    setPortFtp(contratto.port_ftp !== undefined ? String(contratto.port_ftp) : '');
    setContrattoTipografia({
      ...contratto,
      contratto: contratto.contratto
    });
  }, [contratto]);

  const mutation = useMutation({
    mutationKey: ['contratto_tipografia', 'update'],
    mutationFn: async (data: ContrattoTipografiaMutationData) => {
      if (!contratto?.id) {
        return ServerCall.put<any>('/creaContrattoTipografia', data);
      }

      return ServerCall.put<any>('/updateContrattoTipografia', {
        ...data,
        id: contratto.id,
        contratto: contrattoTipografia?.contratto ?? data.contratto
      });
    },
    onSuccess() {
      showNotification("Contratto tipografia aggiornato con successo", { variant: "success" });
    },
    onError() {
      showNotification("Si è verificato un errore durante l'aggiornamento del contratto tipografia", { variant: "error" });
    }
  });

  return (
    <Pagina titolo="Impostazione Tipografia" descrizione="Gestione impostazione tipografia">
      <Sezione titolo="Contratto" descrizione="Nome del contratto e tipi di export a cui si applica">
        <div className="flex flex-col gap-4">
          <FormField etichetta="Nome del contratto" obbligatorio>
            <FormInput
              id="nome-contratto-tipografia"
              type="text"
              placeholder="Inserisci il nome del contratto"
              value={nomeContratto}
              onChange={(value) => {
                setNomeContratto(value.target.value);
              }}
            />
          </FormField>

          <div>
            <FormLabel htmlFor="tom-select-tipi-export">
              Tipi di export del contratto
            </FormLabel>
            <TomSelect
              multiple
              id="tom-select-tipi-export"
              value={tipiExport}
              onChange={(value) => {
                setTipiExport(value.target.value);
              }}
              options={{
                placeholder: 'Seleziona tipo di export per il contratto'
              }}
            >
              {(impostazioni ?? []).map((tipi) => (
                <option key={tipi.id} value={tipi.id}>
                  {tipi.nome}
                </option>
              ))}
            </TomSelect>
          </div>
        </div>
      </Sezione>

      <Sezione titolo="Server FTP" descrizione="Dove la tipografia riceve i file">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField etichetta="Host FTP">
            <FormInput
              id="host-ftp-contratto-tipografia"
              type="text"
              placeholder="es. ftp.dominio.it"
              value={hostFtp}
              onChange={(value) => setHostFtp(value.target.value)}
            />
          </FormField>
          <FormField etichetta="Utente FTP">
            <FormInput
              id="user-ftp-contratto-tipografia"
              type="text"
              placeholder="Inserisci utente FTP"
              value={userFtp}
              onChange={(value) => setUserFtp(value.target.value)}
            />
          </FormField>
          <FormField etichetta="Password FTP">
            <FormInput
              id="pwd-ftp-contratto-tipografia"
              type="password"
              placeholder="Inserisci password FTP"
              value={pwdFtp}
              onChange={(value) => setPwdFtp(value.target.value)}
            />
          </FormField>
          <FormField etichetta="Porta FTP">
            <FormInput
              id="port-ftp-contratto-tipografia"
              type="number"
              min={0}
              max={65535}
              placeholder="21"
              value={portFtp}
              onChange={(value) => setPortFtp(value.target.value)}
            />
          </FormField>
        </div>
      </Sezione>

      <Sezione titolo="Struttura delle cartelle" descrizione="Configura la struttura delle cartelle per i file tipografici">
        <FileTree
          contratto={contrattoTipografia?.contratto || contratto?.contratto || null}
          canali={canali?.filter((c) => c.id).map((c) => ({ id: c.id, nome: c.nome })) ?? []}
          aree={aree?.filter((a) => a.id).map((a) => ({ id: a.id, nome: a.nome })) ?? []}
          onChange={(data: RootFileTree) => {
            setContrattoTipografia((prev) => {
              if (prev) {
                return {
                  ...prev,
                  contratto: data,
                  json: data
                };
              }

              return {
                id: contratto?.id ?? '',
                nome: nomeContratto.trim(),
                tipi_export: tipiExport,
                id_gdo: contratto?.id_gdo ?? '',
                contratto: data,
                json: data,
                host_ftp: hostFtp || undefined,
                user_ftp: userFtp || undefined,
                pwd_ftp: pwdFtp || undefined,
                port_ftp: portFtp ? Number(portFtp) : undefined
              };
            });
          }}
          onCreateNew={(value: RootFileTree) => {
            setContrattoTipografia((prev) => {
              if (!prev) {
                return {
                  id: contratto?.id ?? '',
                  nome: nomeContratto.trim(),
                  tipi_export: tipiExport,
                  id_gdo: contratto?.id_gdo ?? '',
                  contratto: value,
                  json: value,
                  host_ftp: hostFtp || undefined,
                  user_ftp: userFtp || undefined,
                  pwd_ftp: pwdFtp || undefined,
                  port_ftp: portFtp ? Number(portFtp) : undefined
                };
              }

              return {
                ...prev,
                contratto: value,
                json: value
              };
            });
          }}
        />
      </Sezione>

      <div className="flex justify-end">
        <Button
          variant="primary"
          loading={mutation.isPending}
          disabled={!nomeContratto.trim() || tipiExport.length === 0 || mutation.isPending}
          onClick={() => {
            if (!nomeContratto.trim()) {
              showNotification("Il nome del contratto è obbligatorio", { variant: "warning" });
              return;
            }

            if (tipiExport.length === 0) {
              showNotification("Seleziona almeno un tipo di export", { variant: "warning" });
              return;
            }

            const contrattoData = contrattoTipografia?.contratto || contratto?.contratto;
            if (!contrattoData) {
              showNotification("Configurazione contratto mancante", { variant: "warning" });
              return;
            }

            const trimmedPort = portFtp.trim();
            let parsedPort: number | null = null;
            if (trimmedPort.length > 0) {
              const portValue = Number(trimmedPort);
              if (!Number.isInteger(portValue) || portValue < 0 || portValue > 65535) {
                showNotification("Porta FTP non valida: deve essere un intero tra 0 e 65535", { variant: "warning" });
                return;
              }
              parsedPort = portValue;
            }

            const normalizedHost = hostFtp.trim();
            const normalizedUser = userFtp.trim();
            const normalizedPwd = pwdFtp.trim();

            mutation.mutate({
              nome: nomeContratto.trim(),
              idTipiExport: tipiExport,
              contratto: contrattoData,
              hostFtp: normalizedHost.length > 0 ? normalizedHost : null,
              userFtp: normalizedUser.length > 0 ? normalizedUser : null,
              pwdFtp: normalizedPwd.length > 0 ? normalizedPwd : null,
              portFtp: parsedPort
            });
          }}
        >
          Salva
        </Button>
      </div>
    </Pagina>
  );
};

export default withSessionCheck(ImpostazioniTipografia);
