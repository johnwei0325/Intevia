## Prerequisites

- Node.js 18+ installed
- API key for Gemini 2.0 Model

## Getting Started

1. Clone the repository
```bash
cd Intevia
```

2. Install dependencies
```bash
npm install
# or
yarn install
```

3. Set up environment variables (目前是用我的）
Add your Gemini API key to `.env.local`:
```
NEXT_GEMINI_API_KEY=your_api_key_here
```

4. Running the Electron App
```bash
npm run electron-dev
# or
yarn electron-dev
```

5. To build the desktop app:

```bash
npm run electron-build
# or
yarn electron-build
```

## How to Use the Application

### Starting the Application

1. Launch the application using one of the methods above
2. The application will open in your browser or as a desktop app

### Setting Up Permissions

Before using the application, you need to grant the following permissions:

#### For Mac Users:
1. **Screen Recording Permission**:
   - Open System Settings > Privacy & Security > Screen Recording
   - Find your browser (Chrome/Safari) and enable it
   - Restart your browser

2. **Microphone Permission**:
   - Open System Settings > Privacy & Security > Microphone
   - Find your browser (Chrome/Safari) and enable it

#### For Windows Users:
1. When prompted, allow the application to access your screen and microphone
2. If permissions are denied, you can change them in Windows Settings > Privacy & Security

### Using the Application

1. **Starting Screen Capture**:
   - Click the wifi icon in the application
   - Click the screen icon to share screen and connect websocket
   - The application will start capturing your screen and audio

2. **Interacting with the AI**:
   - Speak naturally to interact with the AI
   - The AI will respond with text or voice (you can choose by clicking the voice icon)
   - You can ask questions, request information, or have conversations
   - You can ask for your screen's information

3. **Search Engine Selection**:
   - Use the dropdown menu to switch between Gemini and Perplexity search engines
   - If the answer includes citation or image, you can click the image icon or the search icon to see

### 目前還沒有及時聽會議並及時給答案的功能，現在只能根據使用者的問題回答而已，因為這個app總共使用到了三個LLM，gemini-2.0-flash-exp負責即時回答，但是因為不能上網，所以若是使用者問到需要上網查資料的時事，gemini會傳送一個[web search request]回來，再從app去問可以上網的gemini-2.0-flash或是perplexity（可以選，後者可以回傳照片，前者只能回傳citation，但是後者很貴）

### 若是想更改system prompt，請到app/services/geminiWebSocket.ts的185行改，這是gemini-2.0-flash-exp的，如果想改web searching LLM，請到app/services/perplexityService.ts的73or74行，或是app/services/geminiService.ts的216行

### Perplexity api在app/services/perplexityService.ts更改
