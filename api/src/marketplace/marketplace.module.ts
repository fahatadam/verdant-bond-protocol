import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MarketplaceController } from './marketplace.controller';
import { DexService } from './dex.service';
import { DexScheduler } from './dex.scheduler';
import { DexReconciliationService } from './dex.reconciliation.service';
import { DexReconciliationScheduler } from './dex.reconciliation.scheduler';
import { LiquidityService } from './liquidity.service';

import { BondsModule } from '../bonds/bonds.module';

@Module({
  imports: [ScheduleModule.forRoot(), BondsModule],
  controllers: [MarketplaceController],
  providers: [
    DexService,
    LiquidityService,
    DexScheduler,
    DexReconciliationService,
    DexReconciliationScheduler,
  ],
  exports: [DexService, LiquidityService, DexReconciliationService],
})
export class MarketplaceModule {}
