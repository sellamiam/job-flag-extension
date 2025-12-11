// Job Flag - Background Service Worker
// Unified LLM-Based Fraud Detection for LinkedIn & Indeed (Groq API)

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.1-8b-instant';

const SYSTEM_PROMPT = `You are an expert at detecting fake and fraudulent job postings. Analyze job postings and determine if they're legitimate or scams.

Consider these red flags from academic research on job fraud:
1. FINANCIAL: Upfront fees, unrealistic salary (e.g., $5000+/month for entry-level remote work)
2. PROCESS: No interview required, immediate hiring, requests for personal info or off-platform contact
3. LINGUISTIC: Vague descriptions, MLM language, excessive urgency
4. STRUCTURAL: Missing company details, generic titles like "Task Tester", "Remote Assistant"

IMPORTANT: $5,000-8,000/month for a "testing assistant" or "data entry" role is EXTREMELY suspicious.

Respond with ONLY valid JSON (no markdown):
{
  "score": <0-100 where 0=scam, 100=legitimate>,
  "riskLevel": "<red|yellow|green>",
  "redFlags": ["<flag1>", ...],
  "positiveSignals": ["<signal1>", ...],
  "summary": "<one sentence>"
}`;

async function analyzeWithGroq(jobData, apiKey) {
    const truncatedDesc = (jobData.description || '').substring(0, 1500);

    const userMessage = `Analyze this job posting:

JOB TITLE: ${jobData.title}
COMPANY: ${jobData.company || 'Not specified'}
DESCRIPTION:
${truncatedDesc}`;

    try {
        const response = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: MODEL,
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: userMessage }
                ],
                temperature: 0.1,
                max_tokens: 500
            })
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('Groq API error:', error);
            throw new Error(error.error?.message || 'API request failed');
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content;

        if (!text) {
            throw new Error('No response from Groq');
        }

        let jsonText = text.trim();
        if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```/g, '');
        }

        const result = JSON.parse(jsonText);

        return {
            score: result.score ?? 50,
            riskLevel: result.riskLevel || (result.score >= 70 ? 'green' : result.score >= 40 ? 'yellow' : 'red'),
            redFlags: result.redFlags || [],
            positiveSignals: result.positiveSignals || [],
            summary: result.summary || '',
            realPercentage: result.score ?? 50,
            source: 'groq'
        };

    } catch (error) {
        console.error('Groq analysis failed:', error);
        throw error;
    }
}

function analyzeWithRules(jobData) {
    const text = `${jobData.title} ${jobData.description}`.toLowerCase();
    let score = 100;
    const redFlags = [];

    if (/usd\s*[5-9],?\d{3}|\$\s*[5-9],?\d{3}.*month/i.test(text)) {
        score -= 30;
        redFlags.push('💰 Unrealistic high salary');
    }
    if (/task\s*tester|testing\s*(assistant|team)|remote\s*assistant/i.test(jobData.title)) {
        score -= 25;
        redFlags.push('🏷️ Suspicious job title');
    }
    if (/part[\s-]*time.*contract|remote.*contract/i.test(text)) {
        score -= 10;
        redFlags.push('📋 Remote part-time contract');
    }
    if (/data\s*entry.*research|content.*coordination/i.test(text)) {
        score -= 15;
        redFlags.push('📝 Vague responsibilities');
    }
    if (/training.*provided|no\s*experience/i.test(text)) {
        score -= 10;
        redFlags.push('⚠️ No experience required');
    }

    score = Math.max(0, score);

    return {
        score,
        riskLevel: score >= 70 ? 'green' : score >= 40 ? 'yellow' : 'red',
        redFlags,
        positiveSignals: [],
        summary: 'Basic analysis - add API key for AI-powered detection',
        realPercentage: score,
        source: 'rules'
    };
}

async function analyzeJob(jobData) {
    const { groqApiKey } = await chrome.storage.local.get(['groqApiKey']);

    if (groqApiKey) {
        try {
            console.log('JF: Using Groq API for analysis');
            return await analyzeWithGroq(jobData, groqApiKey);
        } catch (error) {
            console.error('JF: Groq failed, using rules:', error.message);
            const result = analyzeWithRules(jobData);
            result.error = error.message;
            return result;
        }
    } else {
        console.log('JF: No API key, using rule-based analysis');
        return analyzeWithRules(jobData);
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'analyzeJob') {
        analyzeJob(request.jobData)
            .then(result => {
                updateStats(result.redFlags?.length > 0);
                sendResponse(result);
            })
            .catch(error => {
                sendResponse({
                    error: error.message,
                    score: 50,
                    riskLevel: 'yellow',
                    realPercentage: 50,
                    redFlags: ['Analysis failed'],
                    summary: 'Could not analyze job'
                });
            });
        return true;
    }

    if (request.action === 'saveApiKey') {
        chrome.storage.local.set({ groqApiKey: request.apiKey })
            .then(() => sendResponse({ success: true }))
            .catch(error => sendResponse({ error: error.message }));
        return true;
    }

    if (request.action === 'getApiKey') {
        chrome.storage.local.get(['groqApiKey'])
            .then(result => sendResponse({ apiKey: result.groqApiKey || '' }))
            .catch(error => sendResponse({ error: error.message }));
        return true;
    }

    if (request.action === 'getStats') {
        chrome.storage.local.get(['stats'])
            .then(result => sendResponse(result.stats || { jobsAnalyzed: 0, flagsTriggered: 0 }))
            .catch(() => sendResponse({ jobsAnalyzed: 0, flagsTriggered: 0 }));
        return true;
    }

    return true;
});

async function updateStats(hasFlags) {
    try {
        const { stats = { jobsAnalyzed: 0, flagsTriggered: 0 } } =
            await chrome.storage.local.get(['stats']);
        stats.jobsAnalyzed += 1;
        if (hasFlags) stats.flagsTriggered += 1;
        await chrome.storage.local.set({ stats });
    } catch (e) {
        console.error('Stats update failed:', e);
    }
}

chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({
        isActive: true,
        stats: { jobsAnalyzed: 0, flagsTriggered: 0 }
    });
    console.log('Job Flag: Groq-powered analyzer installed');
});
