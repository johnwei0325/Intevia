'use client';

import React from 'react';

interface SearchEntryPointProps {
  html: string;
}

const SearchEntryPoint: React.FC<SearchEntryPointProps> = ({ html }) => {
  return (
    <div className="mt-4 border rounded-lg p-4 bg-white">
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
};

export default SearchEntryPoint; 