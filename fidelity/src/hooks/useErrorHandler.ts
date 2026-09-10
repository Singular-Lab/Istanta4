import { useNotification } from '@/context/NotificationContext';
import { ClientErrorType, CustomError } from '@lib/server_call';

/**
 * Hook per gestire errori API in modo consistente.
 * Usa le proprietà ricche di CustomError (userMessage, actionRequired, isRetryable, clientType)
 * per mostrare notifiche appropriate all'utente.
 *
 * Uso con useMutation:
 *   const { handleError } = useErrorHandler();
 *   const mutation = useMutation({ mutationFn: ..., onError: handleError });
 *
 * Uso con useQuery:
 *   const { handleError } = useErrorHandler();
 *   const query = useQuery({ queryKey: [...], queryFn: ... });
 *   useEffect(() => { if (query.error) handleError(query.error); }, [query.error]);
 */
export function useErrorHandler() {
  const { showNotification } = useNotification();

  const handleError = (error: unknown) => {
    if (error instanceof CustomError) {
      const variant = getVariant(error.clientType);
      showNotification(error.getUserMessage(), { variant });
    } else if (error instanceof Error) {
      showNotification(error.message, { variant: 'error' });
    } else {
      showNotification('Si è verificato un errore imprevisto.', { variant: 'error' });
    }
  };

  return { handleError };
}

function getVariant(clientType: ClientErrorType): 'error' | 'warning' | 'info' {
  switch (clientType) {
    case ClientErrorType.VALIDATION:
    case ClientErrorType.BUSINESS_LOGIC:
      return 'warning';
    case ClientErrorType.RATE_LIMIT:
      return 'info';
    default:
      return 'error';
  }
}
