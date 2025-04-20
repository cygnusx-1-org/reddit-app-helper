// background.js
// Service worker for the Reddit App Helper extension

// Note: We now import scripts via background-wrapper.js

console.log("RAH BG: Script loading/initializing...");

// --- Attach Message Listener Directly at Top Level ---
console.log("RAH BG: Attaching onMessage listener...");
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log(`RAH BG: Message received from tab ${sender.tab?.id}:`, request);

    if (request.action === "generateQrCode") {
        const { text, index } = request;
        console.log(`RAH BG: Matched generateQrCode request for index ${index}.`);
        if (!text) {
            console.error(`RAH BG: Invalid text received for QR generation (index ${index}).`);
            sendResponse({ action: "qrCodeGenerated", index: index, imageData: null, error: "Invalid text received by background script." });
            return false;
        }
        console.log(`RAH BG: Calling generateQRCode for index ${index}...`);
        generateQRCode(text, 128)
            .then(imageData => {
                console.log(`RAH BG: QR generated successfully for index ${index}. Sending response.`);
                sendResponse({ action: "qrCodeGenerated", index: index, imageData: imageData, error: null });
            })
            .catch(error => {
                console.error(`RAH BG: Error caught in generateQRCode promise for index ${index}:`, error);
                const errorString = `BG Error: ${error.name || 'Unknown Error'}: ${error.message || 'No message'}`;
                sendResponse({ action: "qrCodeGenerated", index: index, imageData: null, error: errorString });
            });
         return true; // Crucial: Indicate async response is coming via sendResponse
    }
    // Explicitly handle unknown actions
    else {
        console.warn(`RAH BG: Received unhandled message action: ${request.action}`);
        return false; // Not responding or not async
    }
});
console.log("RAH BG: onMessage listener attached.");

// --- QR Code Generation Logic ---
// Function to generate a QR code using the imported QrCreator library
async function generateQRCode(text, size = 64) {
    console.log(`RAH BG: generateQRCode called for text: "${text}"`);
    // Check if QrCreator is available *first*
    if (typeof QrCreator === 'undefined') {
        console.error('RAH BG: QrCreator library is undefined! Cannot generate QR. Ensure qr-creator.js is imported correctly.');
        // Attempt Firefox fallback directly if QrCreator is missing
        // return createQRDirectly(text, size); // Let's throw instead to make the error clearer
        throw new Error('QrCreator library not loaded in background script.');
    }

    try {
        // Check if OffscreenCanvas is supported (Chrome)
        if (typeof OffscreenCanvas !== 'undefined' && OffscreenCanvas.prototype.convertToBlob) {
            console.log(`RAH BG: OffscreenCanvas detected. Attempting generation...`);
            // Create an OffscreenCanvas
            const canvas = new OffscreenCanvas(size, size);
            const context = canvas.getContext('2d');
            if (!context) {
                throw new Error('Failed to get 2D context from OffscreenCanvas');
            }

            // Generate QR code using the global QrCreator that was imported
            console.log(`RAH BG: Calling QrCreator.render on OffscreenCanvas...`);
            QrCreator.render({
                text: text,
                size: size,
                ecLevel: 'H', // High error correction
                fill: '#000000', // Black foreground
                background: null, // Transparent background
                radius: 0.1, // Slight rounding for aesthetics
                quiet: 1 // Minimal quiet zone for smaller size
            }, canvas);
            console.log("RAH BG: QR code rendered to OffscreenCanvas.");

            // Convert canvas to blob, then to data URL
            console.log("RAH BG: Converting OffscreenCanvas to blob...");
            const blob = await canvas.convertToBlob();
            if (!blob) {
                throw new Error('canvas.convertToBlob() returned null or undefined');
            }
            console.log("RAH BG: Converting blob to data URL...");
            const dataUrl = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = (err) => reject(err || new Error('FileReader error'));
                reader.readAsDataURL(blob);
            });
            console.log("RAH BG: OffscreenCanvas generation successful.");
            return dataUrl;
        }
        // Firefox compatibility fallback
        else {
            console.log("RAH BG: OffscreenCanvas not supported or complete. Using Firefox fallback (createQRDirectly).");
            return createQRDirectly(text, size);
        }
    } catch (error) {
        console.error('RAH BG: Error during QR code generation attempt:', error);
        // Consider falling back even if OffscreenCanvas seemed available but failed
        console.log("RAH BG: Falling back to createQRDirectly due to error.");
        try {
            return createQRDirectly(text, size);
        } catch (fallbackError) {
            console.error('RAH BG: Error during createQRDirectly fallback as well:', fallbackError);
            throw fallbackError; // Re-throw fallback error if it also fails
        }
    }
}

