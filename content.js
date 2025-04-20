(function() { // IIFE Start
'use strict';

// Track which elements we've already processed to avoid duplicates
const processedElements = new Set();
let giphyObserver = null; // Keep observer reference global within IIFE
let isProcessingMutation = false; // Keep reentry flag global within IIFE
let isInitializing = false; // Guard against rapid re-entry

// FIREFOX DEBUG - log that content script is loaded
console.log('Reddit App Helper content script executed', {
    browser: navigator.userAgent,
    url: window.location.href,
    timestamp: new Date().toISOString()
});

// --- Core Processing Logic --- (No longer needs to be globally accessible)
function initializeAndProcess() {
    // Prevent concurrent execution
    if (isInitializing) {
        console.log("RAH: Already initializing, exiting.");
        return;
    }
    isInitializing = true;
    console.log('RAH: initializeAndProcess starting...');

    // Reset state - important if re-injected or navigating
    processedElements.clear();
    sessionStorage.removeItem('rah_giphyIndex');
    isProcessingMutation = false;

    // Stop any previous observer explicitly
    if (giphyObserver) {
        console.log("RAH: Disconnecting existing Giphy observer before initializing.");
        try {
            giphyObserver.disconnect();
        } catch (e) {
            console.warn("RAH: Error disconnecting observer (already disconnected?):", e);
        }
        giphyObserver = null;
    }

    const currentUrl = window.location.href;
    console.log('RAH: Initializing for URL:', currentUrl);

    // Process Reddit immediately if on the right page
    if (currentUrl.includes('/prefs/apps')) {
        try {
            console.log('RAH: Running initial processPage for Reddit.');
            processPage();
        } catch (error) {
            console.error("RAH: Error during initial processPage for Reddit:", error);
        }
    }
    // If on Giphy page, start the observer immediately
    else if (currentUrl.startsWith('https://developers.giphy.com/dashboard')) {
        console.log("RAH: On Giphy page, ensuring observer is started.");
        observeGiphyContent();
    } else {
        console.log("RAH: Not on Reddit or Giphy page, no initial action.");
    }

    console.log("RAH: initializeAndProcess finished setup.");
    // Release the guard
    isInitializing = false;
}

// Function to process page content (finds IDs, adds buttons)
function processPage() {
    // This function now primarily handles Reddit processing
    const currentUrl = window.location.href;
    if (currentUrl.includes('/prefs/apps')) {
        console.log('RAH: processPage processing Reddit.');
        let processedAnyOnThisRun = false;
        const clientIdElements = document.querySelectorAll('li.developed-app div.app-details > h3:nth-of-type(2)');
        clientIdElements.forEach((element) => {
            // Check if button already exists OR element processed
            const nextElement = element.nextElementSibling;
            if (processedElements.has(element) || (nextElement && nextElement.classList.contains('rah-show-qr-button'))) {
                return;
            }
            const clientId = element.textContent.trim();
            if (clientId && clientId.length > 10 && /^[a-zA-Z0-9_-]+$/.test(clientId)) {
                const showQrButton = createShowQrButton(clientId, 'reddit-' + clientId, `Show QR code for Reddit key: ${clientId}`);
                if (element.parentNode) {
                    element.parentNode.insertBefore(showQrButton, element.nextSibling);
                    processedElements.add(element);
                    processedAnyOnThisRun = true;
                }
            }
        });
        // Alternative Reddit logic
        if (!processedAnyOnThisRun) {
            document.querySelectorAll('h3').forEach((element) => {
                 // Check if button already exists OR element processed
                const nextElement = element.nextElementSibling;
                if (processedElements.has(element) || (nextElement && nextElement.classList.contains('rah-show-qr-button'))) {
                    return;
                }
                const text = element.textContent.trim();
                if (text && text.length >= 20 && /^[a-zA-Z0-9_-]+$/.test(text)) {
                    const showQrButton = createShowQrButton(text, 'reddit-alt-' + text, `Show QR code for Reddit key: ${text}`);
                    element.parentNode.insertBefore(showQrButton, element.nextSibling);
                    processedElements.add(element);
                    processedAnyOnThisRun = true;
                }
            });
        }
        return processedAnyOnThisRun;
    }
    // Giphy processing is handled by processGiphyDashboard, called by initializer/observer
    return false;
}

// Specific function to process Giphy cards
function processGiphyDashboard() {
    console.log(`RAH: processGiphyDashboard executing...`);
    const appCards = document.querySelectorAll('div.dp-app-card');
    console.log(`RAH: processGiphyDashboard - Found ${appCards.length} Giphy app cards.`);

    if (appCards.length === 0) {
        console.log('RAH: processGiphyDashboard - No cards found.');
        return false;
    }

    let processedNew = false;
    let giphyIndex = parseInt(sessionStorage.getItem('rah_giphyIndex') || '0');

    appCards.forEach((card, cardIndex) => {
        const inputElement = card.querySelector('input[type="text"][value]');
        const editLink = card.querySelector('a[href*="/apps/"][href*="/edit/"]');

        // Check if button already exists OR input already processed
        const prevElement = editLink ? editLink.previousElementSibling : null;
        if (!inputElement || !editLink || processedElements.has(inputElement) || (prevElement && prevElement.classList.contains('rah-show-qr-button'))) {
            // console.log(`RAH Giphy: Skipping card ${cardIndex + 1} - already processed or button exists.`);
            return;
        }

        if (inputElement && editLink) { // Redundant check but safe
            const apiKey = inputElement.value.trim();
            const isValidGiphyKey = apiKey && apiKey.length === 32 && /^[a-zA-Z0-9]+$/.test(apiKey);

            if (isValidGiphyKey) {
                console.log(`RAH: Card ${cardIndex + 1} - Valid Giphy API key found: ${apiKey}`);
                const currentGiphyIndex = giphyIndex++;
                sessionStorage.setItem('rah_giphyIndex', giphyIndex.toString());
                const showQrButton = createShowQrButton(apiKey, 'giphy-' + currentGiphyIndex, `Show QR code for Giphy key: ${apiKey}`);

                if (editLink.parentNode) {
                    console.log(`RAH: Card ${cardIndex + 1} - Inserting [Show QR] button for key ${apiKey}`);
                    showQrButton.style.marginRight = '10px';
                    editLink.parentNode.insertBefore(showQrButton, editLink);
                    processedElements.add(inputElement); // Still track processed elements
                    processedNew = true;
                } else {
                    console.warn(`RAH: Card ${cardIndex + 1} - Could not find parent node for Giphy Edit link.`);
                }
            }
        }
    });

    console.log(`RAH: processGiphyDashboard finished. Processed new items: ${processedNew}`);
    return processedNew;
}

// Observer for Giphy Content
function observeGiphyContent() {
    if (giphyObserver) {
        return;
    }

    const targetNode = document.body;

    if (!targetNode) {
        console.error('RAH: Cannot set up observer, document.body not found.');
        return;
    }

    console.log('RAH: Setting up MutationObserver for Giphy content on target:', targetNode);
    const config = { childList: true, subtree: true };

    const callback = function(mutationsList, observer) {
        if (isProcessingMutation) return;

        // Check if the URL is still Giphy dashboard
        if (!window.location.href.startsWith('https://developers.giphy.com/dashboard')) {
            if (giphyObserver) {
                console.log("RAH: Observer triggered, but not on Giphy URL. Disconnecting.");
                observer.disconnect();
                giphyObserver = null;
            }

            return;
        }

        let potentiallyRelevantChange = false;

        for(const mutation of mutationsList) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                // Check added nodes more thoroughly
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check if the added node itself is a card OR contains cards
                        if ((node.matches && node.matches('div.dp-app-card')) || node.querySelector('div.dp-app-card')) {
                            potentiallyRelevantChange = true;
                            break; // Found relevant change in this mutation
                        }
                    }
                }
            }

            if (potentiallyRelevantChange) break; // Found relevant change in mutationsList
        }

        if (potentiallyRelevantChange) {
            console.log('RAH: MutationObserver detected relevant Giphy changes. Setting flag and running processor...');
            isProcessingMutation = true; // Set flag

            // Use setTimeout to allow the current mutation batch to finish before processing
            setTimeout(() => {
                console.log('RAH: Running processGiphyDashboard from observer timeout.');
                processGiphyDashboard();
                console.log('RAH: Finished processing, resetting mutation flag.');
                isProcessingMutation = false; // Reset flag after processing
            }, 50); // Short delay
        } else {
            // console.log('RAH: Mutation detected, but deemed not relevant.');
        }
    };

    giphyObserver = new MutationObserver(callback);
    giphyObserver.observe(targetNode, config);
    console.log('RAH: MutationObserver started for Giphy content.');

    // No automatic timeout/disconnect here - let it run as long as we are on the Giphy page
}

