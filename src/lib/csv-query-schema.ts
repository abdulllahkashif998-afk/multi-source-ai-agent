import { z } from 'zod';

// Shared structural validation only. SQL compilation and ownership stay server-side.
export const planSchema = z.object({
  datasetId: z.string().regex(/^[1-9]\d{0,18}$/),
  filters: z.array(z.object({ column: z.string(), op: z.enum(['eq','ne','gt','gte','lt','lte']), value: z.union([z.string(),z.number().finite(),z.boolean()]) }).strict()).max(20).default([]),
  groupBy: z.array(z.string()).max(5).default([]),
  aggregate: z.object({ op: z.enum(['count','sum','avg']), column: z.string().optional() }).strict().optional(),
  sort: z.object({ column: z.string().describe('With aggregate, sort by value (the aggregate result) or a groupBy column. Without aggregate, use an original column name.'), direction: z.enum(['asc','desc']) }).strict().optional(),
  limit: z.number().int().min(1).max(100).default(100),
}).strict();
export type CSVQueryPlan = z.infer<typeof planSchema>;
