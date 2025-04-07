import { NextRequest, NextResponse } from 'next/server';

const API_KEY = "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";
const API_URL = "https://api.perplexity.ai/chat/completions";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // 確保請求包含必要的參數
    const requestBody = {
      ...body,
      citations: true,
      return_citations: true
    };
    
    console.log("[Proxy] Sending request to Perplexity API with body:", JSON.stringify(requestBody));
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Proxy] API error response:", errorText);
      return NextResponse.json({ error: `API error: ${response.status} ${errorText}` }, { status: response.status });
    }
    
    const data = await response.json();
    console.log("[Proxy] Received response from Perplexity API:", JSON.stringify(data));
    
    // 檢查是否有引用連結
    if (data.citations && data.citations.length > 0) {
      console.log("[Proxy] Found citations:", JSON.stringify(data.citations));
    } else {
      console.log("[Proxy] No citations found in response");
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error("[Proxy] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
} 