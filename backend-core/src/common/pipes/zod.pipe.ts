import { BadRequestException, PipeTransform } from '@nestjs/common';
import { ZodSchema } from 'zod';

/** Validates route body/query against a Zod schema (mirrors frontend validation). */
export function zodParse<T>(schema: ZodSchema<T>): PipeTransform {
  return {
    transform(value: unknown) {
      const result = schema.safeParse(value);
      if (!result.success) {
        throw new BadRequestException(result.error.flatten());
      }
      return result.data;
    },
  };
}
