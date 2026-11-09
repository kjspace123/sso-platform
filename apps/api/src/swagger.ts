import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';

/**
 * Shared OpenAPI document config — used both by main.ts (live Swagger UI,
 * dev-only) and scripts/export-openapi.ts (static JSON, safe to run and
 * publish for any environment including production, where the live UI is
 * intentionally disabled — see main.ts).
 */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('SSO Platform API')
    .setDescription('Authentication, RBAC, application, session, and audit APIs.')
    .setVersion('0.1.0')
    .addCookieAuth('sso_session')
    .build();
  return SwaggerModule.createDocument(app, config);
}
