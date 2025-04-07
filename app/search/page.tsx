'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import TestSearchEntryPoint from '../components/TestSearchEntryPoint';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from "@/components/ui/button";

interface Citation {
  url: string;
  title: string;
  snippet?: string;
}

interface SearchPageProps {
  onClose?: () => void;
  searchEngine: 'gemini' | 'perplexity';
}

export default function SearchPage({ onClose, searchEngine }: SearchPageProps) {
  const router = useRouter();
  const [citations, setCitations] = useState<Citation[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [searchEntryPoint, setSearchEntryPoint] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // 設置搜索引擎
    localStorage.setItem('search_engine', searchEngine);
    
    const storedSearchEntryPoint = localStorage.getItem('search_entry_point');
    if (storedSearchEntryPoint) {
      setSearchEntryPoint(storedSearchEntryPoint);
    }

    const storedCitations = localStorage.getItem('citations');
    if (storedCitations) {
      try {
        const parsedCitations = JSON.parse(storedCitations);
        setCitations(parsedCitations);
      } catch (error) {
        console.error('Error parsing citations:', error);
      }
    }

    const handleCitationsUpdate = (event: CustomEvent) => {
      const { citations } = event.detail;
      if (citations) {
        setCitations(citations);
      }
    };

    window.addEventListener('citationsUpdate', handleCitationsUpdate as EventListener);
    return () => {
      window.removeEventListener('citationsUpdate', handleCitationsUpdate as EventListener);
    };
  }, [searchEngine]);

  const goToPrevious = () => {
    setCurrentIndex((prevIndex) => (prevIndex > 0 ? prevIndex - 1 : prevIndex));
  };

  const goToNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex < totalItems - 1 ? prevIndex + 1 : prevIndex));
  };

  const openUrl = (url: string) => {
    window.open(url, '_blank');
  };

  const extractDomain = (url: string) => {
    try {
      const domain = new URL(url).hostname;
      return domain.replace('www.', '');
    } catch (error) {
      return url;
    }
  };

  const getWebsiteInfo = (url: string) => {
    const domain = extractDomain(url);
    if (domain.includes('wikipedia.org')) {
      return {
        name: 'Wikipedia',
        description: '維基百科是一個自由的線上百科全書，提供可靠的參考資料。',
        type: '百科全書'
      };
    }
    if (domain.includes('github.com')) {
      return {
        name: 'GitHub',
        description: '全球最大的開源程式碼託管平台。',
        type: '開發平台'
      };
    }
    if (domain.includes('youtube.com')) {
      return {
        name: 'YouTube',
        description: '全球最大的影片分享平台。',
        type: '影片平台'
      };
    }
    if (domain.includes('twitter.com') || domain.includes('x.com')) {
      return {
        name: 'Twitter',
        description: '即時社交媒體平台。',
        type: '社交媒體'
      };
    }
    if (domain.includes('linkedin.com')) {
      return {
        name: 'LinkedIn',
        description: '專業人士的社交網絡。',
        type: '職業社交'
      };
    }
    if (domain.includes('medium.com')) {
      return {
        name: 'Medium',
        description: '高質量的文章發布平台。',
        type: '部落格平台'
      };
    }
    return {
      name: domain,
      description: '相關網站',
      type: '網站'
    };
  };

  const totalItems = citations.length + (searchEntryPoint ? 1 : 0);

  const handleClose = () => {
    setIsVisible(false);
    if (onClose) {
      onClose();
    } else {
      setTimeout(() => {
        router.push('/');
      }, 300); // 等待過渡動畫完成
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="transform scale-95 origin-top-left">
      {/* Navigation controls */}
      <div className="flex items-center justify-between mb-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={goToPrevious}
          disabled={currentIndex === 0}
          className="h-6 w-6"
        >
          <ChevronLeft className="h-3 w-3" />
        </Button>
        <div className="text-xs text-gray-500">
          {currentIndex + 1} / {totalItems}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={goToNext}
          disabled={currentIndex === totalItems - 1}
          className="h-6 w-6"
        >
          <ChevronRight className="h-3 w-3" />
        </Button>
      </div>

      {/* Content display */}
      <div className="overflow-hidden">
        {currentIndex === 0 && searchEntryPoint ? (
          <TestSearchEntryPoint />
        ) : (
          <div 
            className="p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
            onClick={() => openUrl(citations[currentIndex - (searchEntryPoint ? 1 : 0)]?.url || '')}
          >
            {(() => {
              const citation = citations[currentIndex - (searchEntryPoint ? 1 : 0)];
              const websiteInfo = getWebsiteInfo(citation?.url || '');
              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-blue-600 font-medium">
                      {websiteInfo.name}
                    </div>
                    <div className="text-xs text-gray-500 px-2 py-1 bg-gray-100 rounded">
                      {websiteInfo.type}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-base font-medium text-gray-900 mb-2">
                      {citation?.title || ''}
                    </h3>
                    <p className="text-sm text-gray-600 leading-relaxed mb-2">
                      {citation?.snippet || ''}
                    </p>
                    <p className="text-xs text-gray-500">
                      {websiteInfo.description}
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
} 