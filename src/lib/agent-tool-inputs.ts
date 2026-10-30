import {z} from 'zod';
import {planSchema} from './csv-query-schema';
// Shared structural schemas only; ownership and SQL validation remain in tools.
export const agentToolInputs={
 searchDocuments:z.object({question:z.string().trim().min(1).max(2000)}).strict(),
 discoverDatasets:z.object({}).strict(),
 inspectDataset:z.object({datasetId:z.string()}).strict(),
 queryDataset:planSchema,
};

// Advertise the same operation-dependent contract enforced by the compiler.
// Numeric column membership remains owner/dataset-specific backend validation.
const modelAggregate=z.discriminatedUnion('op',[
 z.object({op:z.literal('count')}).strict(),
 z.object({op:z.literal('sum'),column:z.string().min(1).describe('An inspected numeric column name.')}).strict(),
 z.object({op:z.literal('avg'),column:z.string().min(1).describe('An inspected numeric column name.')}).strict(),
]);
// Planner-only schema and scheduling metadata. Public plan schema is unchanged.
export const agentModelToolInputs={...agentToolInputs,
 policyCounts:z.object({metric:z.enum(['first_response','resolution'])}).strict(),
 queryDataset:agentToolInputs.queryDataset.extend({aggregate:modelAggregate.optional(),evidenceComplete:z.boolean().optional().describe('True only if this is the final evidence operation for every requested part; false for exploration, ambiguity or follow-up work.')})
};
