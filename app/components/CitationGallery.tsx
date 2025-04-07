import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { X, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface CitationGalleryProps {
  citations: Array<{
    url: string;
    title: string;
  }>;
  onClose: () => void;
}

export default function CitationGallery({ citations, onClose }: CitationGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const openCitationUrl = (url: string) => {
    window.open(url, '_blank');
  };

  if (citations.length === 0) {
    return null;
  }

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : citations.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < citations.length - 1 ? prev + 1 : 0));
  };

  // 提取網址的主域名部分
  const getDomainFromUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (e) {
      return url;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-[300px]">
        <div className="p-2 border-b flex justify-between items-center">
          <h2 className="text-xs font-semibold">Citation Preview</h2>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClose}
            className="h-6 px-2"
          >
            Close
          </Button>
        </div>
        <CardContent className="p-2">
          <div className="transform scale-95 origin-top-left">
            <div className="space-y-2">
              <div className="p-2 border rounded-md hover:bg-gray-50">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-medium text-xs">{citations[currentIndex].title || 'Untitled'}</p>
                    <p className="text-xs text-gray-500 truncate">{citations[currentIndex].url}</p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => openCitationUrl(citations[currentIndex].url)}
                    className="h-6 w-6"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              
              <div className="text-xs text-gray-500 truncate text-center">
                {getDomainFromUrl(citations[currentIndex].url)}
              </div>
              
              <div className="flex justify-between items-center">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handlePrevious}
                  className="h-6 w-6"
                >
                  <ChevronLeft className="h-3 w-3" />
                </Button>
                <div className="flex space-x-1">
                  {citations.map((_, index) => (
                    <div
                      key={index}
                      className={`w-2 h-2 rounded-full ${
                        index === currentIndex ? 'bg-blue-500' : 'bg-gray-300'
                      }`}
                    />
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleNext}
                  className="h-6 w-6"
                >
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 