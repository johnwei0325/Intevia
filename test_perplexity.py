# import json
# from datetime import datetime
# from openai import OpenAI

# API_KEY = "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"

# def test_perplexity_search(query, model="sonar"):
#     """
#     Test Perplexity's web search capability with a given query using OpenAI client
#     """
#     try:
#         print(f"\nQuery: {query}")
#         print("-" * 50)
        
#         client = OpenAI(api_key=API_KEY, base_url="https://api.perplexity.ai")
        
#         messages = [
#             {
#                 "role": "system",
#                 "content": "Please provide a concise answer to the question. Keep your answer brief and to the point. Add relevant source links at the end in a new line, formatted as [Source name](URL)."
#             },
#             {
#                 "role": "user",
#                 "content": query
#             }
#         ]
        
#         # Chat completion without streaming
#         response = client.chat.completions.create(
#             model=model,
#             messages=messages,
#             max_tokens=1024,
#             temperature=0.2,
#             top_p=0.9,
#             stream=False,
#             presence_penalty=0,
#             frequency_penalty=1,
#             response_format={"type": "text"},
#             extra_body={
#                 "search_domain_filter": ["google.com"],
#                 "return_images": False,
#                 "return_related_questions": True,
#                 "search_recency_filter": "day",
#                 "top_k": 3,
#                 "web_search_options": {"search_context_size": "high"},
#                 "citations": True
#             }
#         )
        
#         # Extract and print the response
#         if hasattr(response, 'choices') and len(response.choices) > 0:
#             answer = response.choices[0].message.content
#             print(f"Response:\n{answer}")
            
#             # Check if there are any citations or sources in the response
#             if hasattr(response.choices[0].message, 'citations') and response.choices[0].message.citations:
#                 print("\nSources from API structure:")
#                 for citation in response.choices[0].message.citations:
#                     print(f"- {citation.get('url', 'No URL')}: {citation.get('title', 'No Title')}")
#             else:
#                 print("\nNo citations found in the API response structure.")
            
#             # Check if there are any related questions in the response
#             if hasattr(response.choices[0].message, 'related_questions') and response.choices[0].message.related_questions:
#                 print("\nRelated Questions from API structure:")
#                 for question in response.choices[0].message.related_questions:
#                     print(f"- {question}")
            
#             # Check if there are any images in the response
#             if hasattr(response.choices[0].message, 'images') and response.choices[0].message.images:
#                 print("\nImages from API structure:")
#                 for image in response.choices[0].message.images:
#                     print(f"- {image.get('url', 'No URL')}: {image.get('alt_text', 'No description')}")
            
#             # Print usage statistics if available
#             if hasattr(response, 'usage'):
#                 print("\nUsage Statistics:")
#                 print(f"Prompt tokens: {response.usage.prompt_tokens}")
#                 print(f"Completion tokens: {response.usage.completion_tokens}")
#                 print(f"Total tokens: {response.usage.total_tokens}")
        
#         return response
        
#     except Exception as e:
#         print(f"Error: {e}")
#         return None

# def main():
#     # Test cases
#     test_queries = [
#         "What are the top news stories today?",
#         "What is the current price of NVIDIA stock?",
#     ]
    
#     print("Testing Perplexity Web Search Capabilities")
#     print("=" * 50)
#     print(f"Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
#     for query in test_queries:
#         test_perplexity_search(query)
#         print("\n" + "=" * 50)

# if __name__ == "__main__":
#     main() 
from openai import OpenAI

YOUR_API_KEY = "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"

messages = [
    {
        "role": "system",
        "content": (
            "You are an artificial intelligence assistant and you need to "
            "engage in a helpful, detailed, polite conversation with a user."
        ),
    },
    {   
        "role": "user",
        "content": (
            "nvidia stock price?"
        ),
    },
]

client = OpenAI(api_key=YOUR_API_KEY, base_url="https://api.perplexity.ai")

# chat completion without streaming
response = client.chat.completions.create(
    model="sonar",
    messages=messages,
)
print(response)

# chat completion with streaming
# response_stream = client.chat.completions.create(
#     model="sonar",
#     messages=messages,
#     stream=True,
# )