// Firefox compatibility fallback: create QR code through direct encoding
function createQRDirectly(text, size) {
    console.log("RAH BG: createQRDirectly: Using content script fallback method.");
    return new Promise((resolve, reject) => {
        try {
            const message = {
                action: "createQrInContent",
                text: text,
                size: size
            };
            console.log("RAH BG: createQRDirectly: Querying for active tab...");
            // Find the current active tab and send the message
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                if (tabs && tabs[0] && tabs[0].id) {
                    const targetTabId = tabs[0].id;
                    console.log(`RAH BG: createQRDirectly: Found active tab ${targetTabId}. Sending message...`);
                    chrome.tabs.sendMessage(targetTabId, message, response => {
                        if (chrome.runtime.lastError) {
                            console.error(`RAH BG: createQRDirectly: Error sending message to tab ${targetTabId}:`, chrome.runtime.lastError);
                            reject(new Error('Error communicating with content script: ' + chrome.runtime.lastError.message));
                            return;
                        }

                        if (response && response.success && response.dataUrl) {
                            console.log("RAH BG: createQRDirectly: Received successful response from content script.");
                            resolve(response.dataUrl);
                        } else {
                            console.error("RAH BG: createQRDirectly: Failed response from content script:", response);
                            reject(new Error('Failed to create QR code in content script: ' + (response?.error || 'Invalid response')));
                        }
                    });
                } else {
                    console.error('RAH BG: createQRDirectly: No active tab found.');
                    reject(new Error('No active tab found to create QR code'));
                }
            });
        } catch (error) {
            console.error("RAH BG: createQRDirectly: Error setting up message:", error);
            reject(error);
        }
    });
}

// --- Script Injection Logic ---

// Keep track of tabs recently injected to prevent double injection from different events
const recentlyInjectedTabs = new Set();

// Function to inject scripts into a tab
function injectScripts(tabId, source) {
    // Prevent injecting multiple times rapidly for the same tab
    if (recentlyInjectedTabs.has(tabId)) {
        console.log(`RAH BG: Injection recently occurred for tab ${tabId} from ${source}, skipping.`);
        return;
    }

    console.log(`RAH BG: Attempting script injection into tab ${tabId} from ${source}`);
    recentlyInjectedTabs.add(tabId);

    // Remove the tab from the set after a short delay to allow for subsequent distinct navigations
    setTimeout(() => {
        recentlyInjectedTabs.delete(tabId);
    }, 1000); // Allow re-injection after 1 second

    // Inject dependencies first, then the main script
    chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ["qr-creator.js", "content.js"],
    }, (injectionResults) => {
        if (chrome.runtime.lastError) {
            console.error(`RAH BG: Error injecting scripts into tab ${tabId} from ${source}: ${chrome.runtime.lastError.message}`);
            // If error occurs, remove immediately so retry might work
            recentlyInjectedTabs.delete(tabId);
        } else {
            console.log(`RAH BG: Scripts injected successfully into tab ${tabId} from ${source}.`);
        }
    });
}

// Listener for initial page loads
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Check if the tab is completely loaded and has a URL
    if (changeInfo.status === 'complete' && tab.url) {
        let injectionSource = null;
        // Check for Reddit pages
        if (tab.url.includes('/prefs/apps')) {
            console.log(`RAH BG: onUpdated detected Reddit page: ${tab.url}`);
            injectionSource = 'onUpdated-Reddit';
        }
        // Check for Giphy initial load
        else if (tab.url.startsWith('https://developers.giphy.com/dashboard')) {
            console.log(`RAH BG: onUpdated detected Giphy page: ${tab.url}`);
            injectionSource = 'onUpdated-Giphy';
        }

        // If a relevant page finished loading, inject scripts
        if (injectionSource) {
            // Inject after a short delay to ensure page is stable
            // The injectScripts function handles debouncing
            setTimeout(() => injectScripts(tabId, injectionSource), 250);
        }
    }
});

// Use onHistoryStateUpdated for Giphy SPA navigation detection
chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
     // Filter for main frame, Giphy URL, and specific transition types
    const isGiphyDashboard = details.url && details.url.startsWith('https://developers.giphy.com/dashboard');
    const isMainFrame = details.frameId === 0;
    // Relevant transition types that indicate user navigation
    const isRelevantTransition = ['link', 'typed', 'auto_bookmark', 'generated'].includes(details.transitionType);

    if (isMainFrame && isGiphyDashboard && isRelevantTransition) {
        console.log(`RAH BG: Relevant history update for Giphy detected (Tab: ${details.tabId}, Type: ${details.transitionType}). Scheduling injection.`);
        // Inject after a delay. The injectScripts function handles debouncing.
        setTimeout(() => injectScripts(details.tabId, `onHistoryStateUpdated-${details.transitionType}`), 250);
    } else if (isMainFrame && isGiphyDashboard) {
        console.log(`RAH BG: Giphy history update detected but skipped (Tab: ${details.tabId}, Type: ${details.transitionType})`);
    }
}, {
    // Filter for the specific Giphy URL pattern
    url: [{ hostEquals: 'developers.giphy.com', pathPrefix: '/dashboard' }]
});