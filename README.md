# Job Flag

**AI-Powered Fake Job Detector for LinkedIn and Indeed**

A Chrome extension that uses AI to detect and flag potentially fraudulent job postings, helping job seekers avoid scams.

![Job Flag Extension](screenshot.png)

---

## Features

- **AI-Powered Analysis** — Uses Groq's Llama 3.1 model to analyze job postings
- **Multi-Platform Support** — Works on LinkedIn and Indeed
- **Risk Scoring** — Provides 0-100% legitimacy scores
- **Detailed Explanations** — Hover over badges for analysis details
- **Free to Use** — Uses Groq's free API tier

---

## Installation

1. Clone or download this repository:
   ```bash
   git clone https://github.com/sellamiam/job-flag-extension.git
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable **Developer mode** (toggle in top-right corner)

4. Click **Load unpacked** and select the `job-flag-extension` folder

5. The extension icon will appear in your toolbar

---

## Setup

### Get a Free Groq API Key

1. Go to [console.groq.com](https://console.groq.com) and create an account
2. Navigate to [API Keys](https://console.groq.com/keys)
3. Click **Create API Key**, name it, and copy the key

### Configure the Extension

1. Click the Job Flag extension icon in Chrome
2. Paste your API key and click **Save**
3. You'll see "Connected to Groq AI" when configured

---

## Usage

1. Browse job listings on LinkedIn or Indeed
2. The extension automatically analyzes each job posting
3. Look for the risk badge on job listings:
   - **70-100%** — Likely legitimate (green)
   - **40-69%** — Some concerns (yellow)
   - **0-39%** — High risk (red)
4. Hover over badges for detailed analysis

---

## What It Detects

The AI analyzes job postings for common scam indicators:

- Unrealistic salary promises
- Vague job descriptions
- Requests for upfront payments
- Suspicious email domains
- Missing company information
- Work-from-home schemes with no requirements
- Pyramid scheme language
- Urgency tactics

---

## Supported Platforms

| Platform | Status |
|----------|--------|
| LinkedIn | Supported |
| Indeed (US, CA, UK) | Supported |

---

## Privacy

- Job data is only sent to Groq for analysis
- API keys are stored locally in Chrome
- No personal information is collected

---

## Disclaimer

This tool helps identify potentially fraudulent job postings but is not 100% accurate. Always do your own research and never pay money to get a job.

---

## License

MIT License
