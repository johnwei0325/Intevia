// app/page.tsx
"use client";
import { useState, useCallback, useEffect, useRef } from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Monitor, MonitorOff, Volume2, VolumeX, Image, Link, Search } from "lucide-react";
import CameraButton from './components/CameraButton';
import ImageGallery from './components/ImageGallery';
import ImageSourceGallery from './components/ImageSourceGallery';
import TypingIndicator from './components/TypingIndicator';
import { useRouter } from 'next/navigation';
import SearchButton from './components/SearchButton';

// Helper function to create message components
const HumanMessage = ({ text }: { text: string }) => (
  <div className="flex gap-3 items-start">
    <Avatar className="h-8 w-8">
      <AvatarImage src="/avatars/human.png" alt="Human" />
      <AvatarFallback>H</AvatarFallback>
    </Avatar>
    <div className="flex-1 space-y-2 max-w-[280px]">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium text-zinc-900">You</p>
      </div>
      <div className="rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-800 whitespace-pre-wrap break-words">
        {text}
      </div>
    </div>
  </div>
);

const GeminiMessage = ({ text }: { text: string }) => {
  // 如果是 "NULL"，不顯示任何內容
  // console.log('[GeminiMessage] text:', text, 'type:', typeof text, 'length:', text.length, 'charCodeAt:', text.split('').map(c => c.charCodeAt(0)));
  
  // 移除換行符並修剪空格
  const cleanText = text.trim();
  
  if (cleanText === "NULL" || cleanText === "null" || cleanText === "..." || !cleanText) {
    console.log('[GeminiMessage] Ignoring message:', cleanText);
    return null;
  }
  
  // 處理文字，移除引用標記並美化標題
  const processText = (text: string) => {
    // 移除引用標記 [數字] 和 [數字, 數字, 數字]
    let processedText = text.replace(/\[\d+(?:,\s*\d+)*\]/g, '');
    
    // 處理標題，移除 ** 並添加適當的格式
    processedText = processedText.replace(/\*\*(.*?)\*\*/g, (match, title) => {
      return `<span class="font-semibold text-blue-700">${title}</span>`;
    });
    
    // 移除行首的 * 符號
    processedText = processedText.replace(/^\s*\*\s*/gm, '');
    
    return processedText;
  };
  
  return (
    <div className="flex gap-3 items-start">
      <Avatar className="h-8 w-8 bg-blue-600">
        <AvatarImage src="/avatars/gemini.png" alt="Intevia" />
        <AvatarFallback>AI</AvatarFallback>
      </Avatar>
      <div className="flex-1 space-y-2 max-w-[280px]">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-zinc-900">Intevia</p>
        </div>
        <div 
          className="rounded-lg bg-white border border-zinc-200 px-3 py-2 text-sm text-zinc-800 whitespace-pre-wrap break-words max-h-[300px] overflow-y-auto"
          dangerouslySetInnerHTML={{ __html: processText(cleanText) }}
        />
      </div>
    </div>
  );
};

