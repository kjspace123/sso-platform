import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OidcProviderService } from './oidc-provider.service';
import { InteractionController } from './interaction.controller';

@Module({
  imports: [AuthModule],
  controllers: [InteractionController],
  providers: [OidcProviderService],
  exports: [OidcProviderService],
})
export class OidcModule {}
