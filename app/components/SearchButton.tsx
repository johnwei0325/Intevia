'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import SearchPage from '../search/page';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function SearchButton() {
  const [showSearch, setShowSearch] = useState(false);
  const [searchEngine, setSearchEngine] = useState<'gemini' | 'perplexity'>('gemini');

  const handleClick = () => {
    console.log('SearchButton handleClick called');
    
    // 檢查是否有 citations 或 search_entry_point
    const hasCitations = localStorage.getItem('citations');
    const hasSearchEntryPoint = localStorage.getItem('search_entry_point');
    
    console.log('hasCitations:', hasCitations);
    console.log('hasSearchEntryPoint:', hasSearchEntryPoint);

    if (hasCitations || hasSearchEntryPoint) {
      console.log('Setting showSearch to true');
      setShowSearch(true);
    } else {
      console.log('No citations or search entry point found');
    }
  };

  const handleClose = () => {
    console.log('SearchButton handleClose called');
    setShowSearch(false);
  };

  const handleSearchEngineChange = (value: 'gemini' | 'perplexity') => {
    setSearchEngine(value);
    localStorage.setItem('search_engine', value);
  };

  console.log('SearchButton render, showSearch:', showSearch);

  return (
    <>
      <div className="flex items-center space-x-2">
        <Select
          value={searchEngine}
          onValueChange={handleSearchEngineChange}
        >
          <SelectTrigger className="w-[120px] h-9 bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-200">
            <SelectValue placeholder="Select engine" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="gemini">Gemini</SelectItem>
            <SelectItem value="perplexity">Perplexity</SelectItem>
          </SelectContent>
        </Select>
        
        <Button
          variant="outline"
          size="icon"
          onClick={handleClick}
          className="bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-200 shadow-sm transition-all duration-200 hover:shadow-md"
          title="Search"
        >
          <Search className="h-4 w-4" />
          <span className="sr-only">Search</span>
        </Button>
      </div>
      
      {showSearch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] overflow-hidden" style={{ position: 'fixed', top: 0, left: -10, right: 0, bottom: 0 }}>
          <div className="bg-white rounded-lg w-full max-w-xs">
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
                onClick={handleClose}
                className="text-gray-500 hover:text-gray-700"
              >
                Close
              </Button>
            </div>
            <div className="p-2">
              <SearchPage onClose={handleClose} searchEngine={searchEngine} />
            </div>
          </div>
        </div>
      )}
    </>
  );
} 