// Helper function to create the Show QR button
function createShowQrButton(clientId, index, title) {
    const showQrButton = document.createElement('button');
    showQrButton.textContent = '[Show QR]';
    showQrButton.style.marginLeft = '10px';
    showQrButton.style.verticalAlign = 'middle';
    showQrButton.style.fontSize = '10px';
    showQrButton.style.padding = '2px 5px';
    showQrButton.style.cursor = 'pointer';
    showQrButton.classList.add('rah-show-qr-button'); // Add a class for potential styling/selection
    showQrButton.dataset.clientId = clientId;
    showQrButton.dataset.index = index;
    showQrButton.title = title;
    showQrButton.addEventListener('click', handleShowQrClick);

    return showQrButton;
}

// Handler for clicking the "[Show QR]" button
function handleShowQrClick(event) {
    const button = event.target;
    const clientId = button.dataset.clientId;
    const index = button.dataset.index;

    console.log(`RAH Content: Button clicked for index ${index}, client ID: ${clientId}`);

    button.textContent = 'Loading...';
    button.disabled = true;

    // --- Attempt direct QR generation in Content Script ---
    console.log(`RAH Content: Attempting direct QR generation for index ${index}`);
    try {
        if (typeof QrCreator === 'undefined') {
            throw new Error('QrCreator library not found in content script context.');
        }

        const size = 128;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;

        QrCreator.render({
            text: clientId,
            size: size,
            ecLevel: 'H',
            fill: '#000000',
            background: null,
            radius: 0.1,
            quiet: 1
        }, canvas);

        const imageData = canvas.toDataURL('image/png');
        console.log(`RAH Content: Direct QR generation successful for index ${index}.`);
        updateQrCodeContainer(index, imageData, null); // Update UI directly

    } catch (error) {
        console.error(`RAH Content: Error during direct QR generation for index ${index}:`, error);
        const errorString = `Content Script Error: ${error.name || 'Unknown Error'}: ${error.message || 'No message'}`;
        updateQrCodeContainer(index, null, errorString); // Show error in UI
    }
}

