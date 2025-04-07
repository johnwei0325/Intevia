import os
import json
from datetime import datetime
from google.generativeai import GenerativeModel, configure

# 設置 API 金鑰
API_KEY = os.environ.get("GEMINI_API_KEY", "your_api_key_here")
configure(api_key=API_KEY)

def test_gemini_web_search(query, model="gemini-2.0-flash-exp"):
    """
    測試 Gemini 2.0 Flash 的網路搜尋功能
    """
    try:
        print(f"\n查詢: {query}")
        print("-" * 50)
        
        # 初始化 Gemini 模型
        model = GenerativeModel(model)
        
        # 構建提示詞
        prompt = f"""
        請提供關於以下問題的簡潔回答。保持回答簡短且切中要點。
        在回答末尾添加相關來源鏈接，格式為 [來源名稱](URL)。
        
        問題: {query}
        """
        
        # 發送請求
        print(f"正在向 Gemini API 發送請求...")
        response = model.generate_content(
            prompt,
            generation_config={
                "temperature": 0.2,
                "top_p": 0.9,
                "top_k": 3,
                "max_output_tokens": 1024,
            },
            safety_settings=[
                {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
                {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
                {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
                {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
            ],
        )
        
        # 提取並打印回答
        if response and response.text:
            answer = response.text
            print(f"回答:\n{answer}")
            
            # 檢查是否有引用或來源
            if "[" in answer and "]" in answer and "(" in answer and ")" in answer:
                print("\n來源:")
                # 簡單的正則表達式來提取 Markdown 格式的鏈接
                import re
                links = re.findall(r'\[(.*?)\]\((.*?)\)', answer)
                for title, url in links:
                    print(f"- {title}: {url}")
            else:
                print("\n未找到來源鏈接")
            
            # 打印使用統計信息（如果可用）
            if hasattr(response, 'prompt_feedback'):
                print("\n使用統計:")
                print(f"提示詞反饋: {response.prompt_feedback}")
            
            return response
        else:
            print("未收到有效回答")
            return None
        
    except Exception as e:
        print(f"錯誤: {e}")
        return None

def main():
    # 測試案例
    test_queries = [
        "今天的新聞頭條是什麼？",
        "NVIDIA 股票的當前價格是多少？",
        "最新的 AI 技術發展有哪些？",
    ]
    
    print("測試 Gemini 2.0 Flash 網路搜尋功能")
    print("=" * 50)
    print(f"測試開始時間: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    for query in test_queries:
        test_gemini_web_search(query)
        print("\n" + "=" * 50)

if __name__ == "__main__":
    main() 