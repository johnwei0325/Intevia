import { Base64 } from 'js-base64';
import { TranscriptionService } from './transcriptionService';
import { pcmToWav } from '../utils/audioUtils';
import { GeminiService } from './geminiService';
import { PerplexityService } from './perplexityService';

const MODEL = "models/gemini-2.0-flash-exp";
const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
const HOST = "generativelanguage.googleapis.com";
const WS_URL = `wss://${HOST}/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${API_KEY}`;

class Response {
  text: string | null = null;
  audioData: string | null = null;
  endOfTurn: boolean = false;

  constructor(data: any) {
    if (data.serverContent?.modelTurn?.parts) {
      const parts = data.serverContent.modelTurn.parts;
      for (const part of parts) {
        if (part.text) {
          this.text = part.text;
        }
        if (part.audio) {
          this.audioData = part.audio.data;
        }
      }
    }

    if (data.serverContent?.turnComplete === true) {
      this.endOfTurn = true;
    }
  }
}

export class GeminiWebSocket {
  private ws: WebSocket | null = null;
  private accumulatedText: string = '';
  private geminiService: GeminiService;
  private webSearchProcessed: boolean = false;
  private isConnected: boolean = false;
  private isSetupComplete: boolean = false;
  private onMessageCallback?: (text: string) => void;
  private onSetupCompleteCallback?: () => void;
  private onPlayingStateChangeCallback?: (isPlaying: boolean) => void;
  private onAudioLevelChangeCallback?: (level: number) => void;
  private onTranscriptionCallback?: (text: string) => void;
  private onImagesCallback?: (images: { image_url: string, origin_url: string }[]) => void;
  private onCitationsCallback?: (citations: { url: string, title: string }[]) => void;
  private audioContext: AudioContext | null = null;
  private transcriptionService: TranscriptionService;
  private accumulatedPcmData: string[] = [];
  private isVoiceEnabled: boolean = false;
  private isPlaying: boolean = false;
  private isPlayingResponse: boolean = false;
  private audioQueue: Float32Array[] = [];
  private currentSource: AudioBufferSourceNode | null = null;
  private searchEngine: string = 'gemini'; // Default search engine
  private mediaRecorder: MediaRecorder | null = null;

  constructor(
    onMessage: (text: string) => void, 
    onSetupComplete: () => void,
    onPlayingStateChange: (isPlaying: boolean) => void,
    onAudioLevelChange: (level: number) => void,
    onTranscription: (text: string) => void,
    onImages: (images: { image_url: string, origin_url: string }[]) => void,
    onCitations: (citations: { url: string, title: string }[]) => void
  ) {
    this.onMessageCallback = onMessage;
    this.onSetupCompleteCallback = onSetupComplete;
    this.onPlayingStateChangeCallback = onPlayingStateChange;
    this.onAudioLevelChangeCallback = onAudioLevelChange;
    this.onTranscriptionCallback = onTranscription;
    this.onImagesCallback = onImages;
    this.onCitationsCallback = onCitations;
    this.geminiService = new GeminiService();
    
    // Create AudioContext for playback
    this.audioContext = new AudioContext({
      sampleRate: 24000  // Match the response audio rate
    });
    this.transcriptionService = new TranscriptionService();
    
    // 從 localStorage 獲取搜索引擎設置
    const storedSearchEngine = localStorage.getItem('search_engine');
    if (storedSearchEngine) {
      this.searchEngine = storedSearchEngine;
    }
  }

  connect(forceConnect: boolean = false) {
    console.log("[WebSocket] Attempting to connect to:", WS_URL);
    console.log("[WebSocket] Current voice state:", this.isVoiceEnabled);
    
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log("[WebSocket] Already connected, skipping connection");
      return;
    }
    
    if (this.ws?.readyState === WebSocket.CONNECTING) {
      console.log("[WebSocket] Connection in progress, skipping connection");
      return;
    }
    
