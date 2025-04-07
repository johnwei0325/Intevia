import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface ImageGalleryProps {
  images: Array<{
    image_url: string;
    origin_url: string;
  }>;
  onClose: () => void;
}

export default function ImageGallery({ images, onClose }: ImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!images || images.length === 0) return null;

  const currentImage = images[currentIndex];

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  };

  const handleImageClick = () => {
    if (currentImage?.origin_url) {
      window.open(currentImage.origin_url, '_blank');
    }
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
          <div className="flex items-center">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center mr-2">
              <span className="text-white font-bold text-lg">AI</span>
            </div>
            <h2 className="text-base font-semibold text-gray-800">AI Meeting Assistant</h2>
          </div>
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
              <div 
                className="relative h-40 bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                onClick={handleImageClick}
                title="Click to view source"
              >
                {currentImage && currentImage.image_url ? (
                  <img 
                    src={currentImage.image_url}
                    alt="Gallery image"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-xs text-gray-500">No image available</p>
                  </div>
                )}
              </div>
              
              {currentImage?.origin_url && (
                <div className="text-xs text-gray-500 truncate text-center">
                  {getDomainFromUrl(currentImage.origin_url)}
                </div>
              )}
              
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
                  {images.map((_, index) => (
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