// Handler for clicking the QR code image to hide it
function handleHideQrClick(event) {
    const qrCodeContainer = event.target.closest('span.rah-qr-container'); // Find the container span

    if (!qrCodeContainer) {
        console.error('Could not find QR code container for hiding.');
        return;
    }

    const clientId = qrCodeContainer.dataset.clientId;
    const index = qrCodeContainer.dataset.index;
    const title = qrCodeContainer.dataset.originalTitle; // Retrieve original title

    console.log(`Hiding QR for index ${index}, client ID: ${clientId}`);

    // Recreate the button
    const showQrButton = createShowQrButton(clientId, index, title);
    // Ensure spacing is reapplied if needed (e.g., for Giphy)

    if (index.startsWith('giphy-')) {
        showQrButton.style.marginRight = '10px';
    }

    // Replace the QR code container with the button
    qrCodeContainer.parentNode.replaceChild(showQrButton, qrCodeContainer);
}

// Function to update the button with the QR code image or error
function updateQrCodeContainer(index, imageData, error) {
    // Find the specific button that was clicked using the index
    const button = document.querySelector(`button[data-index="${index}"]`);

    if (!button) {
        console.error(`Could not find button with index ${index} to update.`);
        return;
    }

    // Create a container span for the QR code or error message
    const qrCodeContainer = document.createElement('span');
    qrCodeContainer.classList.add('rah-qr-container'); // Add class for easier selection
    qrCodeContainer.style.display = 'inline-block'; // Use inline-block for proper spacing
    qrCodeContainer.style.marginLeft = button.style.marginLeft; // Copy margins
    qrCodeContainer.style.marginRight = button.style.marginRight;
    qrCodeContainer.style.verticalAlign = 'middle';
    qrCodeContainer.dataset.clientId = button.dataset.clientId; // Copy data for hiding
    qrCodeContainer.dataset.index = index;
    qrCodeContainer.dataset.originalTitle = button.title; // Store original title for recreation

    if (imageData) {
        // Create an image from the data URL
        const img = new Image();
        img.width = 128; // Doubled size
        img.height = 128; // Doubled size
        img.src = imageData;
        img.title = `Click to hide QR code for ${button.dataset.clientId}`;
        img.style.cursor = 'pointer';
        img.addEventListener('click', handleHideQrClick); // Add listener to hide
        qrCodeContainer.appendChild(img);
    } else {
        // Display error indicator
        qrCodeContainer.textContent = '[QR ERR]';
        qrCodeContainer.style.color = 'red';
        qrCodeContainer.style.fontSize = '10px';
        qrCodeContainer.title = `Error: ${error}`; // Show error on hover
        console.error(`Error generating QR code for index ${index}:`, error);
    }

    // Replace the button with the QR code container (containing image or error)
    if (button.parentNode) {
        button.parentNode.replaceChild(qrCodeContainer, button);
    } else {
        console.error(`Could not find parent node for button with index ${index}.`);
    }
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log("RAH Content: Received message:", request);

    // Keep Firefox fallback handling (if needed in future, currently bypassed)
    if (request.action === "createQrInContent") {
        console.log("RAH Content: Received request to create QR in content (Firefox fallback):", request);
        const { text, size } = request;
        createQrCodeInContent(text, size)
            .then(result => {
                console.log("RAH Content: Sending async response (success):", result);
                sendResponse(result);
            })
            .catch(error => {
                console.error("RAH Content: Error creating QR in content, sending error response:", error);
                sendResponse({ success: false, error: error.message || 'Unknown error' });
            });
        return true; // Indicate async response
    } else {
        console.warn("RAH Content: Received unhandled message action:", request.action);
    }
});

// --- Script Execution Entry Point ---
// This script is now injected programmatically by the background script
// after the page load is complete or history state has updated.
// We can directly call the initialization function.
console.log("RAH: Content script injected/executed. Running initializeAndProcess...");
initializeAndProcess();

})(); // IIFE End