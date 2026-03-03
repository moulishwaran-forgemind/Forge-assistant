/**
 * Forge AI - Gemini Multimodal Live API client
 * Endpoint: v1beta BidiGenerateContent
 */
export class LiveAPI {
  constructor(apiKey, model = 'gemini-2.5-flash-native-audio-preview-12-2025') {
    this.apiKey = apiKey;
    this.model = model;
    this.ws = null;
    this.connectTimer = null;

    this.onAudioData = null;      // (base64Pcm16) => void
    this.onTextData = null;       // (textChunk) => void
    this.onToolCall = null;       // (functionCalls) => void
    this.onTurnComplete = null;   // () => void
    this.onStatusChange = null;   // (status) => void
    this.onError = null;          // (message) => void
  }

  connect(config = {}) {
    const url =
      'wss://generativelanguage.googleapis.com/ws/' +
      'google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent' +
      `?key=${this.apiKey}`;

    this.onStatusChange?.('connecting');
    this.ws = new WebSocket(url);

    this.connectTimer = setTimeout(() => {
      if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
        this.ws.close();
        this.onError?.(
          'Connection timed out (12s). Check API key and network access to generativelanguage.googleapis.com.'
        );
        this.onStatusChange?.('disconnected');
      }
    }, 12000);

    this.ws.onopen = () => {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
      this.ws.send(JSON.stringify(this.buildSetup(config)));
    };

    this.ws.onmessage = async (event) => {
      try {
        const text = event.data instanceof Blob ? await event.data.text() : event.data;
        const payload = JSON.parse(text);
        this.handleMessage(payload);
      } catch (error) {
        this.onError?.(`Response parse error: ${error.message}`);
      }
    };

    this.ws.onerror = () => {
      this.onStatusChange?.('error');
    };

    this.ws.onclose = (event) => {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;

      if (event.code === 1006) {
        this.onError?.('Connection failed (1006). API key may be invalid or network blocked.');
      } else if (event.code === 1008 || event.code === 4000) {
        this.onError?.(`Server rejected the request (${event.code}).`);
      } else if (event.code !== 1000 && event.code !== 1001) {
        this.onError?.(`Unexpected close (${event.code})${event.reason ? `: ${event.reason}` : ''}.`);
      }

      this.onStatusChange?.('disconnected');
    };
  }

  buildSetup(config) {
    const responseModalities = config.responseModalities || ['AUDIO'];

    const setup = {
      setup: {
        model: `models/${this.model}`,
        generationConfig: {
          responseModalities,
        },
        systemInstruction: {
          parts: [{
            text:
              'You are Forge, a concise and useful AI assistant. ' +
              'Always reply in Tanglish (Tamil + English mix) using only Latin/Roman letters. ' +
              'Do not reply in pure Tamil script. Keep responses short, natural, and conversational.',
          }],
        },
      },
    };

    if (this.model !== 'gemini-2.0-flash-exp') {
      setup.setup.generationConfig.speechConfig = {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Puck' },
        },
      };
    }

    if (config.tools?.length) {
      setup.setup.tools = config.tools;
    }

    return setup;
  }

  handleMessage(payload) {
    if ('setupComplete' in payload) {
      this.onStatusChange?.('connected');
      return;
    }

    const serverContent = payload.serverContent;
    if (serverContent?.modelTurn?.parts) {
      for (const part of serverContent.modelTurn.parts) {
        if (typeof part.text === 'string' && part.text.length > 0) {
          this.onTextData?.(part.text);
        }

        if (part.inlineData?.data) {
          this.onAudioData?.(part.inlineData.data);
        }

        if (part.functionCall && this.onToolCall) {
          this.onToolCall([part.functionCall]);
        }
      }
    }

    if (serverContent?.turnComplete) {
      this.onTurnComplete?.();
    }

    if (payload.toolCall?.functionCalls && this.onToolCall) {
      this.onToolCall(payload.toolCall.functionCalls);
    }
  }

  sendAudio(base64Pcm16) {
    this.send({
      realtimeInput: {
        mediaChunks: [{ mimeType: 'audio/pcm;rate=16000', data: base64Pcm16 }],
      },
    });
  }

  sendToolResponse(responses) {
    this.send({
      toolResponse: {
        functionResponses: responses.map(({ id, name, response }) => ({
          id,
          name,
          response,
        })),
      },
    });
  }

  send(payload) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  disconnect() {
    clearTimeout(this.connectTimer);
    this.connectTimer = null;
    this.ws?.close();
    this.ws = null;
  }
}
