// app/components/CameraPreview.tsx
"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Monitor, MonitorOff, Volume2, VolumeX, Image, Search } from "lucide-react";
import { GeminiWebSocket } from '../services/geminiWebSocket';
import { Base64 } from 'js-base64';
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import ImageGallery from './ImageGallery';
import SearchEntryPoint from './SearchEntryPoint';
import { useRouter } from "next/navigation";

interface CameraPreviewProps {
  onTranscription: (text: string) => void;
  isVoiceEnabled: boolean;
}

export default function CameraPreview({ onTranscription, isVoiceEnabled }: CameraPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const geminiWsRef = useRef<GeminiWebSocket | null>(null);
  const videoCanvasRef = useRef<HTMLCanvasElement>(null);
  const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null);
  const [isAudioSetup, setIsAudioSetup] = useState(false);
  const setupInProgressRef = useRef(false);
  const [isWebSocketReady, setIsWebSocketReady] = useState(false);
  const imageIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isModelSpeaking, setIsModelSpeaking] = useState(false);
  const [outputAudioLevel, setOutputAudioLevel] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [currentMessage, setCurrentMessage] = useState('');
  const [pendingMessage, setPendingMessage] = useState('');
  const [searchImages, setSearchImages] = useState<Array<{ image_url: string, origin_url: string }>>([]);
  const [showImageGallery, setShowImageGallery] = useState(false);
  const [citations, setCitations] = useState<Array<{ url: string, title: string }>>([]);
  const [webSearchProcessed, setWebSearchProcessed] = useState(false);
  const [searchEntryPoint, setSearchEntryPoint] = useState<string | null>(null);
  const router = useRouter();

  const cleanupAudio = useCallback(() => {
    if (audioWorkletNodeRef.current) {
      audioWorkletNodeRef.current.disconnect();
      audioWorkletNodeRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, []);

  const cleanupWebSocket = useCallback(() => {
    if (geminiWsRef.current) {
      geminiWsRef.current.disconnect();
    }
    setIsWebSocketReady(false);
    setConnectionStatus('disconnected');
  }, []);

  const handleGeminiMessage = (text: string) => {
    console.log("[CameraPreview] Received Gemini message:", text);
    
    // 檢查是否包含 [SEARCH_ENTRY_POINT] 標記
    if (text.includes('[SEARCH_ENTRY_POINT]')) {
      console.log("[CameraPreview] Found [SEARCH_ENTRY_POINT] tag");
      const parts = text.split('[SEARCH_ENTRY_POINT]');
      if (parts.length > 1) {
        const searchEntryPointHtml = parts[1].trim();
        console.log("[CameraPreview] Extracted search_entry_point HTML:", searchEntryPointHtml);
        setSearchEntryPoint(searchEntryPointHtml);
        
        // 創建一個自定義事件，將 search_entry_point 傳遞到搜索頁面
        const event = new CustomEvent('searchEntryPointUpdate', {
          detail: { searchEntryPoint: searchEntryPointHtml }
        });
        window.dispatchEvent(event);
        
        // 將 search_entry_point 保存到 localStorage
        localStorage.setItem('search_entry_point', searchEntryPointHtml);
      }
    } else {
      // 如果沒有找到標記，清除之前的 search_entry_point
      setSearchEntryPoint(null);
    }
    
    // 更新消息，但移除 [SEARCH_ENTRY_POINT] 部分
    const messageWithoutSearchEntry = text.replace(/\[SEARCH_ENTRY_POINT\][\s\S]*$/, '').trim();
    setCurrentMessage(messageWithoutSearchEntry);
    if (messageWithoutSearchEntry !== '...') {
      onTranscription(messageWithoutSearchEntry);
    }
  };

  const handleImages = (images: Array<{ image_url: string, origin_url: string }>) => {
    console.log("[Camera] Received images:", images);
    setSearchImages(images);
    
    // 創建一個自定義事件，將圖片數據傳遞到主頁面
    const event = new CustomEvent('imagesUpdate', {
      detail: { images }
    });
    window.dispatchEvent(event);
  };

  const closeImageGallery = () => {
    setShowImageGallery(false);
  };

  const initializeWebSocket = useCallback(() => {
    if (geminiWsRef.current) {
      geminiWsRef.current.disconnect();
    }

    geminiWsRef.current = new GeminiWebSocket(
      handleGeminiMessage,
      () => {
        console.log("[CameraPreview] WebSocket setup complete");
        setIsWebSocketReady(true);
        setConnectionStatus('connected');
      },
      (isPlaying) => {
        setIsModelSpeaking(isPlaying);
      },
      (level) => {
        setOutputAudioLevel(level);
      },
      onTranscription,
      handleImages,
      (citations) => {
        console.log("[CameraPreview] Received citations:", citations);
        setCitations(citations);
        
        // 創建一個自定義事件，將引用數據傳遞到主頁面
        const event = new CustomEvent('citationsUpdate', {
          detail: { citations }
        });
        window.dispatchEvent(event);
      }
    );

    geminiWsRef.current.connect();
    setConnectionStatus('connecting');
  }, [onTranscription]);

  // Simplify sendAudioData to just send continuously
  const sendAudioData = (b64Data: string) => {
    if (!geminiWsRef.current) return;
    geminiWsRef.current.sendMediaChunk(b64Data, "audio/pcm");
  };

  const toggleScreenCapture = async () => {
    if (isStreaming && stream) {
      setIsStreaming(false);
      // 只有在點擊螢幕圖標按鈕時才斷開 WebSocket 連接
      cleanupWebSocket();
      cleanupAudio();
      stream.getTracks().forEach(track => track.stop());
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setStream(null);
    } else {
      try {
        // 先初始化 WebSocket 連接
        initializeWebSocket();
        
        // Request permissions first
        const permissions = await navigator.permissions.query({ name: 'camera' as PermissionName });
        if (permissions.state === 'denied') {
          throw new Error('Display capture permission denied');
        }

        // Get screen capture stream with specific constraints for Electron
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ 
          video: {
            displaySurface: "monitor",
            frameRate: { ideal: 30 }
          },
          audio: false
        });

        // Request audio permissions
        const audioPermissions = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        if (audioPermissions.state === 'denied') {
          throw new Error('Microphone permission denied');
        }

        // Get system audio stream with specific constraints
        const audioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 16000,
            channelCount: 1
          }
        });

        // Initialize audio context
        if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
          audioContextRef.current = new AudioContext({
            sampleRate: 16000,
            latencyHint: 'interactive'
          });
        }

        // Ensure audio context is running
        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }

        // Set up video
        if (videoRef.current) {
          videoRef.current.srcObject = screenStream;
          videoRef.current.muted = true;
        }

        // Combine streams
        const tracks = [
          ...screenStream.getVideoTracks(),
          ...audioStream.getAudioTracks()
        ];

        const combinedStream = new MediaStream(tracks);

        // Handle stream stop
        tracks.forEach(track => {
          track.onended = () => {
            console.log('Track ended:', track.kind);
            if (isStreaming) {
              toggleScreenCapture();
            }
          };
        });

        setStream(combinedStream);
        setIsStreaming(true);

        console.log('Media streams initialized successfully:', {
          video: screenStream.getVideoTracks().length > 0,
          audio: audioStream.getAudioTracks().length > 0
        });

      } catch (err) {
        console.error('Error accessing media devices:', err);
        if (err instanceof Error) {
          console.error('Error name:', err.name);
          console.error('Error message:', err.message);
        }
        alert('Permission denied. Please enable screen recording and microphone access in System Settings > Privacy & Security.');
        cleanupAudio();
        // 確保在權限被拒絕時不會改變按鈕狀態
        setIsStreaming(false);
        setStream(null);
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
        // 確保在權限被拒絕時不會改變按鈕狀態
        cleanupWebSocket();
      }
    }
  };

  // Initialize WebSocket connection
  useEffect(() => {
    if (!isStreaming) {
      setConnectionStatus('disconnected');
      return;
    }

    // 不再自動初始化 WebSocket
    // setConnectionStatus('connecting');
    // initializeWebSocket();

    return () => {
      if (imageIntervalRef.current) {
        clearInterval(imageIntervalRef.current);
        imageIntervalRef.current = null;
      }
      // 不再在組件卸載時斷開 WebSocket 連接
      // cleanupWebSocket();
      // setIsWebSocketReady(false);
      // setConnectionStatus('disconnected');
    };
  }, [isStreaming]);

  // 當 isVoiceEnabled 變化時重新初始化模型
  useEffect(() => {
    console.log("[Camera] Voice state changed:", isVoiceEnabled);
    
    if (!isStreaming) {
      console.log("[Camera] Not streaming, skipping reinitialization");
      return;
    }
    
    if (!geminiWsRef.current) {
      console.log("[Camera] WebSocket not initialized, skipping reinitialization");
      return;
    }
    
    if (!isWebSocketReady) {
      console.log("[Camera] WebSocket not ready, attempting to reconnect...");
      initializeWebSocket();
      return;
    }
    
    // 檢查是否是從外部事件觸發的
    const isFromEvent = window.event?.type === 'voiceStateChanged';
    
    console.log("[Camera] Reinitializing model with voice enabled:", isVoiceEnabled);
    geminiWsRef.current.reinitializeModel(isVoiceEnabled, isFromEvent);
  }, [isVoiceEnabled, isStreaming, isWebSocketReady, initializeWebSocket]);

  // 在 audio mode 下自動截圖
  useEffect(() => {
    if (!isStreaming || !isWebSocketReady || !isVoiceEnabled) {
      if (imageIntervalRef.current) {
        clearInterval(imageIntervalRef.current);
        imageIntervalRef.current = null;
      }
      return;
    }

    console.log("[Camera] Starting automatic screen capture in audio mode");
    imageIntervalRef.current = setInterval(() => {
      if (!videoRef.current || !videoCanvasRef.current || !geminiWsRef.current) return;

      const canvas = videoCanvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;

      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      context.drawImage(videoRef.current, 0, 0);
      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      const b64Data = imageData.split(',')[1];
      geminiWsRef.current.sendMediaChunk(b64Data, "image/jpeg");
    }, 3000); // 每3秒截圖一次

    return () => {
      if (imageIntervalRef.current) {
        clearInterval(imageIntervalRef.current);
        imageIntervalRef.current = null;
      }
    };
  }, [isStreaming, isWebSocketReady, isVoiceEnabled]);

  // Start image capture only after WebSocket is ready
  useEffect(() => {
    if (!isStreaming || !isWebSocketReady) return;

    console.log("[Camera] WebSocket ready, waiting for screen capture requests");
    return () => {
      if (imageIntervalRef.current) {
        clearInterval(imageIntervalRef.current);
        imageIntervalRef.current = null;
      }
    };
  }, [isStreaming, isWebSocketReady]);

  // Update audio processing setup
  useEffect(() => {
    if (!isStreaming || !stream || !audioContextRef.current || 
        !isWebSocketReady || isAudioSetup || setupInProgressRef.current) return;

    let isActive = true;
    setupInProgressRef.current = true;

    const setupAudioProcessing = async () => {
      try {
        const ctx = audioContextRef.current;
        if (!ctx || ctx.state === 'closed' || !isActive) {
          setupInProgressRef.current = false;
          return;
        }

        if (ctx.state === 'suspended') {
          await ctx.resume();
        }

        await ctx.audioWorklet.addModule('/worklets/audio-processor.js');

        if (!isActive) {
          setupInProgressRef.current = false;
          return;
        }

        audioWorkletNodeRef.current = new AudioWorkletNode(ctx, 'audio-processor', {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          processorOptions: {
            sampleRate: 16000,
            bufferSize: 4096,
          },
          channelCount: 1,
          channelCountMode: 'explicit',
          channelInterpretation: 'speakers'
        });

        const source = ctx.createMediaStreamSource(stream);
        audioWorkletNodeRef.current.port.onmessage = (event) => {
          if (!isActive || isModelSpeaking || !geminiWsRef.current?.checkConnectionStatus()) return;
          const { pcmData, level } = event.data;
          setAudioLevel(level);

          const pcmArray = new Uint8Array(pcmData);
          const b64Data = Base64.fromUint8Array(pcmArray);
          sendAudioData(b64Data);
        };

        source.connect(audioWorkletNodeRef.current);
        setIsAudioSetup(true);
        setupInProgressRef.current = false;

        return () => {
          source.disconnect();
          if (audioWorkletNodeRef.current) {
            audioWorkletNodeRef.current.disconnect();
          }
          setIsAudioSetup(false);
        };
      } catch (error) {
        if (isActive) {
          cleanupAudio();
          setIsAudioSetup(false);
        }
        setupInProgressRef.current = false;
      }
    };

    console.log("[Camera] Starting audio processing setup");
    setupAudioProcessing();

    return () => {
      isActive = false;
      setIsAudioSetup(false);
      setupInProgressRef.current = false;
      if (audioWorkletNodeRef.current) {
        audioWorkletNodeRef.current.disconnect();
        audioWorkletNodeRef.current = null;
      }
    };
  }, [isStreaming, stream, isWebSocketReady, isModelSpeaking]);

  // Capture and send image
  const captureAndSendImage = () => {
    if (!videoRef.current || !videoCanvasRef.current || !geminiWsRef.current) return;

    const canvas = videoCanvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;

    // Set canvas size to match video
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;

    // Draw video frame to canvas
    context.drawImage(videoRef.current, 0, 0);

    // Convert to base64 and send
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    const b64Data = imageData.split(',')[1];
    geminiWsRef.current.sendMediaChunk(b64Data, "image/jpeg");
  };

  // 監聽引用更新事件
  useEffect(() => {
    const handleCitationsUpdate = (event: CustomEvent) => {
      const { citations } = event.detail;
      console.log("[CameraPreview] Received citations update:", citations);
      if (citations && citations.length > 0) {
        setCitations(citations);
      }
    };

    window.addEventListener('citationsUpdate', handleCitationsUpdate as EventListener);
    return () => {
      window.removeEventListener('citationsUpdate', handleCitationsUpdate as EventListener);
    };
  }, []);

  const handleSearchClick = () => {
    router.push('/search');
  };

  return (
    <div className="relative w-full h-full">
      <Card>
        <CardContent className="p-4">
          <div className="flex justify-center items-center space-x-4 mb-2">
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full ${
                connectionStatus === 'connected' ? 'bg-green-500' : 
                connectionStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
              }`}></div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleScreenCapture}
              className="h-6 w-6 p-0 hover:bg-gray-100"
            >
              {isStreaming ? <MonitorOff className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
            </Button>
          </div>
          
          <div className="relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-52 object-cover rounded-lg"
            />
            <canvas
              ref={videoCanvasRef}
              className="hidden"
            />
            {!isStreaming && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center mb-2">
                    <span className="text-white font-bold text-xs">AI</span>
                  </div>
                  <p className="text-gray-500 text-xs">AI Meeting Assistant</p>
                </div>
              </div>
            )}
          </div>
          
          <div className="mt-2">
            <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-100"
                style={{ width: `${audioLevel}%` }}
              ></div>
            </div>
          </div>
          
          {searchEntryPoint && (
            <div className="mt-4">
              <SearchEntryPoint html={searchEntryPoint} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}