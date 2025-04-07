"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Wifi } from "lucide-react";
import CameraPreview from './CameraPreview';

export default function CameraButton() {
  const [showCamera, setShowCamera] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);

  const handleTranscription = (text: string) => {
    console.log("Transcription:", text);
    // 創建一個自定義事件，將轉錄文字傳遞到主頁面
    const event = new CustomEvent('transcriptionUpdate', {
      detail: { text }
    });
    window.dispatchEvent(event);
  };

  const toggleVoice = () => {
    setIsVoiceEnabled(!isVoiceEnabled);
    // 觸發事件，通知 CameraPreview 組件
    const event = new CustomEvent('voiceStateChanged');
    window.dispatchEvent(event);
  };

  // 監聽語音狀態變化
  useEffect(() => {
    const handleVoiceStateChange = () => {
      const storedVoiceState = localStorage.getItem('isVoiceEnabled');
      if (storedVoiceState) {
        setIsVoiceEnabled(JSON.parse(storedVoiceState));
      }
    };

    window.addEventListener('voiceStateChanged', handleVoiceStateChange);
    return () => {
      window.removeEventListener('voiceStateChanged', handleVoiceStateChange);
    };
  }, []);

  // 處理關閉視窗事件，但不影響 WebSocket 連接
  const handleCloseWindow = () => {
    setShowCamera(false);
    // 不觸發任何 WebSocket 斷開連接的事件
  };

  return (
    <div>
      <Button 
        variant="outline" 
        size="icon" 
        onClick={() => setShowCamera(!showCamera)}
        className="bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-200"
        title="連線螢幕"
      >
        <Wifi className="h-4 w-4" />
      </Button>

      {/* 始終渲染 CameraPreview 組件，但根據 showCamera 狀態控制其顯示 */}
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" style={{ display: showCamera ? 'flex' : 'none' }}>
        <div className="bg-white rounded-lg w-full max-w-xs">
          <div className="p-2 border-b flex justify-between items-center">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center mr-2">
                <span className="text-white font-bold text-lg">AI</span>
              </div>
              <h2 className="text-lg font-semibold text-gray-800">AI Meeting Assistant</h2>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleCloseWindow}
              className="h-6 px-2"
            >
              Close
            </Button>
          </div>
          <div className="p-2">
            <div className="transform scale-95 origin-top-left">
              <CameraPreview 
                onTranscription={handleTranscription} 
                isVoiceEnabled={isVoiceEnabled} 
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 