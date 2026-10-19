import dayjs from "dayjs";

// Data e ora per testi che la introducono con "il": "03/09/2026 alle 10:30"
export const formattaDataOra = (data: string | Date | undefined) =>
  data ? dayjs(data).format("DD/MM/YYYY [alle] HH:mm") : "N/A";

// Solo data, per scadenze e validità che non hanno un orario significativo
export const formattaData = (data: string | Date | undefined) =>
  data ? dayjs(data).format("DD/MM/YYYY") : "N/A";
