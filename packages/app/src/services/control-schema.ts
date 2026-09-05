import { z } from 'zod';
import { ModelCreateSchema } from '../lib/validators';

const modelId = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .refine((id) => id !== 'default', '中心配置须指定实际模型');
export const defaultsSchema = z
  .object({
    chat: modelId.optional(),
    image: modelId.optional(),
    video: modelId.optional(),
    tts: modelId.optional(),
    stt: modelId.optional(),
  })
  .strict();
export const projectSchema = z
  .object({
    repository: z.string().trim().min(1).max(500),
    name: z.string().trim().min(1).max(120),
    billingMode: z.enum(['wallet', 'meter_only']).default('wallet'),
    defaults: defaultsSchema.default({}),
  })
  .strict();
export const projectUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    billingMode: z.enum(['wallet', 'meter_only']),
    defaults: defaultsSchema,
    isActive: z.boolean().default(true),
  })
  .strict();
export const connectionSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/),
    protocol: z.enum(['openai', 'anthropic', 'gemini', 'workers-ai']),
    baseUrl: z.string().url().nullable(),
    credentialRef: z
      .string()
      .regex(/^[A-Z][A-Z0-9_]*$/)
      .nullable(),
    enabled: z.boolean().default(true),
    pricingSource: z
      .enum(['catalog_estimate', 'subscription_estimate', 'provider_reported'])
      .default('catalog_estimate'),
  })
  .strict();
export const routeSchema = z.object({ modelId, connectionId: z.string().min(1), upstreamModelId: modelId }).strict();
export const configurationSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('defaults'), value: defaultsSchema }),
  z.object({ kind: z.literal('project'), id: z.string().min(1), value: projectUpdateSchema }),
  z.object({ kind: z.literal('connection'), value: connectionSchema }),
  z.object({ kind: z.literal('model'), value: ModelCreateSchema }),
  z.object({ kind: z.literal('route'), value: routeSchema }),
  z.object({
    kind: z.literal('audio_rate'),
    value: z
      .object({ modelId, unit: z.enum(['character', 'second']), pricePerUnit: z.number().nonnegative() })
      .strict(),
  }),
]);
export const changeSchema = z
  .object({
    change: configurationSchema,
    expectedVersion: z.number().int().nonnegative(),
    idempotencyKey: z.string().min(8).max(200),
    dryRun: z.boolean().default(false),
  })
  .strict();
export type ConfigurationChange = z.infer<typeof configurationSchema>;
export type ChangeInput = z.infer<typeof changeSchema>;

export function configurationTarget(change: ConfigurationChange): string {
  switch (change.kind) {
    case 'defaults':
      return 'defaults';
    case 'project':
      return `project/${change.id}`;
    case 'connection':
      return `connection/${change.value.id}`;
    case 'model':
      return `model/${change.value.id}`;
    case 'route':
      return `route/${change.value.modelId}`;
    case 'audio_rate':
      return `audio-rate/${change.value.modelId}`;
  }
}
