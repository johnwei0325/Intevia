import os
import json
import time
from datetime import datetime
from google.generativeai import GenerativeModel, configure
from openai import OpenAI

# 設置 API 金鑰
GEMINI_API_KEY = os.environ.get("NEXT_PUBLIC_GEMINI_API_KEY", "your_gemini_api_key_here")
PERPLEXITY_API_KEY = os.environ.get("PERPLEXITY_API_KEY", "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")

# 配置 Gemini
configure(api_key=GEMINI_API_KEY)

# 配置 Perplexity
perplexity_client = OpenAI(api_key=PERPLEXITY_API_KEY, base_url="https://api.perplexity.ai")

def test_gemini_web_search(query, model="gemini-2.0-flash-exp"):
    """
    測試 Gemini 2.0 Flash 的網路搜尋功能
    """
    try:
        print(f"\n[Gemini] 查詢: {query}")
        print("-" * 50)
        
        start_time = time.time()
        
        # 初始化 Gemini 模型
        model = GenerativeModel(model)
        
        # 構建提示詞
        prompt = f"""
        請提供關於以下問題的簡潔回答。保持回答簡短且切中要點。
        在回答末尾添加相關來源鏈接，格式為 [來源名稱](URL)。
        
        問題: {query}
        """
        
        # 發送請求
        print(f"[Gemini] 正在向 Gemini API 發送請求...")
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
        
        end_time = time.time()
        elapsed_time = end_time - start_time
        
        # 提取並打印回答
        if response and response.text:
            answer = response.text
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
            
            # 打印使用統計信息（如果可用）
            if hasattr(response, 'prompt_feedback'):
                print("\n[Gemini] 使用統計:")
                print(f"提示詞反饋: {response.prompt_feedback}")
            
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

def test_perplexity_web_search(query, model="sonar-small-online"):
    """
    測試 Perplexity 的網路搜尋功能
    """
    try:
        print(f"\n[Perplexity] 查詢: {query}")
        print("-" * 50)
        
        start_time = time.time()
        
        messages = [
            {
                "role": "system",
                "content": "Please provide a concise answer to the question. Keep your answer brief and to the point. Add relevant source links at the end in a new line, formatted as [Source name](URL)."
            },
            {
                "role": "user",
                "content": query
            }
        ]
        
        # 發送請求
        print(f"[Perplexity] 正在向 Perplexity API 發送請求...")
        response = perplexity_client.chat.completions.create(
            model=model,
            messages=messages,
            max_tokens=1024,
            temperature=0.2,
            top_p=0.9,
            stream=False,
            presence_penalty=0,
            frequency_penalty=1,
            response_format={"type": "text"},
            extra_body={
                "search_domain_filter": ["google.com"],
                "return_images": False,
                "return_related_questions": True,
                "search_recency_filter": "day",
                "top_k": 3,
                "web_search_options": {"search_context_size": "high"},
                "citations": True
            }
        )
        
        end_time = time.time()
        elapsed_time = end_time - start_time
        
        # 提取並打印回答
        if hasattr(response, 'choices') and len(response.choices) > 0:
            answer = response.choices[0].message.content
            print(f"[Perplexity] 回答:\n{answer}")
            
            # 檢查是否有引用或來源
            if hasattr(response.choices[0].message, 'citations') and response.choices[0].message.citations:
                print("\n[Perplexity] 來源:")
                links = []
                for citation in response.choices[0].message.citations:
                    url = citation.get('url', 'No URL')
                    title = citation.get('title', 'No Title')
                    print(f"- {title}: {url}")
                    links.append((title, url))
            else:
                print("\n[Perplexity] 未找到來源鏈接")
                links = []
            
            # 打印使用統計信息（如果可用）
            if hasattr(response, 'usage'):
                print("\n[Perplexity] 使用統計:")
                print(f"提示詞 tokens: {response.usage.prompt_tokens}")
                print(f"完成 tokens: {response.usage.completion_tokens}")
                print(f"總 tokens: {response.usage.total_tokens}")
            
            print(f"\n[Perplexity] 響應時間: {elapsed_time:.2f} 秒")
            
            return {
                "model": "perplexity",
                "query": query,
                "response": answer,
                "elapsed_time": elapsed_time,
                "links": links
            }
        else:
            print("[Perplexity] 未收到有效回答")
            return {
                "model": "perplexity",
                "query": query,
                "response": "未收到有效回答",
                "elapsed_time": elapsed_time,
                "links": []
            }
        
    except Exception as e:
        print(f"[Perplexity] 錯誤: {e}")
        return {
            "model": "perplexity",
            "query": query,
            "response": f"錯誤: {str(e)}",
            "elapsed_time": 0,
            "links": []
        }

def compare_results(gemini_result, perplexity_result):
    """
    比較 Gemini 和 Perplexity 的結果
    """
    print("\n" + "=" * 50)
    print("結果比較")
    print("=" * 50)
    
    print(f"查詢: {gemini_result['query']}")
    print(f"Gemini 響應時間: {gemini_result['elapsed_time']:.2f} 秒")
    print(f"Perplexity 響應時間: {perplexity_result['elapsed_time']:.2f} 秒")
    
    if gemini_result['elapsed_time'] > 0 and perplexity_result['elapsed_time'] > 0:
        faster = "Gemini" if gemini_result['elapsed_time'] < perplexity_result['elapsed_time'] else "Perplexity"
        print(f"更快的模型: {faster}")
    
    print("\nGemini 來源數量: " + str(len(gemini_result['links'])))
    print("Perplexity 來源數量: " + str(len(perplexity_result['links'])))
    
    # 比較回答長度
    gemini_length = len(gemini_result['response'])
    perplexity_length = len(perplexity_result['response'])
    print(f"\nGemini 回答長度: {gemini_length} 字符")
    print(f"Perplexity 回答長度: {perplexity_length} 字符")
    
    # 保存結果到文件
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"comparison_results_{timestamp}.json"
    
    with open(filename, "w", encoding="utf-8") as f:
        json.dump({
            "query": gemini_result['query'],
            "gemini": gemini_result,
            "perplexity": perplexity_result,
            "timestamp": timestamp
        }, f, ensure_ascii=False, indent=2)
    
    print(f"\n結果已保存到文件: {filename}")

def main():
    # 測試案例
    test_queries = [
        "今天的新聞頭條是什麼？",
        "NVIDIA 股票的當前價格是多少？",
        "最新的 AI 技術發展有哪些？",
    ]
    
    print("測試 Gemini 2.0 Flash 和 Perplexity 網路搜尋功能比較")
    print("=" * 50)
    print(f"測試開始時間: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    for query in test_queries:
        print("\n" + "=" * 50)
        print(f"測試查詢: {query}")
        print("=" * 50)
        
        # 測試 Gemini
        gemini_result = test_gemini_web_search(query)
        
        # 測試 Perplexity
        perplexity_result = test_perplexity_web_search(query)
        
        # 比較結果
        compare_results(gemini_result, perplexity_result)
        
        print("\n" + "=" * 50)
        print(f"查詢 '{query}' 測試完成")
        print("=" * 50)
        
        # 等待一下，避免 API 限制
        time.sleep(2)

if __name__ == "__main__":
    main() 