#!/usr/bin/env python3
import os
import json
import sys
from google import genai
from google.genai.types import Tool, GenerateContentConfig, GoogleSearch
from dotenv import load_dotenv

# 加載 .env.local 文件
load_dotenv('.env.local')

# 設置 API 金鑰
GEMINI_API_KEY = os.environ.get("NEXT_PUBLIC_GEMINI_API_KEY", "your_gemini_api_key_here")

# 配置 Gemini
os.environ["GOOGLE_API_KEY"] = GEMINI_API_KEY

def gemini_web_search(query, model_id="gemini-2.0-flash"):
    """
    使用 Gemini 的網路搜尋功能
    """
    try:
        # 初始化 Gemini 客戶端
        client = genai.Client()
        
        # 設置 Google 搜尋工具
        google_search_tool = Tool(
            google_search = GoogleSearch()
        )
        
        # 構建提示詞
        prompt = f"""
        請提供關於以下問題的簡潔回答。保持回答簡短且切中要點。
        
        問題: {query}
        """
        
        # 發送請求
        response = client.models.generate_content(
            model=model_id,
            contents=prompt,
            config=GenerateContentConfig(
                tools=[google_search_tool],
                response_modalities=["TEXT"],
            )
        )
        
        # 印出 Gemini 回應對象到 stderr
        print(json.dumps(response, default=lambda o: str(o)), file=sys.stderr)
        
        # 提取回答
        answer = ""
        if response and response.candidates and len(response.candidates) > 0:
            for part in response.candidates[0].content.parts:
                answer += part.text
        
        # 提取引用
        citations = []
        if response and response.candidates and len(response.candidates) > 0:
            candidate = response.candidates[0]
            if candidate.grounding_metadata and candidate.grounding_metadata.grounding_chunks:
                for chunk in candidate.grounding_metadata.grounding_chunks:
                    if chunk.web:
                        citations.append({
                            "title": chunk.web.title,
                            "url": chunk.web.uri
                        })
        
        # 提取 search_entry_point
        search_entry_point = None
        if response and response.candidates and len(response.candidates) > 0:
            candidate = response.candidates[0]
            if candidate.grounding_metadata and candidate.grounding_metadata.search_entry_point:
                search_entry_point = candidate.grounding_metadata.search_entry_point.rendered_content
        
        # 返回結果
        result = {
            "answer": answer,
            "citations": citations,
            "images": [],
            "search_entry_point": search_entry_point
        }
        
        return result
    except Exception as e:
        return {
            "error": str(e),
            "answer": "",
            "citations": [],
            "images": [],
            "search_entry_point": None
        }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({
            "error": "No query provided",
            "answer": "",
            "citations": [],
            "images": [],
            "search_entry_point": None
        }))
        sys.exit(1)
    
    query = sys.argv[1]
    model = sys.argv[2] if len(sys.argv) > 2 else "gemini-2.0-flash"
    
    result = gemini_web_search(query, model)
    print(json.dumps(result)) 