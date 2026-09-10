/**
 * Utility per gestire i token CSRF lato client
 */

/**
 * Ottiene il token CSRF dal cookie
 */
export function getCSRFTokenFromCookie(): string | null {
  const cookies = document.cookie.split(';');
  const csrfCookie = cookies.find(cookie => cookie.trim().startsWith('csrf-token='));

  if (csrfCookie) {
    const rawToken = csrfCookie.split('=')[1];
    try {
      return decodeURIComponent(rawToken);
    } catch {
      return rawToken;
    }
  }

  return null;
}

/**
 * Ottiene il token CSRF dal server
 */
export async function fetchCSRFToken(): Promise<string | null> {
  try {
    const response = await fetch('/api/csrf-token', {
      method: 'GET',
      credentials: 'include'
    });

    if (response.ok) {
      const data = await response.json();
      return data.csrfToken;
    }
  } catch (error) {
    console.error('Error fetching CSRF token:', error);
  }

  return null;
}

/**
 * Aggiunge il token CSRF agli headers di una richiesta
 */
export function addCSRFTokenToHeaders(headers: Record<string, string> = {}): Record<string, string> {
  const token = getCSRFTokenFromCookie();

  if (token) {
    headers['x-csrf-token'] = token;
  }

  return headers;
}

/**
 * Aggiunge il token CSRF al body di una richiesta form
 */
export function addCSRFTokenToFormData(formData: FormData): FormData {
  const token = getCSRFTokenFromCookie();

  if (token) {
    formData.append('_csrf', token);
  }

  return formData;
}

/**
 * Aggiunge il token CSRF a un oggetto JSON
 */
export function addCSRFTokenToJSON(data: Record<string, any> = {}): Record<string, any> {
  const token = getCSRFTokenFromCookie();

  if (token) {
    data._csrf = token;
  }

  return data;
}

/**
 * Wrapper per fetch che aggiunge automaticamente il token CSRF
 */
export async function securityFetch(url: string, options: RequestInit = {}): Promise<Response> {
  // Aggiungi il token CSRF agli headers per richieste non-GET
  if (options.method && !['GET', 'HEAD', 'OPTIONS'].includes(options.method.toUpperCase())) {
    options.headers = addCSRFTokenToHeaders(options.headers as Record<string, string>);
  }

  // Assicurati che le credenziali siano incluse
  options.credentials = options.credentials || 'include';

  try {
    const response = await fetch(url, options);

    // Se il token CSRF è scaduto o non valido, prova a ottenerne uno nuovo
    if (response.status === 403) {
      const errorData = await response.json();
      if (errorData.error && errorData.error.includes('CSRF')) {
        console.warn('CSRF token expired, fetching new token...');

        const newToken = await fetchCSRFToken();
        if (newToken) {
          // Riprova la richiesta con il nuovo token
          options.headers = addCSRFTokenToHeaders(options.headers as Record<string, string>);
          return fetch(url, options);
        }
      }
    }

    // Gestisci scadenza sessione
    if (response.status === 401) {
      const errorData = await response.json();
      if (errorData.error === 'SESSION_EXPIRED') {
        console.warn('Session expired, redirecting to login...');
        window.location.href = '/login?reason=session_expired';
        throw new Error('Session expired');
      }
    }

    return response;
  } catch (error) {
    console.error('Security fetch error:', error);
    throw error;
  }
}

/**
 * Hook React per gestire il token CSRF
 */
export function useCSRFToken() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initToken = async () => {
      let csrfToken = getCSRFTokenFromCookie();

      if (!csrfToken) {
        csrfToken = await fetchCSRFToken();
      }

      setToken(csrfToken);
      setLoading(false);
    };

    initToken();
  }, []);

  const refreshToken = async () => {
    setLoading(true);
    const newToken = await fetchCSRFToken();
    setToken(newToken);
    setLoading(false);
    return newToken;
  };

  return {
    token,
    loading,
    refreshToken,
    addToHeaders: (headers: Record<string, string> = {}) => addCSRFTokenToHeaders(headers),
    addToFormData: (formData: FormData) => addCSRFTokenToFormData(formData),
    addToJSON: (data: Record<string, any> = {}) => addCSRFTokenToJSON(data)
  };
}

// Import necessari per React (da aggiungere se non già presenti)
import { useEffect, useState } from 'react';
