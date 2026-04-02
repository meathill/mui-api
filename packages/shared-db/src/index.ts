import * as authSchema from './auth-schema';
import * as businessSchema from './business-schema';

export const allSchema = {
  ...authSchema,
  ...businessSchema,
};

export { authSchema, businessSchema };
export * from './auth-schema';
export * from './business-schema';
