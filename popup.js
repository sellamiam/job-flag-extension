// Job Flag - Popup Script (Unified for LinkedIn & Indeed)

document.addEventListener('DOMContentLoaded', async () => {
    const apiKeyInput = document.getElementById('api-key');
    const saveKeyBtn = document.getElementById('save-key');
    const apiStatus = document.getElementById('api-status');
    const jobsAnalyzedEl = document.getElementById('jobs-analyzed');
    const flagsTriggeredEl = document.getElementById('flags-triggered');

    // Load existing API key
    try {
        const response = await chrome.runtime.sendMessage({ action: 'getApiKey' });
        if (response.apiKey) {
            apiKeyInput.value = '••••••••••••••••';
            apiKeyInput.dataset.hasKey = 'true';
            updateApiStatus(true);
        }
    } catch (e) {
        console.error('Failed to get API key:', e);
    }

    // Load stats
    try {
        const stats = await chrome.runtime.sendMessage({ action: 'getStats' });
        jobsAnalyzedEl.textContent = stats.jobsAnalyzed || 0;
        flagsTriggeredEl.textContent = stats.flagsTriggered || 0;
    } catch (e) {
        console.error('Failed to get stats:', e);
    }

    // Save API key
    saveKeyBtn.addEventListener('click', async () => {
        const apiKey = apiKeyInput.value.trim();

        if (apiKey === '••••••••••••••••') return;
        if (!apiKey) {
            updateApiStatus(false, 'Please enter an API key');
            return;
        }

        saveKeyBtn.disabled = true;
        saveKeyBtn.textContent = '...';

        try {
            const testResult = await testApiKey(apiKey);

            if (testResult.success) {
                await chrome.runtime.sendMessage({ action: 'saveApiKey', apiKey });
                apiKeyInput.value = '••••••••••••••••';
                apiKeyInput.dataset.hasKey = 'true';
                updateApiStatus(true);
            } else {
                updateApiStatus(false, testResult.error || 'Invalid API key');
            }
        } catch (e) {
            updateApiStatus(false, e.message);
        } finally {
            saveKeyBtn.disabled = false;
            saveKeyBtn.textContent = 'Save';
        }
    });

    // Clear masked input on focus
    apiKeyInput.addEventListener('focus', () => {
        if (apiKeyInput.dataset.hasKey === 'true') {
            apiKeyInput.value = '';
            apiKeyInput.type = 'text';
        }
    });

    apiKeyInput.addEventListener('blur', () => {
        if (apiKeyInput.dataset.hasKey === 'true' && !apiKeyInput.value) {
            apiKeyInput.value = '••••••••••••••••';
            apiKeyInput.type = 'password';
        }
    });

    function updateApiStatus(connected, message) {
        if (connected) {
            apiStatus.className = 'api-status connected';
            apiStatus.innerHTML = '● Connected to Groq AI';
        } else {
            apiStatus.className = 'api-status disconnected';
            apiStatus.innerHTML = message ? `⚠ ${message}` : '○ Not configured';
        }
    }

    async function testApiKey(apiKey) {
        try {
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'llama-3.1-8b-instant',
                    messages: [{ role: 'user', content: 'Say ok' }],
                    max_tokens: 5
                })
            });

            if (response.ok) {
                return { success: true };
            } else {
                const data = await response.json();
                return { success: false, error: data.error?.message || 'API error' };
            }
        } catch (e) {
            return { success: false, error: 'Connection failed' };
        }
    }

    // Listen for stats updates
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.stats) {
            const newStats = changes.stats.newValue;
            jobsAnalyzedEl.textContent = newStats.jobsAnalyzed || 0;
            flagsTriggeredEl.textContent = newStats.flagsTriggered || 0;
        }
    });
});
