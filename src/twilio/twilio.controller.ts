import { Controller, Post, Get, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';

@Controller()
export class TwilioController {
  @Get('/')
  root(@Res() res: Response) {
    return res.json({ message: 'NestJS Twilio Media Stream Server is running!' });
  }

  @Post('/incoming-call')
  handleIncomingCall(@Req() req: Request, @Res() res: Response) {
    // TwiML response instructing a <Stream> to wss://{host}/media-stream
    // (This is how Twilio WOULD connect; for local testing, we can still keep it for reference)
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Connect>
          <Stream url="wss://${req.headers.host}/media-stream" />
        </Connect>
      </Response>`;

    res.set('Content-Type', 'text/xml');
    return res.send(twimlResponse);
  }
}
