import { Module } from '@nestjs/common';
import { ApplicationsService } from './applications.service';

// No controller here — admin-facing routes live under /admin/applications
// (section 17) and are exposed by AdminModule, which imports this module.
@Module({
  providers: [ApplicationsService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
