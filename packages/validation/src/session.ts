import { z } from 'zod';
import { paginationSchema } from './user';

// z.coerce.boolean() would treat the string "false" as truthy (any
// non-empty string coerces to true) — this maps the literal query values
// query strings actually carry instead.
const queryBoolean = (defaultValue: boolean) =>
  z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .default(defaultValue)
    .transform((v) => v === true || v === 'true');

export const listSessionsSchema = paginationSchema.extend({
  activeOnly: queryBoolean(true),
});
export type ListSessionsInput = z.infer<typeof listSessionsSchema>;
