import { OpenAI } from 'openai';

const API_KEY = "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";

export interface Citation {
  url: string;
  title: string;
  snippet?: string;
}

export interface PerplexityResponse {
  answer: string;
  citations: Citation[];
  images: { url: string; title: string }[];
  headlines?: string[];
  sources?: Citation[];
  search_entry_point?: string;
}

export class PerplexityService {
  private static instance: PerplexityService;
  private client: OpenAI;
  private lastQuery: string = '';
  private lastQueryTime: number = 0;
  private debounceTime: number = 2000; // 2 seconds debounce
  
  private constructor() {
    console.log("[PerplexityService] Initializing service");
    this.client = new OpenAI({
      apiKey: API_KEY,
      baseURL: "https://api.perplexity.ai",
      dangerouslyAllowBrowser: true
    });
  }
  
  public static getInstance(): PerplexityService {
    if (!PerplexityService.instance) {
      console.log("[PerplexityService] Creating new instance");
      PerplexityService.instance = new PerplexityService();
    }
    return PerplexityService.instance;
  }
  
  public async search(query: string): Promise<PerplexityResponse> {
    try {
      console.log(`[PerplexityService] Starting search for query: "${query}"`);
      
      // 檢查是否在短時間內重複查詢
      const now = Date.now();
      if (query === this.lastQuery && now - this.lastQueryTime < this.debounceTime) {
        console.log(`[PerplexityService] Duplicate query detected within ${this.debounceTime}ms, returning cached response`);
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
      
      // 檢查查詢是否與 Gemini 相關
      const isGeminiQuery = query.toLowerCase().includes('gemini');
      
      const messages = [
        {
          role: "system" as const,
          content: isGeminiQuery 
            ? "Please provide a concise answer to the question. Keep your answer brief and to the point. Do not mention or compare with other AI models like Gemini. Add relevant source links at the end in a new line, formatted as [Source name](URL)."
            : "Please provide a concise answer to the question. Keep your answer brief and to the point. Add relevant source links at the end in a new line, formatted as [Source name](URL)."
        },
        {
          role: "user" as const,
          content: query
        }
      ];
      
      console.log("[PerplexityService] Sending request to Perplexity API...");
      
      // 使用我們的代理 API 路由
      const response = await fetch('/api/proxy/perplexity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: "sonar",
          messages: messages,
          max_tokens: 500,
          temperature: 0.2,
          top_p: 0.9,
          stream: false,
          presence_penalty: 0,
          frequency_penalty: 1,
          response_format: { type: "text" },
          search_domain_filter: ["google.com", "finance.yahoo.com", "finance.google.com", "marketwatch.com", "bloomberg.com"],
          return_images: true,
          return_related_questions: true,
          search_recency_filter: "day",
          top_k: 3,
          web_search_options: { search_context_size: "high" },
          return_citations: true
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("[PerplexityService] API error response:", errorText);
        throw new Error(`API error: ${response.status} ${errorText}`);
      }
      
      const responseData = await response.json();
      
      // 檢查回答是否包含 Gemini 相關內容
      let answer = responseData.choices[0].message.content;
      if (isGeminiQuery) {
        answer = answer
          .replace(/gemini/gi, 'AI')
          .replace(/Gemini/gi, 'AI');
      }
      
      // 提取引用
      const citations: Citation[] = [];
      if (responseData.choices[0].message.citations) {
        for (const citation of responseData.choices[0].message.citations) {
          citations.push({
            url: citation.url,
            title: citation.title,
            snippet: citation.snippet
          });
        }
      }
      
      // 提取圖片
      const images: { url: string; title: string }[] = [];
      if (responseData.images) {
        for (const image of responseData.images) {
          images.push({
            url: image.image_url,
            title: image.alt_text || 'Image'
          });
        }
      }
      
      // 提取相關問題作為頭條
      const headlines: string[] = [];
      if (responseData.related_questions) {
        headlines.push(...responseData.related_questions);
      }
      
      // 構建最終回應
      const result: PerplexityResponse = {
        answer,
        citations,
        images,
        headlines,
        search_entry_point: undefined // Perplexity 目前不支持 search_entry_point
      };
      
      console.log("[PerplexityService] Processed response:", result);
      return result;
      
    } catch (error) {
      console.error("[PerplexityService] Error during search:", error);
      throw error;
    }
  }
} 