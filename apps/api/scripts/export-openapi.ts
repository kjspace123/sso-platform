/**
 * Exports the OpenAPI spec as static JSON. The live Swagger UI (main.ts) is
 * intentionally disabled in production, so this is how the API contract
 * gets published for integrators without exposing an interactive endpoint —
 * commit the output to docs/api/ (or attach it to a release) after
 * regenerating.
 *
 * Requires a reachable DATABASE_URL/REDIS_URL, same as running the app
 * itself — it boots the full Nest module graph to introspect controllers,
 * it just never calls app.listen().
 *
 * Usage: pnpm --filter @sso-platform/api exec ts-node --transpile-only scripts/export-openapi.ts [output-path]
 */
import 'reflect-metadata';
import 'dotenv/config';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { buildOpenApiDocument } from '../src/swagger';

async function main() {
  const outputPath = resolve(process.argv[2] ?? '../../docs/api/openapi.json');

  const app = await NestFactory.create(AppModule, { logger: false });
  const document = buildOpenApiDocument(app);
  await app.close();

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`);
  console.log(`Wrote OpenAPI spec to ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
