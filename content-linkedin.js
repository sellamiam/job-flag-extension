// LinkedIn Job Flag - Content Script
// Production-ready with resilient selectors and detail-panel-only analysis

(function () {
    'use strict';

    let isActive = true;
    let currentJobId = null;
    let currentBadge = null;

    /**
     * =========================================================================
     * RESILIENT SELECTORS
     * Multiple fallbacks for when LinkedIn changes their DOM
     * =========================================================================
     */
    const SELECTORS = {
        // Detail panel containers (right side panel)
        detailPanel: [
            '.jobs-search__job-details',
            '.scaffold-layout__detail',
            '.job-view-layout',
            '[class*="job-details"]',
            '[class*="jobs-details"]'
        ],
        // Job title in detail panel
        detailTitle: [
            '.job-details-jobs-unified-top-card__job-title',
            '.jobs-unified-top-card__job-title',
            '.t-24.t-bold',
            'h1[class*="job-title"]',
            'h1',
            'h2.t-24'
        ],
        // Job description content
        description: [
            '#job-details',
            '.jobs-description__content',
            '.jobs-description-content__text',
            '.jobs-box__html-content',
            '[class*="jobs-description"]',
            '.jobs-description',
            'article[class*="jobs"]'
        ],
        // Company info
        companyName: [
            '.job-details-jobs-unified-top-card__company-name',
            '.jobs-unified-top-card__company-name',
            '[class*="company-name"]',
            '.jobs-unified-top-card__subtitle-primary-grouping a'
        ],
        // Company logo
        companyLogo: [
            '.jobs-unified-top-card__company-logo img',
            '.EntityPhoto-square-3 img',
            '[class*="company-logo"] img'
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
        // Use innerText for cleaner formatting (respects display:none, etc.)
        return (element.innerText || element.textContent || '').trim();
    }

    /**
     * Semantic content detection - find description by looking for key phrases
     * This is more resilient than CSS selectors
     */
    function findDescriptionSemantically() {
        // Look for common job description headers
        const headers = ['About the job', 'About the role', 'Job Description',
            'About The Role', 'Key Responsibilities', 'Responsibilities'];

        const allElements = document.querySelectorAll('section, article, div[class*="jobs"]');

        for (const el of allElements) {
            const text = el.innerText || '';
            // Check if this element contains job description content
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

        // Get job description - try selectors first, then semantic detection
        const descEl = findElement(SELECTORS.description);
        if (descEl) {
            data.description = getText(descEl);
        }

        // Fallback to semantic detection if selector failed
        if (!data.description || data.description.length < 100) {
            data.description = findDescriptionSemantically();
        }

        // Check for company logo
        const logoEl = findElement(SELECTORS.companyLogo);
        if (logoEl && logoEl.src && !logoEl.src.includes('ghost')) {
            data.companyLogo = 'present';
        }

        console.log('LJF: Scraped job data:', {
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
        badge.className = `lfj-badge lfj-badge--${result.riskLevel}`;
        badge.id = 'lfj-detail-badge';

        // Show percentage
        badge.textContent = `${result.realPercentage}%`;

        // Create tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'lfj-tooltip';

        // Tooltip header
        const header = document.createElement('div');
        header.className = 'lfj-tooltip__header';
        const statusText = result.riskLevel === 'green' ? 'Likely Legitimate' :
            result.riskLevel === 'yellow' ? 'Some Concerns' : 'High Risk';
        const sourceIcon = result.source === 'gemini' ? '✨' : '📋';
        header.innerHTML = `
            <span class="lfj-tooltip__title">${sourceIcon} ${statusText}</span>
            <span class="lfj-tooltip__score lfj-tooltip__score--${result.riskLevel}">
                ${result.realPercentage}%
            </span>
        `;
        tooltip.appendChild(header);

        // AI Summary (if available)
        if (result.summary) {
            const summary = document.createElement('div');
            summary.className = 'lfj-tooltip__summary';
            summary.textContent = result.summary;
            tooltip.appendChild(summary);
        }

        // Red flags
        if (result.redFlags && result.redFlags.length > 0) {
            const flagsTitle = document.createElement('div');
            flagsTitle.className = 'lfj-tooltip__section-title';
            flagsTitle.textContent = '⚠️ Red Flags';
            tooltip.appendChild(flagsTitle);

            const flagsList = document.createElement('ul');
            flagsList.className = 'lfj-tooltip__flags';
            result.redFlags.slice(0, 5).forEach(flag => {
                const li = document.createElement('li');
                li.className = 'lfj-tooltip__flag';
                li.textContent = flag;
                flagsList.appendChild(li);
            });
            tooltip.appendChild(flagsList);
        }

        // Positive signals (if available)
        if (result.positiveSignals && result.positiveSignals.length > 0) {
            const posTitle = document.createElement('div');
            posTitle.className = 'lfj-tooltip__section-title';
            posTitle.textContent = '✅ Positive Signals';
            tooltip.appendChild(posTitle);

            const posList = document.createElement('ul');
            posList.className = 'lfj-tooltip__flags lfj-tooltip__flags--positive';
            result.positiveSignals.slice(0, 3).forEach(signal => {
                const li = document.createElement('li');
                li.className = 'lfj-tooltip__flag lfj-tooltip__flag--positive';
                li.textContent = signal;
                posList.appendChild(li);
            });
            tooltip.appendChild(posList);
        }

        // No flags message
        if ((!result.redFlags || result.redFlags.length === 0) && !result.summary) {
            const safe = document.createElement('div');
            safe.className = 'lfj-tooltip__safe';
            safe.textContent = '✓ No red flags detected';
            tooltip.appendChild(safe);
        }

        // Source indicator
        const source = document.createElement('div');
        source.className = 'lfj-tooltip__source';
        source.textContent = result.source === 'gemini' ? 'Analyzed by Gemini AI' : 'Basic rule analysis';
        tooltip.appendChild(source);

        badge.appendChild(tooltip);
        return badge;
    }

    /**
     * Inject badge into the detail panel
     */
    function injectBadge(result) {
        // Remove existing badge
        const existingBadge = document.getElementById('lfj-detail-badge');
        if (existingBadge) {
            existingBadge.remove();
        }

        // Find the title element to inject next to
        const titleEl = findElement(SELECTORS.detailTitle);
        if (!titleEl) {
            console.log('LJF: Could not find title element for badge injection');
            return;
        }

        // Create and inject badge
        const badge = createBadge(result);

        // Try to inject next to title
        const titleContainer = titleEl.closest('div') || titleEl.parentElement;
        if (titleContainer) {
            titleContainer.style.display = 'flex';
            titleContainer.style.alignItems = 'center';
            titleContainer.style.flexWrap = 'wrap';
            titleContainer.style.gap = '8px';
            titleEl.insertAdjacentElement('afterend', badge);
        } else {
            titleEl.insertAdjacentElement('afterend', badge);
        }

        currentBadge = badge;
        console.log('LJF: Badge injected with score:', result.realPercentage);
    }

    /**
     * Analyze the current job in detail panel
     */
    async function analyzeCurrentJob() {
        // Check if detail panel exists
        const detailPanel = findElement(SELECTORS.detailPanel);
        if (!detailPanel) {
            console.log('LJF: No detail panel found');
            return;
        }

        // Get current job ID from URL
        const urlMatch = location.href.match(/currentJobId=(\d+)|\/jobs\/view\/(\d+)/);
        const jobId = urlMatch ? (urlMatch[1] || urlMatch[2]) : null;

        // Skip if same job
        if (jobId && jobId === currentJobId) {
            return;
        }

        currentJobId = jobId;
        console.log('LJF: Analyzing job:', jobId);

        // Wait a bit for content to load
        await new Promise(resolve => setTimeout(resolve, 500));

        // Scrape job data
        const jobData = scrapeJobData();

        // Skip if no meaningful data
        if (!jobData.title && !jobData.description) {
            console.log('LJF: No job data found');
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
            console.error('LJF: Error analyzing job:', error);
        }
    }

    /**
     * Initialize observer for job changes
     */
    function initObserver() {
        // Watch for URL changes (LinkedIn uses client-side routing)
        let lastUrl = location.href;

        const urlObserver = setInterval(() => {
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                currentJobId = null; // Reset to force re-analysis
                setTimeout(analyzeCurrentJob, 500);
            }
        }, 500);

        // Watch for DOM changes in the detail panel area
        const mutationObserver = new MutationObserver((mutations) => {
            // Debounce
            clearTimeout(window.lfjMutationTimeout);
            window.lfjMutationTimeout = setTimeout(() => {
                analyzeCurrentJob();
            }, 300);
        });

        // Start observing
        mutationObserver.observe(document.body, {
            childList: true,
            subtree: true
        });

        console.log('LJF: Observers initialized');
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
                // Remove badge when disabled
                const badge = document.getElementById('lfj-detail-badge');
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
        // Check if extension is active
        try {
            const { isActive: active = true } = await chrome.storage.local.get(['isActive']);
            isActive = active;
        } catch (e) {
            isActive = true;
        }

        if (isActive) {
            // Wait for page to be ready
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

        console.log('LJF: LinkedIn Job Flag initialized (detail panel only mode)');
    }

    // Start
    init();
})();
