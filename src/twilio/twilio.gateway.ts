import {
    WebSocketGateway,
    OnGatewayConnection,
    OnGatewayDisconnect,
  } from '@nestjs/websockets';
  import { WebSocket as WsWebSocket, RawData } from 'ws'; // from the 'ws' library
  import { Logger } from '@nestjs/common';
  import { OpenAiService } from '../openai/openai.service';
  
  @WebSocketGateway({
    path: '/media-stream', // Twilio <Stream> connects here
  })
  export class TwilioGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly logger = new Logger(TwilioGateway.name);
  
    // Store reference to the Twilio <-> Nest WebSocket
    // so we can send OpenAI audio deltas back to Twilio.
    private clientSocket: WsWebSocket | null = null;
    private streamSid: string | null = null;
  
    constructor(private readonly openAiService: OpenAiService) {}
  
    /**
     * Fired when Twilio connects its raw WebSocket to /media-stream.
     * We'll attach a 'message' listener to receive Twilio events.
     */
    handleConnection(client: WsWebSocket) {
      this.logger.log('Client connected to /media-stream');
      this.clientSocket = client;
  
      // Listen for any 'message' from Twilio
      client.on('message', (rawData: RawData) => {
        let data: any;
        try {
          data = JSON.parse(rawData.toString());
        } catch (err) {
          this.logger.error(`[TwilioGateway] Invalid JSON: ${rawData.toString()}`);
          return;
        }
        this.handleTwilioMessage(data);
      });
  
      // (Optional) Initialize or pass the connection to your OpenAiService
      // so it can store references or do any startup logic.
      this.openAiService.setupOpenAiConnection(this.clientSocket, this.sendAudioToTwilio.bind(this));
    }
  
    /**
     * Fired when Twilio disconnects the WebSocket (hangs up the call, etc.).
     */
    handleDisconnect(client: WsWebSocket) {
      this.logger.log('Client disconnected from /media-stream');
      // Clean up the OpenAI connection
      this.openAiService.closeOpenAiConnection();
      this.streamSid = null;
      this.clientSocket = null;
    }
  
    /**
     * Handle Twilio’s inbound JSON events: { event: 'start' | 'media' | etc. }
     * Forward audio frames to OpenAiService if needed.
     * Capture the streamSid from 'start'.
     */
    private handleTwilioMessage(data: any) {
      switch (data?.event) {
        case 'start':
          this.streamSid = data.start?.streamSid;
          this.logger.log(`Twilio media stream started with streamSid: ${this.streamSid}`);
          break;
  
        case 'media':
          // Forward the 'media' payload to OpenAI
          this.openAiService.processTwilioMedia(data);
          break;
  
        default:
          this.logger.log(`Received non-media event: ${data.event}`);
          break;
      }
    }
  
    /**
     * When OpenAiService receives `response.audio.delta`, it can call this method
     * to send the audio chunk back to Twilio. *Make sure* the streamSid is set.
     */
    private sendAudioToTwilio(base64Audio: string) {
      if (!this.clientSocket || !this.streamSid) {
        // Can't send if we don't have an active Twilio connection or streamSid
        return;
      }
  
      const audioDelta = {
        event: 'media',
        streamSid: this.streamSid,
        media: {
          payload: base64Audio, // must be base64 G.711 if you want Twilio to play it
        },
      };
  
      // Send the JSON to Twilio
      this.clientSocket.send(JSON.stringify(audioDelta));
    }
  }
  