    // 如果不是強制連接且已經設置完成，則跳過
    if (!forceConnect && this.isSetupComplete) {
      console.log("[WebSocket] Setup already complete, skipping connection");
      return;
    }
    
    this.ws = new WebSocket(WS_URL);

    this.ws.onopen = () => {
      console.log("[WebSocket] Connection established");
      this.isConnected = true;
      this.sendInitialSetup();
    };

    this.ws.onmessage = async (event) => {
      try {
        let messageText: string;
        if (event.data instanceof Blob) {
          const arrayBuffer = await event.data.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          messageText = new TextDecoder('utf-8').decode(bytes);
        } else {
          messageText = event.data;
        }
        
        console.log("[WebSocket] Received message:", messageText);
        await this.handleMessage(messageText);
      } catch (error) {
        console.error("[WebSocket] Error processing message:", error);
      }
    };

    this.ws.onerror = (error) => {
      console.error("[WebSocket] Connection error:", error);
    };

    this.ws.onclose = (event) => {
      console.log("[WebSocket] Connection closed:", event.code, event.reason);
      this.isConnected = false;
      
      // 如果是正常關閉（代碼 1000），則不自動重新連接
      if (event.code === 1000) {
        console.log("[WebSocket] Connection closed normally, not attempting to reconnect");
        return;
      }
      
      // 如果是異常關閉，則嘗試重新連接
      console.log("[WebSocket] Connection closed abnormally, attempting to reconnect in 2 seconds");
      setTimeout(() => {
        if (!this.isConnected) {
          console.log("[WebSocket] Attempting to reconnect...");
          this.connect(true);
        }
      }, 2000);
    };
  }

  private sendInitialSetup() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.log("[WebSocket] Cannot send initial setup: WebSocket not open");
      return;
    }

    console.log("[WebSocket] Sending initial setup with voice enabled:", this.isVoiceEnabled);
    const setupMessage = {
      setup: {
        model: MODEL,
        generation_config: {
          response_modalities: this.isVoiceEnabled ? ["AUDIO"] : ["TEXT"]
        },
        ...(this.isVoiceEnabled ? {
          system_instruction: {
            parts: [{
              text: "I'm talking Chinese, but please use English to answer all questions."
            }]
          }
        } : {
          system_instruction: {
            parts: [{
              text: "You are an AI assistant in a meeting. Your role is to quietly listen to the conversation and only respond when needed. Rules: 1. DO NOT ask questions or take initiative. 2. DO NOT respond to greetings, simple confirmations, or small talk, such as asking your name. 3. ONLY respond when the speaker says something that: - Clearly asks for information or help - Involves a technical or complex question that likely needs expert assistance - Implies confusion or the speaker may need clarification 4. If no response is needed, return 'NULL' 5. NEVER ask questions back to the speaker. You are only here to support quietly when necessary. 6. For screen-related questions: - If the user mentions anything about the screen, display, or visual content, respond with exactly '[SCREEN_REQUEST]' - After receiving the screen capture, analyze it and provide your answer 7. For web search requests: - If the user asks for current information, news, or facts that might require up-to-date knowledge, respond with exactly '[WEB_SEARCH_REQUEST]' followed by the search question, please determine why the user is asking for this information, and ask a concise but detailed question as query. 8. For non-screen questions, answer directly with audio. Remember: You are a silent assistant. Respond only when it truly helps. And don't ever ask any questions!!!"
            }]
          }
        })
      }
    };
    console.log("[WebSocket] Setup message:", setupMessage);
    this.ws.send(JSON.stringify(setupMessage));
    this.isSetupComplete = true;
    console.log("[WebSocket] Initial setup sent successfully");
  }

  // Add a method to reinitialize the model with different response modalities
  reinitializeModel(isVoiceEnabled: boolean, forceReinitialize: boolean = false) {
    console.log(`[WebSocket] 當前模式: ${this.isVoiceEnabled ? '語音模式' : '文字模式'}`);
    console.log(`[WebSocket] 切換後模式: ${isVoiceEnabled ? '語音模式' : '文字模式'}`);
    
    // 如果狀態沒有變化且不是強制重新初始化，則跳過
    if (this.isVoiceEnabled === isVoiceEnabled && !forceReinitialize) {
      console.log(`[WebSocket] 語音狀態未變化，跳過重新初始化`);
      return;
    }
    
    // 更新語音狀態
    this.isVoiceEnabled = isVoiceEnabled;
    console.log(`[WebSocket] 模型重新初始化，模式: ${this.isVoiceEnabled ? '語音模式' : '文字模式'}`);
    
    // 斷開當前連接
    this.disconnect();
    
    // 創建新連接
    setTimeout(() => {
      this.connect(true);
    }, 500);
  }

  sendMediaChunk(b64Data: string, mimeType: string) {
    if (!this.isConnected || !this.ws || !this.isSetupComplete) return;

    const message = {
      realtime_input: {
        media_chunks: [{
          mime_type: mimeType === "audio/pcm" ? "audio/pcm" : mimeType,
          data: b64Data
        }]
      }
    };

    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error("[WebSocket] Error sending media chunk:", error);
    }
  }

  private async playAudioResponse(base64Data: string) {
    console.log("[WebSocket] Playing audio response");
    
    if (!this.audioContext) {
      console.log("[WebSocket] Audio context not initialized, creating new one");
      this.audioContext = new AudioContext();
    }

    try {
      // Decode base64 to bytes
      console.log("[WebSocket] Decoding base64 audio data");
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Convert to Int16Array (PCM format)
      console.log("[WebSocket] Converting to PCM format");
      const pcmData = new Int16Array(bytes.buffer);
      
      // Convert to float32 for Web Audio API
      console.log("[WebSocket] Converting to float32 for Web Audio API");
      const float32Data = new Float32Array(pcmData.length);
      for (let i = 0; i < pcmData.length; i++) {
        float32Data[i] = pcmData[i] / 32768.0;
      }

      // Add to queue and start playing if not already playing
      console.log("[WebSocket] Adding audio to queue");
      this.audioQueue.push(float32Data);
      this.playNextInQueue();
    } catch (error) {
      console.error("[WebSocket] Error processing audio:", error);
    }
  }

  private async playNextInQueue() {
    console.log("[WebSocket] Playing next audio in queue");
    
    if (!this.audioContext) {
      console.log("[WebSocket] Audio context not initialized, cannot play audio");
      return;
    }
    
    if (this.isPlaying) {
      console.log("[WebSocket] Already playing audio, skipping");
      return;
    }
    
    if (this.audioQueue.length === 0) {
      console.log("[WebSocket] Audio queue is empty, nothing to play");
      return;
    }

    try {
      console.log("[WebSocket] Starting to play audio");
      this.isPlaying = true;
      this.isPlayingResponse = true;
      this.onPlayingStateChangeCallback?.(true);
      
      const float32Data = this.audioQueue.shift()!;
      const audioBuffer = this.audioContext.createBuffer(1, float32Data.length, 24000);
      audioBuffer.getChannelData(0).set(float32Data);

      this.currentSource = this.audioContext.createBufferSource();
      this.currentSource.buffer = audioBuffer;
      this.currentSource.connect(this.audioContext.destination);
      
      this.currentSource.onended = () => {
        console.log("[WebSocket] Audio playback ended");
        this.isPlaying = false;
        this.currentSource = null;
        if (this.audioQueue.length === 0) {
          console.log("[WebSocket] Audio queue is empty, stopping response");
          this.isPlayingResponse = false;
          this.onPlayingStateChangeCallback?.(false);
        }
        this.playNextInQueue();
      };

      console.log("[WebSocket] Starting audio playback");
      this.currentSource.start();
    } catch (error) {
      console.error("[WebSocket] Error playing audio:", error);
      this.isPlaying = false;
      this.isPlayingResponse = false;
      this.onPlayingStateChangeCallback?.(false);
      this.currentSource = null;
      this.playNextInQueue();
    }
  }

  private stopCurrentAudio() {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch (e) {
        // Ignore errors if already stopped
      }
      this.currentSource = null;
    }
    this.isPlaying = false;
    this.isPlayingResponse = false;
    this.onPlayingStateChangeCallback?.(false);
    this.audioQueue = []; // Clear queue
  }

  private async handleMessage(message: string) {
    try {
      // 重置 webSearchProcessed 標誌
      this.webSearchProcessed = false;
      
      const messageData = JSON.parse(message);
      
      if (messageData.setupComplete) {
        console.log("[WebSocket] Setup complete received");
        console.log("[WebSocket] Current voice state:", this.isVoiceEnabled);
        this.isSetupComplete = true;
        this.onSetupCompleteCallback?.();
        return;
      }

      // Handle audio data directly from the message
      if (messageData.serverContent?.modelTurn?.parts) {
        const parts = messageData.serverContent.modelTurn.parts;
        for (const part of parts) {
          if (part.inlineData?.mimeType === "audio/pcm;rate=24000") {
            console.log("[WebSocket] Received audio data");
            this.accumulatedPcmData.push(part.inlineData.data);
            this.playAudioResponse(part.inlineData.data);
          }
          if (part.text) {
            // 打印所有文本，包括 [WEB_SEARCH_REQUEST]
            console.log("[WebSocket] Received text data:", part.text);
            this.accumulatedText += part.text;
          }
        }
      }

      // Check for end of turn
      if (messageData.serverContent?.turnComplete === true) {
        console.log("[WebSocket] Turn complete received");
        console.log("[WebSocket] Final accumulated text:", this.accumulatedText);
        
        // Check if this is a web search request
        if (this.accumulatedText.includes('[WEB_SEARCH_REQUEST]')) {
          console.log("[WebSocket] Detected web search request");
          
          // Extract the search query
          const match = this.accumulatedText.match(/\[WEB_SEARCH_REQUEST\](.*)/);
          if (match && match[1]) {
            const query = match[1].trim();
            console.log("[WebSocket] Extracted search query:", query);
            
            // Set flag to prevent duplicate processing
            if (this.webSearchProcessed) {
              console.log("[WebSocket] Web search already processed, skipping");
              return;
            }
            this.webSearchProcessed = true;
            
            try {
              // Perform web search using the selected engine
              console.log("[WebSocket] Initiating search for query:", query);
              let searchResult;
              
              if (this.searchEngine === 'perplexity') {
                // Use Perplexity service
                const perplexityService = PerplexityService.getInstance();
                searchResult = await perplexityService.search(query);
                console.log("[WebSocket] Perplexity search completed successfully");
              } else {
                // Use Gemini service
                searchResult = await this.geminiService.search(query);
                console.log("[WebSocket] Gemini search completed successfully");
              }
              
              console.log("[WebSocket] Search result:", searchResult);
              
              if (searchResult) {
                console.log("[WebSocket] Processing search response:", searchResult);
                
                // 構建包含所有元素的回應
                let fullResponse = searchResult.answer;
                
                // 添加引用
                if (searchResult.citations && searchResult.citations.length > 0) {
                  console.log("[WebSocket] Adding citations to response");
                  fullResponse += '\n\n[CITATIONS]\n';
                  fullResponse += searchResult.citations.map(citation => 
                    `[${citation.title}](${citation.url})`
                  ).join('\n');
                }
                
                // 添加 search_entry_point
                if (searchResult.search_entry_point) {
                  console.log("[WebSocket] Found search_entry_point:", searchResult.search_entry_point);
                  fullResponse += '\n\n[SEARCH_ENTRY_POINT]\n';
                  fullResponse += searchResult.search_entry_point;
                  console.log("[WebSocket] Added search_entry_point to response");
                } else {
                  console.log("[WebSocket] No search_entry_point found in response");
                }
                
                // Send the complete response back to the user
                console.log("[WebSocket] Sending full response:", fullResponse);
                this.onMessageCallback?.(fullResponse);
                
                // 處理圖片
                if (searchResult.images && searchResult.images.length > 0) {
                  console.log("[WebSocket] Found images in search result:", searchResult.images.length);
                  const images = searchResult.images.map(img => ({
                    image_url: img.url,
                    origin_url: img.url
                  }));
                  this.onImagesCallback?.(images);
                }
                
                // 處理引用
                if (searchResult.citations && searchResult.citations.length > 0) {
                  console.log("[WebSocket] Found citations in search result:", searchResult.citations.length);
                  const citations = searchResult.citations.map(citation => ({
                    url: citation.url,
                    title: citation.title
                  }));
                  this.onCitationsCallback?.(citations);
                }
              } else {
                console.error("[WebSocket] No search results found in search result");
                this.onMessageCallback?.("I couldn't find any information on that topic.");
              }
          } catch (error) {
              console.error("[WebSocket] Search error:", error);
              this.onMessageCallback?.("Sorry, I encountered an error while searching. Please try again.");
            }
            
            // Clear accumulated text after processing web search request
            console.log("[WebSocket] Clearing accumulated text after web search");
            this.accumulatedText = '';
          }
        } else {
          // 如果不是 web 搜索請求，則發送累積的文本
          if (this.accumulatedText && this.accumulatedText !== "...") {
            console.log("[WebSocket] Sending accumulated text to callback:", this.accumulatedText);
            this.onMessageCallback?.(this.accumulatedText);
          }
          this.accumulatedText = ''; // Reset accumulated text
        }
      }
    } catch (error) {
      console.error("[WebSocket] Error handling message:", error);
      this.onMessageCallback?.("Sorry, I encountered an error. Please try again.");
    }
  }

  disconnect() {
    console.log("[WebSocket] Disconnecting with voice enabled:", this.isVoiceEnabled);
    
    if (!this.ws) {
      console.log("[WebSocket] No WebSocket connection to close");
      return;
    }
    
    if (this.ws.readyState !== WebSocket.OPEN && this.ws.readyState !== WebSocket.CONNECTING) {
      console.log("[WebSocket] WebSocket is not open or connecting, skipping disconnect");
      return;
    }
    
    this.isSetupComplete = false;
    console.log("[WebSocket] Closing WebSocket connection");
      this.ws.close(1000, "Intentional disconnect");
      this.ws = null;
    this.isConnected = false;
    this.accumulatedText = ''; // Clear accumulated text
    this.accumulatedPcmData = []; // Clear accumulated PCM data
    console.log("[WebSocket] Disconnected successfully");
    
    // 如果是語音模式，則在斷開連接後自動重新連接
    if (this.isVoiceEnabled) {
      console.log("[WebSocket] Voice mode is enabled, will attempt to reconnect automatically");
      setTimeout(() => {
        if (!this.isConnected) {
          console.log("[WebSocket] Attempting to reconnect after disconnect...");
          this.connect(true);
        }
      }, 1000);
    }
  }

  sendFollowUpRequest(imageData: string, text: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error("[WebSocket] Cannot send follow-up request: WebSocket is not in OPEN state");
      return;
    }
    
    // First send the image
    this.sendMediaChunk(imageData, "image/jpeg");
    
    // Then send the text
    const textMessage = {
      realtime_input: {
        text: text
      }
    };
    
    try {
      this.ws.send(JSON.stringify(textMessage));
    } catch (error) {
      console.error("[WebSocket] Error sending follow-up request:", error);
    }
  }

  // Add this method to check connection status
  checkConnectionStatus(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }

  // Add this method to set the search engine
  setSearchEngine(engine: string) {
    this.searchEngine = engine;
  }
} 