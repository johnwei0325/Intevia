import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

// 定義 Gemini 響應的接口
interface GeminiResponse {
  candidates: {
    content: {
      parts: {
        text: string;
      }[];
    };
    grounding_metadata?: {
      search_entry_point?: {
        rendered_content: string;
      };
    };
  }[];
}

// 定義引用接口
interface Citation {
  title: string;
  url: string;
}

// 定義 Gemini 服務類
export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: string;
  private lastQuery: string = '';
  private lastQueryTime: number = 0;
  private debounceTime: number = 2000; // 2 seconds debounce

  constructor(model: string = 'gemini-2.0-flash') {
    this.genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || '');
    this.model = model;
  }

  // 從文本中提取 Markdown 格式的鏈接
  private extractLinks(text: string): Citation[] {
    const links: Citation[] = [];
    
    // 提取 Markdown 格式的鏈接 [Title](URL)
    const markdownLinkRegex = /\[(.*?)\]\((.*?)\)/g;
    let match;
    while ((match = markdownLinkRegex.exec(text)) !== null) {
      links.push({
        title: match[1],
        url: match[2],
      });
    }
    
    // 提取 [來源 數字] 格式的鏈接
    const sourceLinkRegex = /\[來源\s*(\d+)\]/g;
    while ((match = sourceLinkRegex.exec(text)) !== null) {
      const sourceNumber = match[1];
      
      // 嘗試從文本中提取對應的 URL
      const urlRegex = new RegExp(`\\[來源\\s*${sourceNumber}\\]\\s*\\(([^)]+)\\)`);
      const urlMatch = text.match(urlRegex);
      
      if (urlMatch && urlMatch[1]) {
        links.push({
          title: `來源 ${sourceNumber}`,
          url: urlMatch[1],
        });
      } else {
        // 如果找不到對應的 URL，則使用默認的 URL
        const url = `https://example.com/source${sourceNumber}`;
        links.push({
          title: `來源 ${sourceNumber}`,
          url: url,
        });
      }
    }
    
    return links;
  }

  // 從 HTML 內容中提取鏈接
  private extractLinksFromHtml(html: string): Citation[] {
    const links: Citation[] = [];
    const linkRegex = /<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/g;
    let match;

    while ((match = linkRegex.exec(html)) !== null) {
      links.push({
        title: match[2].replace(/<[^>]*>/g, ''), // 移除 HTML 標籤
        url: match[1],
      });
    }

    return links;
  }

  // 處理新聞頭條資料
  private processNewsHeadlines(text: string): {
    headlines: string[];
    sources: Citation[];
  } {
    const headlines: string[] = [];
    const sources: Citation[] = [];
    
    // 提取新聞頭條
    const headlineRegex = /\*\s+\*\*([^:]+):\*\*\s+([^\n]+)/g;
    let match;
    
    while ((match = headlineRegex.exec(text)) !== null) {
      const category = match[1].trim();
      const headline = match[2].trim();
      headlines.push(`${category}: ${headline}`);
    }
    
    // 提取來源鏈接
    const sourceLinks = this.extractLinks(text);
    sources.push(...sourceLinks);
    
    return {
      headlines,
      sources,
    };
  }

  private processText(text: string, citations: Citation[] = []): string {
    // 移除引用標記 [數字] 和 [數字, 數字, 數字]
    let processedText = text.replace(/\[\d+(?:,\s*\d+)*\]/g, '');
    
    // 將引用連結 [Title](URL) 轉換為可點擊的連結，只顯示標題
    processedText = processedText.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, title, url) => {
      return `<a href="${url}" target="_blank" class="text-blue-600 hover:underline">${title}</a>`;
    });
    
    // 處理標題，移除 ** 並添加適當的格式
    processedText = processedText.replace(/\*\*(.*?)\*\*/g, (match, title) => {
      return `<span class="font-semibold text-blue-700">${title}</span>`;
    });
    
    // 移除行首的 * 符號
    processedText = processedText.replace(/^\s*\*\s*/gm, '');
    
    // 將引用標記 [數字] 轉換為可點擊的連結
    processedText = processedText.replace(/\[(\d+)\]/g, (match, number) => {
      const index = parseInt(number) - 1; // 轉換為 0-based 索引
      if (index >= 0 && index < citations.length) {
        const citation = citations[index];
        return `<a href="${citation.url}" target="_blank" class="text-blue-600 hover:underline">${citation.title}</a>`;
      }
      return match; // 如果找不到對應的引用，則保留原始標記
    });
    
    return processedText;
  }

  private processResponse(response: any) {
    const answer = response.answer || '';
    const citations = (response.citations || []) as Citation[];
    const images = response.images || [];
    const searchEntryPoint = response.search_entry_point || null;
    
    let processedText = this.processText(answer);
    
    // 添加引用部分
    if (citations.length > 0) {
      processedText += '\n\n[CITATIONS]\n';
      processedText += citations.map((citation: Citation) => 
        `[${citation.title}](${citation.url})`
      ).join('\n');
    }
    
    // 添加 search_entry_point 部分
    if (searchEntryPoint) {
      processedText += '\n\n[SEARCH_ENTRY_POINT]\n';
      processedText += searchEntryPoint;
    }
    
    return {
      text: processedText,
      images: images
    };
  }

  // 搜尋方法
  async search(query: string): Promise<{
    answer: string;
    citations: Citation[];
    images: { url: string; title: string }[];
    headlines?: string[];
    sources?: Citation[];
    search_entry_point?: string;
  }> {
    try {
      console.log(`[GeminiService] 搜尋查詢: ${query}`);
      
      // 檢查是否在短時間內重複查詢
      const now = Date.now();
      if (query === this.lastQuery && now - this.lastQueryTime < this.debounceTime) {
        console.log(`[GeminiService] Duplicate query detected within ${this.debounceTime}ms, returning cached response`);
        // 返回一個緩存的反應或等待
        await new Promise(resolve => setTimeout(resolve, 500));
        return {
          answer: "I'm processing your request. Please wait a moment.",
          citations: [],
          images: [],
          search_entry_point: undefined
        };
      }
      
      // 更新最後查詢和時間
      this.lastQuery = query;
      this.lastQueryTime = now;

      // 檢查查詢是否包含 "gemini" 關鍵字
      const isGeminiQuery = query.toLowerCase().includes('gemini');

      // 構建提示詞
      const prompt = `
        請提供關於以下問題的簡潔回答。保持回答簡短且切中要點。
        ${isGeminiQuery ? '請不要提及或比較其他 AI 模型如 Gemini。' : ''}
        
        問題: ${query}
      `;

      // 使用 API 路由進行搜尋
      const response = await fetch('/api/gemini-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: prompt,
          model: this.model,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to search');
      }

      const result = await response.json();
      
      // 印出原始回應
      console.log('[GeminiService] 原始回應:', result);
      
      // 過濾掉包含 "gemini" 的回答
      let answer = result.answer;
      if (isGeminiQuery) {
        answer = answer
          .replace(/gemini/gi, 'AI')
          .replace(/Gemini/gi, 'AI');
      }
      
      // 過濾掉包含 "gemini" 的引用
      const citations = result.citations.filter(
        (citation: Citation) => !citation.title.toLowerCase().includes('gemini')
      );
      
      // 檢查是否包含新聞頭條
      let headlines: string[] | undefined;
      let sources: Citation[] | undefined;
      
      if (query.toLowerCase().includes('news') || query.toLowerCase().includes('headlines')) {
        const newsData = this.processNewsHeadlines(answer);
        headlines = newsData.headlines;
        sources = newsData.sources;
      }
      
      // 提取 search_entry_point
      const searchEntryPoint = result.search_entry_point;
      console.log('[GeminiService] Extracted search_entry_point:', searchEntryPoint);
      
      return {
        answer,
        citations,
        images: result.images || [],
        headlines,
        sources,
        search_entry_point: searchEntryPoint
      };
    } catch (error) {
      console.error('[GeminiService] 搜尋錯誤:', error);
      throw error;
    }
  }
} 