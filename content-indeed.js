// Indeed Job Flag - Content Script
// Production-ready with resilient selectors and detail-panel-only analysis

(function () {
    'use strict';

    let isActive = true;
    let currentJobId = null;
    let currentBadge = null;

    /**
     * =========================================================================
     * RESILIENT SELECTORS FOR INDEED
     * Multiple fallbacks for when Indeed changes their DOM
     * =========================================================================
     */
    const SELECTORS = {
        // Detail panel containers (right side panel)
        detailPanel: [
            '.jobsearch-ViewJobLayout-jobDisplay',
            '.jobsearch-JobComponent',
            '#jobsearch-ViewJobLayout',
            '[class*="ViewJobLayout"]',
            '.job-view-layout'
        ],
        // Job title in detail panel
        detailTitle: [
            'h2.jobsearch-JobInfoHeader-title',
            '.jobsearch-JobInfoHeader-title',
            'h1.jobsearch-JobInfoHeader-title',
            '[data-testid="jobsearch-JobInfoHeader-title"]',
            '.jobTitle',
            'h2[class*="JobInfoHeader"]',
            'h1[class*="jobTitle"]'
        ],
        // Job description content
        description: [
            '#jobDescriptionText',
            '.jobDescriptionText',
            '.jobsearch-jobDescriptionText',
            '[id*="jobDescription"]',
            '[class*="jobDescription"]',
            '.job-description'
        ],
        // Company info
        companyName: [
            '[data-company-name="true"]',
            '[data-testid="inlineHeader-companyName"]',
            '.jobsearch-InlineCompanyRating-companyHeader a',
            '.jobsearch-CompanyInfoContainer a',
            '[class*="CompanyInfo"] a',
            '.companyName'
        ],
        // Company logo
        companyLogo: [
            '.jobsearch-CompanyAvatar img',
            '[class*="CompanyAvatar"] img',
            '.company-logo img'
        ]
    };

    /**
     * Find element using multiple fallback selectors
     */
    function findElement(selectorList, container = document) {
        for (const selector of selectorList) {
            try {
                const el = container.querySelector(selector);
                if (el) return el;
            } catch (e) {
                // Invalid selector, skip
            }
        }
        return null;
    }

    /**
     * Get text content safely
     */
    function getText(element) {
        if (!element) return '';
        return (element.innerText || element.textContent || '').trim();
    }

    /**
     * Semantic content detection - find description by looking for key phrases
     */
    function findDescriptionSemantically() {
        const headers = ['About the job', 'About the role', 'Job Description',
            'About The Role', 'Key Responsibilities', 'Responsibilities',
            'What you\'ll do', 'Requirements', 'Qualifications'];

        const allElements = document.querySelectorAll('section, article, div[id*="job"], div[class*="job"]');

        for (const el of allElements) {
            const text = el.innerText || '';
            for (const header of headers) {
                if (text.includes(header) && text.length > 200) {
                    return text;
                }
            }
        }
        return '';
    }

    /**
     * Scrape job data from the detail panel
     */
    function scrapeJobData() {
        const data = {
            title: '',
            company: '',
            description: '',
            companyLogo: 'missing'
        };

        // Get job title
        const titleEl = findElement(SELECTORS.detailTitle);
        data.title = getText(titleEl);

        // Get company name
        const companyEl = findElement(SELECTORS.companyName);
        data.company = getText(companyEl);

        // Get job description
        const descEl = findElement(SELECTORS.description);
        if (descEl) {
            data.description = getText(descEl);
        }

        // Fallback to semantic detection
        if (!data.description || data.description.length < 100) {
            data.description = findDescriptionSemantically();
        }

        // Check for company logo
        const logoEl = findElement(SELECTORS.companyLogo);
        if (logoEl && logoEl.src && !logoEl.src.includes('placeholder')) {
            data.companyLogo = 'present';
        }

        console.log('IJF: Scraped job data:', {
            title: data.title.substring(0, 50),
            company: data.company,
            descLength: data.description.length,
            hasLogo: data.companyLogo === 'present'
        });

        return data;
    }

    /**
     * Create the badge element
     */
    function createBadge(result) {
        const badge = document.createElement('div');
        badge.className = `ijf-badge ijf-badge--${result.riskLevel}`;
        badge.id = 'ijf-detail-badge';

        // Show percentage
        badge.textContent = `${result.realPercentage}%`;

        // Create tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'ijf-tooltip';

        // Tooltip header
        const header = document.createElement('div');
        header.className = 'ijf-tooltip__header';
        const statusText = result.riskLevel === 'green' ? 'Likely Legitimate' :
            result.riskLevel === 'yellow' ? 'Some Concerns' : 'High Risk';
        const sourceIcon = result.source === 'groq' ? '✨' : '📋';
        header.innerHTML = `
            <span class="ijf-tooltip__title">${sourceIcon} ${statusText}</span>
            <span class="ijf-tooltip__score ijf-tooltip__score--${result.riskLevel}">
                ${result.realPercentage}%
            </span>
        `;
        tooltip.appendChild(header);

        // AI Summary (if available)
        if (result.summary) {
            const summary = document.createElement('div');
            summary.className = 'ijf-tooltip__summary';
            summary.textContent = result.summary;
            tooltip.appendChild(summary);
        }

        // Red flags
        if (result.redFlags && result.redFlags.length > 0) {
            const flagsTitle = document.createElement('div');
            flagsTitle.className = 'ijf-tooltip__section-title';
            flagsTitle.textContent = '⚠️ Red Flags';
            tooltip.appendChild(flagsTitle);

            const flagsList = document.createElement('ul');
            flagsList.className = 'ijf-tooltip__flags';
            result.redFlags.slice(0, 5).forEach(flag => {
                const li = document.createElement('li');
                li.className = 'ijf-tooltip__flag';
                li.textContent = flag;
                flagsList.appendChild(li);
            });
            tooltip.appendChild(flagsList);
        }

        // Positive signals
        if (result.positiveSignals && result.positiveSignals.length > 0) {
            const posTitle = document.createElement('div');
            posTitle.className = 'ijf-tooltip__section-title';
            posTitle.textContent = '✅ Positive Signals';
            tooltip.appendChild(posTitle);

            const posList = document.createElement('ul');
            posList.className = 'ijf-tooltip__flags ijf-tooltip__flags--positive';
            result.positiveSignals.slice(0, 3).forEach(signal => {
                const li = document.createElement('li');
                li.className = 'ijf-tooltip__flag ijf-tooltip__flag--positive';
                li.textContent = signal;
                posList.appendChild(li);
            });
            tooltip.appendChild(posList);
        }

        // No flags message
        if ((!result.redFlags || result.redFlags.length === 0) && !result.summary) {
            const safe = document.createElement('div');
            safe.className = 'ijf-tooltip__safe';
            safe.textContent = '✓ No red flags detected';
            tooltip.appendChild(safe);
        }

        // Source indicator
        const source = document.createElement('div');
        source.className = 'ijf-tooltip__source';
        source.textContent = result.source === 'groq' ? 'Analyzed by Groq AI' : 'Basic rule analysis';
        tooltip.appendChild(source);

        badge.appendChild(tooltip);
        return badge;
    }

    /**
     * Inject badge into the detail panel
     */
    function injectBadge(result) {
        // Remove existing badge
        const existingBadge = document.getElementById('ijf-detail-badge');
        if (existingBadge) {
            existingBadge.remove();
        }

        // Find the title element
        const titleEl = findElement(SELECTORS.detailTitle);
        if (!titleEl) {
            console.log('IJF: Could not find title element for badge injection');
            return;
        }

        // Create badge
        const badge = createBadge(result);
        badge.classList.add('ijf-badge--fixed');

        // Find the title's container row and make it relative
        const titleRow = titleEl.closest('div') || titleEl.parentElement;
        if (titleRow) {
            titleRow.style.position = 'relative';
            titleRow.appendChild(badge);
        } else {
            titleEl.insertAdjacentElement('afterend', badge);
        }

        currentBadge = badge;
        console.log('IJF: Badge injected with score:', result.realPercentage);
    }

    /**
     * Get job ID from Indeed URL
     */
    function getJobIdFromUrl() {
        // Indeed uses ?jk=JOBID or /viewjob?jk=JOBID
        const urlParams = new URLSearchParams(window.location.search);
        const jk = urlParams.get('jk');
        if (jk) return jk;

        // Also check for vjk parameter (view job key)
        const vjk = urlParams.get('vjk');
        if (vjk) return vjk;

        // Check URL path pattern
        const pathMatch = location.pathname.match(/\/viewjob\/([a-zA-Z0-9]+)/);
        if (pathMatch) return pathMatch[1];

        return null;
    }

    /**
     * Analyze the current job in detail panel
     */
    async function analyzeCurrentJob() {
        // Check if detail panel exists
        const detailPanel = findElement(SELECTORS.detailPanel);
        if (!detailPanel) {
            console.log('IJF: No detail panel found');
            return;
        }

        // Get current job ID from URL
        const jobId = getJobIdFromUrl();

        // Skip if same job
        if (jobId && jobId === currentJobId) {
            return;
        }

        currentJobId = jobId;
        console.log('IJF: Analyzing job:', jobId);

        // Wait a bit for content to load
        await new Promise(resolve => setTimeout(resolve, 500));

        // Scrape job data
        const jobData = scrapeJobData();

        // Skip if no meaningful data
        if (!jobData.title && !jobData.description) {
            console.log('IJF: No job data found');
            return;
        }

        try {
            // Send to background for analysis
            const result = await chrome.runtime.sendMessage({
                action: 'analyzeJob',
                jobData
            });

            if (result) {
                injectBadge(result);
            }
        } catch (error) {
            console.error('IJF: Error analyzing job:', error);
        }
    }

    /**
     * Initialize observer for job changes
     */
    function initObserver() {
        // Watch for URL changes (Indeed uses client-side routing)
        let lastUrl = location.href;

        const urlObserver = setInterval(() => {
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                currentJobId = null;
                setTimeout(analyzeCurrentJob, 500);
            }
        }, 500);

        // Watch for DOM changes in the detail panel area
        const mutationObserver = new MutationObserver((mutations) => {
            clearTimeout(window.ijfMutationTimeout);
            window.ijfMutationTimeout = setTimeout(() => {
                analyzeCurrentJob();
            }, 300);
        });

        // Start observing
        mutationObserver.observe(document.body, {
            childList: true,
            subtree: true
        });

        console.log('IJF: Observers initialized');
    }

    /**
     * Listen for messages from popup
     */
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'toggleActive') {
            isActive = request.isActive;
            if (isActive) {
                analyzeCurrentJob();
            } else {
                const badge = document.getElementById('ijf-detail-badge');
                if (badge) badge.remove();
            }
            sendResponse({ success: true });
        }
        return true;
    });

    /**
     * Initialize extension
     */
    async function init() {
        try {
            const { isActive: active = true } = await chrome.storage.local.get(['isActive']);
            isActive = active;
        } catch (e) {
            isActive = true;
        }

        if (isActive) {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => {
                    setTimeout(analyzeCurrentJob, 1000);
                    initObserver();
                });
            } else {
                setTimeout(analyzeCurrentJob, 1000);
                initObserver();
            }
        }

        console.log('IJF: Indeed Job Flag initialized (detail panel only mode)');
    }

    // Start
    init();
})();
