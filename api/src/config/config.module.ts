import { Global, Module } from '@nestjs/common';
import { ConfigService } from './config.service';
import { EnvConfigValidator } from '../common/config/env-config.validator';

@Global()
@Module({
  providers: [ConfigService, EnvConfigValidator],
  exports: [ConfigService, EnvConfigValidator],
import { FeatureFlagsService } from './feature-flags.service';

@Global()
@Module({
  providers: [ConfigService, FeatureFlagsService],
  exports: [ConfigService, FeatureFlagsService],
})
export class ConfigModule {}
