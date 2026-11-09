import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OidcProviderService } from './oidc-provider.service';
import { InteractionController } from './interaction.controller';
import { OidcGrantsService } from './oidc-grants.service';

@Module({
  imports: [AuthModule],
  controllers: [InteractionController],
  providers: [OidcProviderService, OidcGrantsService],
  exports: [OidcProviderService, OidcGrantsService],
})
export class OidcModule {}