export default function Home() {
  const router = useRouter();
  const [messages, setMessages] = useState<{ type: 'human' | 'gemini', text: string }[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const isVoiceEnabledRef = useRef(false);
  const [searchImages, setSearchImages] = useState<Array<{ image_url: string, origin_url: string }>>([]);
  const [showImageGallery, setShowImageGallery] = useState(false);
  const [showImageSourceGallery, setShowImageSourceGallery] = useState(false);
  const [isImageButtonAnimating, setIsImageButtonAnimating] = useState(false);
  const [isImageSourceButtonAnimating, setIsImageSourceButtonAnimating] = useState(false);
  const [citations, setCitations] = useState<Array<{ url: string, title: string }>>([]);
  const [showCitationGallery, setShowCitationGallery] = useState(false);
  const [isCitationButtonAnimating, setIsCitationButtonAnimating] = useState(false);
  const [isSearchButtonAnimating, setIsSearchButtonAnimating] = useState(false);
  const [webSearchProcessed, setWebSearchProcessed] = useState(false);
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const previousImagesLengthRef = useRef(0);
  const previousCitationsLengthRef = useRef(0);

  // 自動滾動到底部
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      const scrollArea = messagesEndRef.current.parentElement;
      if (scrollArea) {
        // 滾動到距離底部 100px 的位置，讓初始位置往下移動
        scrollArea.scrollTop = scrollArea.scrollHeight - scrollArea.clientHeight - 50;
      }
    }
  };
  
  // 初始化滾動位置
  useEffect(() => {
    const scrollArea = document.querySelector('[data-radix-scroll-area-viewport]');
    if (scrollArea) {
      scrollArea.scrollTop = 500; // 設置初始滾動位置
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isWaitingForResponse]);

  // 初始化 isVoiceEnabled 的狀態
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // 強制設置為文字模式
      console.log(`[Voice] 強制設置為文字模式`);
      setIsVoiceEnabled(false);
      isVoiceEnabledRef.current = false;
      localStorage.setItem('isVoiceEnabled', JSON.stringify(false));
    }
  }, []);

  // 監聽轉錄文字更新事件
  useEffect(() => {
    const handleTranscriptionUpdate = (event: CustomEvent) => {
      const { text } = event.detail;
      console.log('[Transcription] Received update:', text);
      
      // 如果是 "..." 或空字串，直接返回
      if (!text || text === '...') {
        return;
      }
      
      // 只有當收到實際內容時才添加到訊息列表
      setMessages(prev => [...prev, { type: 'gemini', text }]);
    };

    window.addEventListener('transcriptionUpdate', handleTranscriptionUpdate as EventListener);
    return () => {
      window.removeEventListener('transcriptionUpdate', handleTranscriptionUpdate as EventListener);
    };
  }, []);

  // 監聽圖片更新事件
  useEffect(() => {
    const handleImagesUpdate = (event: CustomEvent) => {
      const { images } = event.detail;
      console.log('[Images] Received update:', images);
      if (images && images.length > 0) {
        // 檢查是否有新圖片
        if (images.length > previousImagesLengthRef.current) {
          // 觸發按鈕扭動動畫
          setIsImageButtonAnimating(true);
          setIsImageSourceButtonAnimating(true);
          setTimeout(() => {
            setIsImageButtonAnimating(false);
            setIsImageSourceButtonAnimating(false);
          }, 1000);
        }
        
        setSearchImages(images);
        previousImagesLengthRef.current = images.length;
      }
    };

    window.addEventListener('imagesUpdate', handleImagesUpdate as EventListener);
    return () => {
      window.removeEventListener('imagesUpdate', handleImagesUpdate as EventListener);
    };
  }, []);

  // 當 isVoiceEnabled 變化時，保存到 localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('isVoiceEnabled', JSON.stringify(isVoiceEnabled));
      isVoiceEnabledRef.current = isVoiceEnabled;
    }
  }, [isVoiceEnabled]);

  // 監聽引用更新事件
  useEffect(() => {
    const handleCitationsUpdate = (event: CustomEvent) => {
      const { citations } = event.detail;
      console.log('[Citations] Received update:', citations);
      if (citations && citations.length > 0) {
        // 檢查是否有新引用
        if (citations.length > previousCitationsLengthRef.current) {
          // 觸發按鈕扭動動畫
          setIsSearchButtonAnimating(true);
          setTimeout(() => {
            setIsSearchButtonAnimating(false);
          }, 1000);
        }
        
        setCitations(citations);
        previousCitationsLengthRef.current = citations.length;
      }
    };

    window.addEventListener('citationsUpdate', handleCitationsUpdate as EventListener);
    return () => {
      window.removeEventListener('citationsUpdate', handleCitationsUpdate as EventListener);
    };
  }, []);

  // Add initialization log
  useEffect(() => {
    console.log('AI Meeting Assistant initialized');
    console.log('Voice mode:', isVoiceEnabled ? 'enabled' : 'disabled');
  }, []);

  const handleTranscription = useCallback((transcription: string) => {
    setMessages(prev => [...prev, { type: 'gemini', text: transcription }]);
  }, []);

  const toggleVoice = () => {
    const newVoiceState = !isVoiceEnabledRef.current;
    console.log(`[Voice] 當前模式: ${isVoiceEnabledRef.current ? '語音模式' : '文字模式'}`);
    console.log(`[Voice] 切換後模式: ${newVoiceState ? '語音模式' : '文字模式'}`);
    
    // 更新狀態
    setIsVoiceEnabled(newVoiceState);
    isVoiceEnabledRef.current = newVoiceState;
    
    // 保存到 localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('isVoiceEnabled', JSON.stringify(newVoiceState));
      console.log(`[Voice] 已保存到 localStorage: ${newVoiceState ? '語音模式' : '文字模式'}`);
    }
    
    // 通知其他組件語音狀態已更改
    const event = new CustomEvent('voiceStateChanged', {
      detail: { isVoiceEnabled: newVoiceState, timestamp: Date.now() }
    });
    window.dispatchEvent(event);
  };

  const openImageGallery = () => {
    setShowImageGallery(true);
  };

  const closeImageGallery = () => {
    setShowImageGallery(false);
  };

  const openImageSourceGallery = () => {
    setShowImageSourceGallery(true);
  };

  const closeImageSourceGallery = () => {
    setShowImageSourceGallery(false);
  };

  const handleSearchClick = () => {
    console.log('handleSearchClick called');
    
    // 保存當前的 citations 到 localStorage
    if (citations.length > 0) {
      console.log('Saving citations to localStorage:', citations);
      localStorage.setItem('citations', JSON.stringify(citations));
      
      // 觸發 citations 更新事件
      const event = new CustomEvent('citationsUpdate', {
        detail: { citations }
      });
      window.dispatchEvent(event);
    }
  };

  return (
    <div className="w-[400px] h-[600px] bg-white rounded-lg shadow-lg px-4 flex flex-col">
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full px-4">
          <div className="space-y-4 py-4">
            {messages.map((message, index) => (
              message.type === 'human' ? (
                <HumanMessage key={index} text={message.text} />
              ) : (
                <GeminiMessage key={index} text={message.text} />
              )
            ))}
            {/* 始終顯示打字指示器 */}
            <div className="flex gap-3 items-start">
              <Avatar className="h-8 w-8 bg-blue-600">
                <AvatarImage src="/avatars/gemini.png" alt="Intevia" />
                <AvatarFallback>AI</AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-zinc-900">Intevia</p>
                </div>
                <div className="rounded-lg bg-white border border-zinc-200 px-3 py-2 text-sm text-zinc-800 min-h-[24px] flex items-center">
                  <TypingIndicator className="ml-1" />
                </div>
              </div>
            </div>
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </div>

      {/* 底部按鈕區域 */}
      <div className="fixed bottom-4 right-4 flex space-x-2 z-50">
        {/* 圖片按鈕 */}
        <Button
          variant="outline"
          size="icon"
          onClick={openImageGallery}
          disabled={searchImages.length === 0}
          className={`bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-200 ${
            isImageButtonAnimating ? 'animate-bounce' : ''
          } ${searchImages.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
          title={`查看圖片 (${searchImages.length})`}
        >
          <Image className="h-4 w-4" />
          <span className="sr-only">查看圖片 ({searchImages.length})</span>
        </Button>
        
        {/* 圖片來源按鈕
        <Button
          variant="outline"
          size="icon"
          onClick={openImageSourceGallery}
          disabled={searchImages.length === 0}
          className={`bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-200 ${
            isImageSourceButtonAnimating ? 'animate-bounce' : ''
          } ${searchImages.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
          title={`查看圖片來源 (${searchImages.length})`}
        >
          <Link className="h-4 w-4" />
          <span className="sr-only">查看圖片來源 ({searchImages.length})</span>
        </Button> */}
        
        {/* 聲音按鈕 */}
        <Button
          variant="outline"
          size="icon"
          onClick={toggleVoice}
          className="bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-200 shadow-sm transition-all duration-200 hover:shadow-md"
          title={isVoiceEnabled ? "切換到文字模式" : "切換到語音模式"}
        >
          {isVoiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          <span className="sr-only">{isVoiceEnabled ? "切換到文字模式" : "切換到語音模式"}</span>
        </Button>
        
        {/* 搜索按鈕 */}
        <SearchButton />
        
        {/* 添加 CameraButton 組件 */}
        <CameraButton />
      </div>
      
      {showImageGallery && (
        <ImageGallery 
          images={searchImages} 
          onClose={closeImageGallery} 
        />
      )}
      
      {showImageSourceGallery && (
        <ImageSourceGallery 
          images={searchImages} 
          onClose={closeImageSourceGallery} 
        />
      )}
    </div>
  );
}
