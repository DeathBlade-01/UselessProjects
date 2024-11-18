import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(request: Request) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        
        if (!apiKey) {
            console.error('Missing GEMINI_API_KEY in environment variables');
            return NextResponse.json(
                { error: 'API configuration error' },
                { status: 500 }
            );
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const requestData = await request.json();
        const { length, complexity } = requestData;

        if (!length || !complexity) {
            return NextResponse.json(
                { error: 'Missing length or complexity in request' },
                { status: 400 }
            );
        }

        // Enhanced prompt for more unique and interesting sentences
        const prompt = `Generate a unique and interesting ${complexity} level English sentence that is approximately ${length*0.1} words long.

        Requirements:
        - The sentence must be completely unique and creative
        - It should contain interesting or unexpected elements while remaining logical
        - Use ${
            complexity === 'basic' ? 'simple words and clear structure, but make it engaging' :
            complexity === 'intermediate' ? 'moderate vocabulary with some descriptive elements and interesting subject matter' :
            'sophisticated vocabulary and complex structure, incorporating abstract concepts or unusual perspectives'
        }
        - Topics can include: science, nature, history, technology, art, human behavior, or imaginative scenarios
        - Avoid cliché phrases and common examples
        - Make sure it's grammatically correct and meaningful
        - The sentence should be self-contained and not require additional context
        - Include vivid details or unexpected connections between ideas

        Return only the sentence without any additional text, explanation, or punctuation at the start or end.`;

        console.log('Calling Gemini API with enhanced prompt...');

        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const sentence = response.text().trim();

        console.log('Generated sentence:', sentence);

        if (!sentence) {
            return NextResponse.json(
                { error: 'No sentence generated' },
                { status: 500 }
            );
        }

        // Additional check for sentence uniqueness and quality
        if (sentence.length < length * 0.8 || sentence.length > length * 1.2) {
            console.log('Sentence length out of desired range, generating new one...');
            // You could implement retry logic here if needed
        }

        return NextResponse.json({ sentence });
    } catch (error) {
        console.error('Detailed API error:', {
            error: error instanceof Error ? {
                message: error.message,
                stack: error.stack
            } : error,
            timestamp: new Date().toISOString()
        });

        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}