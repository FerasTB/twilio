import { Module } from '@nestjs/common';
import { TwilioController } from './twilio.controller';
import { TwilioGateway } from './twilio.gateway';
import { OpenAiModule } from '../openai/openai.module';

@Module({
  imports: [OpenAiModule],
  controllers: [TwilioController],
  providers: [TwilioGateway],
})
export class TwilioModule {}
