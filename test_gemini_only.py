import os
import json
import time
from datetime import datetime
from google import genai
from google.genai.types import Tool, GenerateContentConfig, GoogleSearch
from dotenv import load_dotenv

# 加載 .env.local 文件
load_dotenv('.env.local')

# 設置 API 金鑰
GEMINI_API_KEY = os.environ.get("NEXT_PUBLIC_GEMINI_API_KEY", "your_gemini_api_key_here")

# 配置 Gemini
# 使用正確的方法來配置 API 金鑰
os.environ["GOOGLE_API_KEY"] = GEMINI_API_KEY

def test_gemini_web_search(query, model_id="gemini-2.0-flash"):
    """
    測試 Gemini 的網路搜尋功能
    """
    try:
        print(f"\n[Gemini] 查詢: {query}")
        print("-" * 50)
        
        start_time = time.time()
        
        # 初始化 Gemini 客戶端
        client = genai.Client()
        
        # 設置 Google 搜尋工具
        google_search_tool = Tool(
            google_search = GoogleSearch()
        )
        
        # 構建提示詞
        prompt = f"""
        請提供關於以下問題的簡潔回答。保持回答簡短且切中要點。
        在回答末尾添加相關來源鏈接，格式為 [來源名稱](URL)。
        
        問題: {query}
        """
        
        # 發送請求
        print(f"[Gemini] 正在向 Gemini API 發送請求...")
        response = client.models.generate_content(
            model=model_id,
            contents=prompt,
            config=GenerateContentConfig(
                tools=[google_search_tool],
                response_modalities=["TEXT"],
            )
        )
        
        end_time = time.time()
        elapsed_time = end_time - start_time
        
        # 提取並打印回答
        if response and response.candidates and len(response.candidates) > 0:
            answer = ""
            for part in response.candidates[0].content.parts:
                answer += part.text
            
            print(f"[Gemini] 回答:\n{answer}")
            
            # 檢查是否有引用或來源
            if "[" in answer and "]" in answer and "(" in answer and ")" in answer:
                print("\n[Gemini] 來源:")
                # 簡單的正則表達式來提取 Markdown 格式的鏈接
                import re
                links = re.findall(r'\[(.*?)\]\((.*?)\)', answer)
                for title, url in links:
                    print(f"- {title}: {url}")
            else:
                print("\n[Gemini] 未找到來源鏈接")
                links = []
            
            # 檢查是否有搜尋元數據
            if hasattr(response.candidates[0], 'grounding_metadata') and hasattr(response.candidates[0].grounding_metadata, 'search_entry_point'):
                print("\n[Gemini] 搜尋元數據:")
                print(response.candidates[0].grounding_metadata.search_entry_point.rendered_content)
            
            print(f"\n[Gemini] 響應時間: {elapsed_time:.2f} 秒")
            
            return {
                "model": "gemini",
                "query": query,
                "response": answer,
                "elapsed_time": elapsed_time,
                "links": links if "links" in locals() else []
            }
        else:
            print("[Gemini] 未收到有效回答")
            return {
                "model": "gemini",
                "query": query,
                "response": "未收到有效回答",
                "elapsed_time": elapsed_time,
                "links": []
            }
        
    except Exception as e:
        print(f"[Gemini] 錯誤: {e}")
        return {
            "model": "gemini",
            "query": query,
            "response": f"錯誤: {str(e)}",
            "elapsed_time": 0,
            "links": []
        }

def test_different_models(query):
    """
    測試不同的 Gemini 模型
    """
    models = [
        "gemini-2.0-flash",
        "gemini-1.5-pro",
        "gemini-1.5-flash",
        "gemini-1.0-pro"
    ]
    
    results = {}
    
    for model in models:
        print(f"\n測試模型: {model}")
        result = test_gemini_web_search(query, model)
        results[model] = result
        
        # 等待一下，避免 API 限制
        time.sleep(2)
    
    return results

def main():
    # 測試案例
    test_queries = [
        "今天的新聞頭條是什麼？",
        "NVIDIA 股票的當前價格是多少？",
        "最新的 AI 技術發展有哪些？",
    ]
    
    print("測試 Gemini 網路搜尋功能")
    print("=" * 50)
    print(f"測試開始時間: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    all_results = {}
    
    for query in test_queries:
        print("\n" + "=" * 50)
        print(f"測試查詢: {query}")
        print("=" * 50)
        
        # 測試不同的 Gemini 模型
        results = test_different_models(query)
        all_results[query] = results
        
        print("\n" + "=" * 50)
        print(f"查詢 '{query}' 測試完成")
        print("=" * 50)
        
        # 等待一下，避免 API 限制
        time.sleep(2)
    
    # 保存結果到文件
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"gemini_test_results_{timestamp}.json"
    
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(all_results, f, ensure_ascii=False, indent=2)
    
    print(f"\n結果已保存到文件: {filename}")

if __name__ == "__main__":
    main() 