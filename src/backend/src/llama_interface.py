from llama_cpp import Llama
import random
import time
from pynvml import nvmlInit, nvmlDeviceGetHandleByIndex, nvmlDeviceGetMemoryInfo

def setup_llama(model_path, n_gpu_layers=-1, n_ctx=10000, chat_format="chatml-function-calling"):

    seed = int(time.time())
        
    return Llama(
        model_path=model_path,
        n_gpu_layers=n_gpu_layers,
        seed=seed,
        n_ctx=n_ctx,
        chat_format=chat_format,
        verbose=False
    )

def ask_llama(llm, prompt=None, system=None, conversation_history=None, agent_name = None, max_tokens=None):
    
    # Create messages list
    messages = []
    
    if prompt:
        messages.append({
                "role": "user",
                "content": prompt
            })
        
    if system:
        messages.append({
            "role": "system",
            "content": system
        })

    if conversation_history and agent_name:
        for message in conversation_history:
            user_or_agent = message.split(": ")[0]
            if user_or_agent == agent_name: # agent message
                messages.append({
                    "role": "assistant",
                    "content": message[len(user_or_agent)+2:]
                })
            else: # user message
                messages.append({
                    "role": "user",
                    "content": message[len(user_or_agent)+2:]
                })
        
    

    # Generate completion with max_tokens parameter if provided
    response = llm.create_chat_completion(
        messages=messages,
        max_tokens=max_tokens
    )
    
    # Extract and return only the text content
    if "choices" in response and len(response["choices"]) > 0:
        # Extract the assistant's message content
        if "message" in response["choices"][0]:
            if "content" in response["choices"][0]["message"] and response["choices"][0]["message"]["content"]:
                return response["choices"][0]["message"]["content"]
            # For function calling responses
            elif "tool_calls" in response["choices"][0]["message"]:
                return str(response["choices"][0]["message"]["tool_calls"])
    
    # Fallback if response format is unexpected
    return str(response)






