import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { X, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";

interface ImageSourceGalleryProps {
  images: Array<{
    image_url: string;
    origin_url: string;
  }>;
  onClose: () => void;
}

export default function ImageSourceGallery({ images, onClose }: ImageSourceGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handlePrevious = () => {
    setCurrentIndex((prevIndex) => (prevIndex - 1 + images.length) % images.length);
  };

  const handleNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
  };

  const goToImage = (index: number) => {
    setCurrentIndex(index);
  };

  const openSourceUrl = () => {
    if (images[currentIndex]?.origin_url) {
      window.open(images[currentIndex].origin_url, '_blank');
    }
  };

  if (images.length === 0) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-4 max-w-2xl w-full max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-semibold">圖片來源 ({currentIndex + 1}/{images.length})</h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="relative flex-1 flex items-center justify-center bg-gray-50 rounded-md overflow-hidden">
          <div className="w-full h-full flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-lg shadow-md overflow-hidden">
              <div className="h-40 bg-gray-200 flex items-center justify-center">
                <img 
                  src={images[currentIndex].image_url} 
                  alt={`Image ${currentIndex + 1}`} 
                  className="max-h-full max-w-full object-contain"
                />
              </div>
              <div className="p-4">
                <h4 className="font-medium text-sm mb-2">網站預覽</h4>
                <p className="text-xs text-gray-500 truncate">{images[currentIndex].origin_url}</p>
              </div>
            </div>
          </div>
          
          {images.length > 1 && (
            <>
              <Button 
                variant="outline" 
                size="icon" 
                className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-80"
                onClick={handlePrevious}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <Button 
                variant="outline" 
                size="icon" 
                className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-80"
                onClick={handleNext}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
        
        {images.length > 1 && (
          <div className="flex justify-center items-center mt-4 space-x-2">
            {images.map((_, index) => (
              <button
                key={index}
                className={`w-3 h-3 rounded-full ${
                  index === currentIndex ? 'bg-blue-500' : 'bg-gray-300'
                }`}
                onClick={() => goToImage(index)}
                aria-label={`Go to image ${index + 1}`}
              />
            ))}
          </div>
        )}
        
        <div className="flex justify-center items-center mt-4">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={openSourceUrl}
            className="flex items-center"
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            Source
          </Button>
        </div>
      </div>
    </div>
  );
} 