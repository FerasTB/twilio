import { Injectable, Logger } from '@nestjs/common';
import * as ws from 'ws';  // Using the namespace import

@Injectable()
export class OpenAiService {
  private readonly logger = new Logger(OpenAiService.name);

  private openAiWs: ws.WebSocket | null = null;

  /**
   * OpenAiService needs a reference to Twilio’s raw socket
   * and a callback that we can call whenever we get audio from OpenAI.
   */
  setupOpenAiConnection(
    twilioSocket: ws.WebSocket,
    sendAudioToTwilio: (base64Audio: string) => void
  ) {
    if (!process.env.OPENAI_API_KEY) {
      this.logger.error('Missing OPENAI_API_KEY in .env');
      return;
    }

    // Connect to OpenAI’s Realtime API
    this.openAiWs = new ws.WebSocket(
      'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01',
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'OpenAI-Beta': 'realtime=v1',
        },
      },
    );

    this.openAiWs.on('open', () => {
      this.logger.log('Connected to OpenAI Realtime API');
      // Give a short delay before sending the session update
      setTimeout(() => {
        const sessionUpdate = {
          type: 'session.update',
          session: {
            turn_detection: { type: 'server_vad' },
            input_audio_format: 'g711_ulaw',
            output_audio_format: 'g711_ulaw',
            voice: 'alloy',
            instructions: 'You are a customer service representative at Beno, a company that offers luxury rentals, including exotic, luxury, and economy cars, chauffeur services, yacht charters, fun water activities, helicopter tours, and a desert buggy safari. Your role is to assist customers by providing information about our services, handling inquiries about reservations, and ensuring a luxurious, personalized experience. Your responses should reflect the professionalism, attention to detail, and tailor-made services that Beno is known for. Be empathetic and friendly while delivering accurate and helpful information. Offer suggestions based on the customers unique tastes and preferences, keeping in mind our commitment to exceptional customer satisfaction. When answering questions, focus on our luxury offerings and make customers feel confident in our ability to craft exclusive experiences for them.',
            modalities: ['text', 'audio'],
            temperature: 0.8,
          },
        };
        this.logger.log(`Sending session update: ${JSON.stringify(sessionUpdate)}`);
        this.openAiWs?.send(JSON.stringify(sessionUpdate));
      }, 250);
    });

    this.openAiWs.on('message', (data) => {
      // data is typically a buffer or string
      let response: any;
      try {
        response = JSON.parse(data.toString());
      } catch (err) {
        this.logger.error('Error parsing OpenAI message:', err);
        return;
      }
      this.handleOpenAiMessage(response, sendAudioToTwilio);
    });

    this.openAiWs.on('close', () => {
      this.logger.log('Disconnected from OpenAI Realtime API');
    });

    this.openAiWs.on('error', (err) => {
      this.logger.error('OpenAI WebSocket Error:', err);
    });
  }

  /**
   * Process audio deltas from OpenAI, forward them back to Twilio.
   */
  private handleOpenAiMessage(response: any, sendAudioToTwilio: (base64Audio: string) => void) {
    // e.g., log certain events
    const LOG_EVENT_TYPES = [
      'response.content.done',
      'rate_limits.updated',
      'response.done',
      'input_audio_buffer.committed',
      'input_audio_buffer.speech_stopped',
      'input_audio_buffer.speech_started',
      'session.created',
    ];
    if (LOG_EVENT_TYPES.includes(response.type)) {
      this.logger.log(`Received OpenAI event: ${response.type} => ${JSON.stringify(response)}`);
    }

    // If there's audio, forward it to Twilio using our callback
    if (response.type === 'response.audio.delta' && response.delta) {
      const base64Audio = Buffer.from(response.delta, 'base64').toString('base64');
      sendAudioToTwilio(base64Audio); // calls TwilioGateway's sendAudioToTwilio()
    }
  }

  /**
   * Called whenever Twilio sends us audio frames.
   * We pass them to OpenAI for processing.
   */
  processTwilioMedia(data: any) {
    if (!this.openAiWs || this.openAiWs.readyState !== ws.WebSocket.OPEN) {
      return;
    }

    switch (data?.event) {
      case 'media':
        // forward G711 audio to OpenAI
        const audioAppend = {
          type: 'input_audio_buffer.append',
          audio: data.media.payload, // base64-encoded G711 from Twilio
        };
        this.openAiWs.send(JSON.stringify(audioAppend));
        break;
      default:
        this.logger.log('Received non-media event: ' + data.event);
        break;
    }
  }

  /**
   * Tidy up the OpenAI WebSocket when Twilio disconnects.
   */
  closeOpenAiConnection() {
    if (this.openAiWs && this.openAiWs.readyState === ws.WebSocket.OPEN) {
      this.openAiWs.close();
    }
  }
}
