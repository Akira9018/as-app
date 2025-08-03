import { GPTUsage, WhisperUsage } from '../types';

// OpenAI API configuration
const OPENAI_API_KEY = process.env.REACT_APP_OPENAI_API_KEY;
const OPENAI_BASE_URL = 'https://api.openai.com/v1';

if (!OPENAI_API_KEY) {
    console.warn('OpenAI API key not found in environment variables');
}

// API request headers
const getHeaders = () => ({
    'Authorization': `Bearer ${OPENAI_API_KEY}`,
    'Content-Type': 'application/json',
});

// Whisper API - 音声文字起こし
export const transcribeAudio = async (
    audioFile: File,
    language: string = 'ja'
): Promise<{ text: string; usage: WhisperUsage }> => {
    if (!OPENAI_API_KEY) {
        throw new Error('OpenAI API key is not configured');
    }

    const formData = new FormData();
    formData.append('file', audioFile);
    formData.append('model', 'whisper-1');
    formData.append('language', language);
    formData.append('response_format', 'verbose_json');

    try {
        const startTime = Date.now();

        const response = await fetch(`${OPENAI_BASE_URL}/audio/transcriptions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
            },
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Transcription failed: ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        const processingTime = (Date.now() - startTime) / 1000;

        // 推定コスト計算（Whisperは$0.006/分）
        const durationMinutes = data.duration / 60;
        const estimatedCost = durationMinutes * 0.006;

        const usage: WhisperUsage = {
            audio_duration: data.duration,
            cost: estimatedCost,
        };

        return {
            text: data.text,
            usage,
        };
    } catch (error) {
        console.error('Audio transcription error:', error);
        throw error;
    }
};

// GPT-4 API - ケアプラン生成
export const generateCarePlan = async (
    transcript: string,
    promptTemplate: string,
    customInstructions?: string
): Promise<{ content: string; usage: GPTUsage }> => {
    if (!OPENAI_API_KEY) {
        throw new Error('OpenAI API key is not configured');
    }

    const systemPrompt = `${promptTemplate}\n\n${customInstructions || ''}`;

    const messages = [
        {
            role: 'system',
            content: systemPrompt.trim(),
        },
        {
            role: 'user',
            content: `以下のアセスメント記録を基に、ケアプランを作成してください：\n\n${transcript}`,
        },
    ];

    try {
        const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
                model: 'gpt-4',
                messages,
                max_tokens: 2000,
                temperature: 0.7,
                top_p: 1,
                frequency_penalty: 0,
                presence_penalty: 0,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`GPT-4 request failed: ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();

        // 使用量とコスト計算
        const usage: GPTUsage = {
            model: 'gpt-4',
            input_tokens: data.usage.prompt_tokens,
            output_tokens: data.usage.completion_tokens,
            cost: calculateGPT4Cost(data.usage.prompt_tokens, data.usage.completion_tokens),
        };

        return {
            content: data.choices[0].message.content,
            usage,
        };
    } catch (error) {
        console.error('Care plan generation error:', error);
        throw error;
    }
};

// GPT-3.5 API - 要約作成
export const summarizeTranscript = async (
    transcript: string
): Promise<{ summary: string; usage: GPTUsage }> => {
    if (!OPENAI_API_KEY) {
        throw new Error('OpenAI API key is not configured');
    }

    const systemPrompt = `
あなたは介護・医療分野の専門家です。
アセスメント面談の録音記録を要約してください。

要約のポイント：
- 重要な情報を漏らさない
- 簡潔で分かりやすい文章
- 専門用語は適切に使用
- 利用者の状況、ニーズ、課題を明確に
`;

    const messages = [
        {
            role: 'system',
            content: systemPrompt.trim(),
        },
        {
            role: 'user',
            content: `以下のアセスメント記録を要約してください：\n\n${transcript}`,
        },
    ];

    try {
        const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages,
                max_tokens: 1000,
                temperature: 0.5,
                top_p: 1,
                frequency_penalty: 0,
                presence_penalty: 0,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`GPT-3.5 request failed: ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();

        // 使用量とコスト計算
        const usage: GPTUsage = {
            model: 'gpt-3.5-turbo',
            input_tokens: data.usage.prompt_tokens,
            output_tokens: data.usage.completion_tokens,
            cost: calculateGPT35Cost(data.usage.prompt_tokens, data.usage.completion_tokens),
        };

        return {
            summary: data.choices[0].message.content,
            usage,
        };
    } catch (error) {
        console.error('Transcript summarization error:', error);
        throw error;
    }
};

// コスト計算ヘルパー関数
function calculateGPT4Cost(inputTokens: number, outputTokens: number): number {
    // GPT-4料金: $0.03/1K input tokens, $0.06/1K output tokens
    const inputCost = (inputTokens / 1000) * 0.03;
    const outputCost = (outputTokens / 1000) * 0.06;
    return inputCost + outputCost;
}

function calculateGPT35Cost(inputTokens: number, outputTokens: number): number {
    // GPT-3.5 Turbo料金: $0.001/1K input tokens, $0.002/1K output tokens
    const inputCost = (inputTokens / 1000) * 0.001;
    const outputCost = (outputTokens / 1000) * 0.002;
    return inputCost + outputCost;
}

// API接続テスト
export const testOpenAIConnection = async (): Promise<boolean> => {
    if (!OPENAI_API_KEY) {
        return false;
    }

    try {
        const response = await fetch(`${OPENAI_BASE_URL}/models`, {
            headers: getHeaders(),
        });
        return response.ok;
    } catch (error) {
        console.error('OpenAI connection test failed:', error);
        return false;
    }
};