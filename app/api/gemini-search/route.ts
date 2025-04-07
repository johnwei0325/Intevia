import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

// 將 exec 轉換為 Promise
const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const { query, model } = await request.json();

    if (!query) {
      return NextResponse.json(
        { error: 'No query provided' },
        { status: 400 }
      );
    }

    // 使用 Python 腳本進行搜尋
    const scriptPath = path.join(process.cwd(), 'scripts', 'gemini_search.py');
    const { stdout, stderr } = await execAsync(`python3 "${scriptPath}" "${query}" "${model || 'gemini-2.0-flash'}"`);
    
    if (stderr) {
      console.error(`[GeminiSearchAPI] Python 腳本錯誤: ${stderr}`);
      console.log(`[GeminiSearchAPI] Python 腳本 stderr 輸出: ${stderr}`);
    }
    
    // 解析 Python 腳本的輸出
    const result = JSON.parse(stdout);
    
    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('[GeminiSearchAPI] 搜尋錯誤:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 