const BASE = '';

function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)olimpo_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (!['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())) {
    const csrf = getCsrfToken();
    if (csrf) headers['x-olimpo-csrf'] = csrf;
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      message = data?.message || data?.error || message;
    } catch {
      // ignore parse error
    }
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

/* ------------------------------------------------------------------ */
/* Auth endpoints                                                       */
/* ------------------------------------------------------------------ */

export interface Identity {
  origin: string;
  username: string;
  tipoUtente: string;
  userPolicy: unknown[];
  autorizzato: boolean;
}

export async function checkIdentity(): Promise<Identity> {
  return request<Identity>('GET', '/olimpo/auth/checkIdentity');
}

export async function dashboardLogin(secret: string): Promise<{ esito: boolean; error?: string }> {
  return request('PUT', '/olimpo/auth/dashboard-login', { secret });
}

export async function dashboardLogout(): Promise<void> {
  await request('POST', '/olimpo/auth/dashboard-logout');
}

/* ------------------------------------------------------------------ */
/* Dashboard overview                                                   */
/* ------------------------------------------------------------------ */

export interface DashboardStats {
  totalFoto: number;
  fotoConvertiteWeb: number;
  fotoPerformanti: number;
  totalMateriali: number;
  materialiPdf: number;
  totalUtenti: number;
}

export interface FotoOverviewItem {
  id: string;
  archivioFileName: string | null;
  webFileName: string | null;
  webpFileName: string | null;
  hasWebAsset: boolean;
  hasWebpAsset: boolean;
  previewUrl: string | null;
  webUrl: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface MaterialeOverviewItem {
  id: string;
  fileName: string | null;
  originalName: string | null;
  pagine: number;
  extension: string;
  isPdf: boolean;
  thumbnailUrl: string | null;
  openUrl: string;
}

export interface UtenteOverviewItem {
  id: string;
  email: string;
  origin: string;
  tipoUtente: string;
  isValid: boolean;
  expiresAt: string | null;
  nome: string;
  cognome: string;
  displayName: string;
  ruoliCount: number;
}

export interface DashboardOverview {
  generatedAt: string;
  stats: DashboardStats;
  foto: FotoOverviewItem[];
  materiali: MaterialeOverviewItem[];
  utenti: UtenteOverviewItem[];
}

export async function getDashboardOverview(): Promise<DashboardOverview> {
  return request<DashboardOverview>('GET', '/olimpo/impostazioni/getDashboardOverview');
}

/* ------------------------------------------------------------------ */
/* Foto                                                                 */
/* ------------------------------------------------------------------ */

export interface FotoRecord {
  id: string;
  md5?: string;
  file_name: string | null;
  file_name_web: string | null;
  file_name_web_performante: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export async function getAllFoto(): Promise<FotoRecord[]> {
  return request<FotoRecord[]>('GET', '/olimpo/impostazioni/getAllFoto');
}

export interface FotoPage {
  items: FotoRecord[];
  total: number;
  offset: number;
  limit: number;
  search: string;
  hasMore: boolean;
  nextOffset: number | null;
}

export async function getFotoPage(params: {
  offset?: number;
  limit?: number;
  search?: string;
}): Promise<FotoPage> {
  const searchParams = new URLSearchParams();

  if (typeof params.offset === 'number') {
    searchParams.set('offset', String(params.offset));
  }

  if (typeof params.limit === 'number') {
    searchParams.set('limit', String(params.limit));
  }

  if (params.search?.trim()) {
    searchParams.set('q', params.search.trim());
  }

  const queryString = searchParams.toString();
  const path = queryString
    ? `/olimpo/impostazioni/getFotoPage?${queryString}`
    : '/olimpo/impostazioni/getFotoPage';

  return request<FotoPage>('GET', path);
}

/* ------------------------------------------------------------------ */
/* Materiali                                                            */
/* ------------------------------------------------------------------ */

export interface MaterialeRecord {
  id: string;
  file_name: string | null;
  original_name: string | null;
  pagine: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export async function getAllMateriali(): Promise<MaterialeRecord[]> {
  return request<MaterialeRecord[]>('GET', '/olimpo/impostazioni/getAllMateriali');
}
