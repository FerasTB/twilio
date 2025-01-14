import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WsAdapter } from '@nestjs/platform-ws';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Tell Nest to use the raw WebSocket adapter
  app.useWebSocketAdapter(new WsAdapter(app));

  const port = process.env.PORT || 5000;
  await app.listen(port);
  Logger.log(`NestJS server is listening on port ${port}`);
}
bootstrap();
