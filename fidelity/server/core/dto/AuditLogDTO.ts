import { z } from 'zod';

export const AuditLogFilterSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(200).default(50),
    sortBy: z.string().optional().default('createdat'),
    sortOrder: z.enum(['ASC', 'DESC']).optional().default('DESC'),
    eventType: z.string().optional(),
    severity: z.string().optional(),
    userId: z.string().uuid().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    result: z.enum(['SUCCESS', 'FAILURE', 'PARTIAL']).optional(),
    searchTerm: z.string().max(200).optional(),
    resource: z.string().optional(),
});

export type AuditLogFilterDTO = z.infer<typeof AuditLogFilterSchema>;
