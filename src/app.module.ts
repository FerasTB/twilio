// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TwilioModule } from './twilio/twilio.module';
import { OpenAiModule } from './openai/openai.module';

@Module({
  imports: [
    // Loads environment variables from .env (if present)
    ConfigModule.forRoot({ isGlobal: true }),
    TwilioModule,
    OpenAiModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
