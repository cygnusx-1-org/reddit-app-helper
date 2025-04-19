(function() { // IIFE Start
'use strict';

// Track which elements we've already processed to avoid duplicates
const processedElements = new Set();

// FIREFOX DEBUG - log that content script is loaded
console.log('Reddit App Helper content script loaded', {
    browser: navigator.userAgent,
    url: window.location.href
});

// Function to handle QR code generation
function processPage() {
    console.log('Processing page for Reddit client IDs');
    console.log('Current URL:', window.location.href);
    console.log('URL matches?', window.location.href.includes('/prefs/apps'));

    // Debug DOM - check what elements we're finding
    const allH3Elements = document.querySelectorAll('h3');
    console.log('All H3 elements found:', allH3Elements.length, Array.from(allH3Elements).map(el => el.textContent));

    const allAppElements = document.querySelectorAll('li.developed-app');
    console.log('App elements found:', allAppElements.length);

    // Find all H3 elements containing client IDs within the developed apps list
    // Selector targets the second h3 inside div.app-details within li.developed-app
    const clientIdElements = document.querySelectorAll('li.developed-app div.app-details > h3:nth-of-type(2)');
    console.log(`Found ${clientIdElements.length} potential client ID elements.`);

    let foundClientIds = false;

    clientIdElements.forEach((element, index) => {
        const clientId = element.textContent.trim();
        console.log(`Processing element ${index}: Text content = "${clientId}"`);

        // Skip if we've already processed this element
        if (processedElements.has(element)) {
            console.log(`Element ${index} already processed, skipping`);
            return;
        }

        // Basic check to see if the text content looks like a client ID
        if (clientId && clientId.length > 10 && /^[a-zA-Z0-9_-]+$/.test(clientId)) {
            console.log(`Element ${index}: Found valid client ID: ${clientId}`);
            foundClientIds = true;

            // Create a button to trigger QR code display
            const showQrButton = document.createElement('button');
            showQrButton.textContent = '[Show QR]';
            showQrButton.style.marginLeft = '10px';
            showQrButton.style.verticalAlign = 'middle';
            showQrButton.style.fontSize = '10px';
            showQrButton.style.padding = '2px 5px';
            showQrButton.dataset.clientId = clientId; // Store client ID
            showQrButton.dataset.index = index;     // Store index
            showQrButton.title = `Show QR code for ${clientId}`;

            // Add click listener to the button
            showQrButton.addEventListener('click', handleShowQrClick);

            // Insert the button immediately after the H3 element
            if (element.parentNode) {
                console.log(`Element ${index}: Inserting [Show QR] button after H3.`);
                element.parentNode.insertBefore(showQrButton, element.nextSibling);

                // Mark as processed
                processedElements.add(element);
            } else {
                console.warn(`Element ${index}: Could not find parent node for H3:`, element);
            }
        } else {
            console.log(`Element ${index}: Text content "${clientId}" doesn't look like a client ID, skipping.`);
        }
    });

    // Only try alternative approach if we didn't find anything with the main selector
    if (!foundClientIds) {
        console.log('No client IDs found with primary selector, trying alternative...');

        // Try a more generic selector - any h3 that might contain a client ID
        document.querySelectorAll('h3').forEach((element, index) => {
            // Skip if we've already processed this element
            if (processedElements.has(element)) {
                return;
            }

            const text = element.textContent.trim();

            // Check if it looks like a client ID (alphanumeric, 20+ characters)
            if (text && text.length >= 20 && /^[a-zA-Z0-9_-]+$/.test(text)) {
                console.log(`Found potential client ID in h3: ${text}`);

                // Create and append button
                const showQrButton = document.createElement('button');
                showQrButton.textContent = '[Show QR]';
                showQrButton.style.marginLeft = '10px';
                showQrButton.style.verticalAlign = 'middle';
                showQrButton.style.fontSize = '10px';
                showQrButton.style.padding = '2px 5px';
                showQrButton.dataset.clientId = text;
                showQrButton.dataset.index = 'alt-' + index;
                showQrButton.title = `Show QR code for ${text}`;
                showQrButton.addEventListener('click', handleShowQrClick);

                element.parentNode.insertBefore(showQrButton, element.nextSibling);

                // Mark as processed
                processedElements.add(element);
            }
        });
    }
}

// Handler for clicking the "[Show QR]" button
function handleShowQrClick(event) {
    const button = event.target;
    const clientId = button.dataset.clientId;
    const index = button.dataset.index;

    console.log(`Button clicked for index ${index}, client ID: ${clientId}`);

    // Update button state to loading
    button.textContent = 'Loading...';
    button.disabled = true;

    // Request QR code generation
    chrome.runtime.sendMessage({
        action: "generateQrCode",
        text: clientId,
        index: index
    });
}

// Handler for clicking the QR code image to hide it
function handleHideQrClick(event) {
    const qrCodeContainer = event.target.parentNode; // Get the span container
    const clientId = qrCodeContainer.dataset.clientId;
    const index = qrCodeContainer.dataset.index;

    console.log(`Hiding QR for index ${index}, client ID: ${clientId}`);

    // Create a new "[Show QR]" button
    const showQrButton = document.createElement('button');
    showQrButton.textContent = '[Show QR]';
    showQrButton.style.marginLeft = '10px';
    showQrButton.style.verticalAlign = 'middle';
    showQrButton.style.fontSize = '10px';
    showQrButton.style.padding = '2px 5px';
    showQrButton.dataset.clientId = clientId;
    showQrButton.dataset.index = index;
    showQrButton.title = `Show QR code for ${clientId}`;
    showQrButton.addEventListener('click', handleShowQrClick);

    // Replace the QR code container with the button
    qrCodeContainer.parentNode.replaceChild(showQrButton, qrCodeContainer);
}

// Firefox compatibility: Generate QR code in content script
function createQrCodeInContent(text, size) {
    console.log(`Creating QR code in content script for: ${text}`);
    try {
        // Create a canvas element
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;

        // Use QrCreator from page context if it's available
        if (typeof QrCreator !== 'undefined') {
            // Generate QR code directly
            QrCreator.render({
                text: text,
                size: size,
                ecLevel: 'H', // High error correction
                fill: '#000000', // Black foreground
                background: null, // Transparent background
                radius: 0.1, // Slight rounding for aesthetics
                quiet: 1 // Minimal quiet zone for smaller size
            }, canvas);

            // Return the data URL
            return {
                success: true,
                dataUrl: canvas.toDataURL('image/png')
            };
        }
        // If QrCreator is not available in content script, we need to inject it
        else {
            console.log('QrCreator not available in content script, injecting inline script');
            // Create a temporary container to hold the canvas
            const container = document.createElement('div');
            container.style.position = 'absolute';
            container.style.left = '-9999px';
            container.style.top = '-9999px';
            container.appendChild(canvas);
            document.body.appendChild(container);

            // Create a script element to inject the QR creator
            const script = document.createElement('script');
            script.textContent = `
                // This script runs in page context
                (function() {
                    // Check if we have access to QrCreator
                    if (typeof QrCreator !== 'undefined') {
                        const canvas = document.querySelector('div[style*="-9999px"] canvas');
                        if (canvas) {
                            QrCreator.render({
                                text: "${text.replace(/"/g, '\\"')}", // Escape quotes
                                size: ${size},
                                ecLevel: 'H',
                                fill: '#000000',
                                background: null,
                                radius: 0.1,
                                quiet: 1
                            }, canvas);

                            // Send message back to content script
                            window.postMessage({
                                action: "qrCodeCreated",
                                dataUrl: canvas.toDataURL('image/png')
                            }, "*");
                        }
                    } else {
                        window.postMessage({
                            action: "qrCodeError",
                            error: "QrCreator not available in page context"
                        }, "*");
                    }
                })();
            `;

            // Add the script to the page
            document.head.appendChild(script);

            // Wait for response via window.postMessage (handled outside this function)
            return { success: false, pendingMessage: true };
        }
    } catch (error) {
        console.error('Error creating QR code in content script:', error);
        return {
            success: false,
            error: error.message || 'Unknown error creating QR code'
        };
    }
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
    qrCodeContainer.style.display = 'inline-block';
    qrCodeContainer.style.marginLeft = '10px';
    qrCodeContainer.style.verticalAlign = 'middle';
    qrCodeContainer.dataset.clientId = button.dataset.clientId; // Copy data for hiding
    qrCodeContainer.dataset.index = index;

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
    console.log("Content script received message:", request);

    if (request.action === "qrCodeGenerated") {
        const { index, imageData, error } = request;
        updateQrCodeContainer(index, imageData, error);
    }
    // Firefox compatibility: Handle request to create QR in content script
    else if (request.action === "createQrInContent") {
        console.log("Received request to create QR in content script:", request);
        const { text, size } = request;
        const result = createQrCodeInContent(text, size);

        // If we have a direct result, send it back immediately
        if (result.success || (result.error && !result.pendingMessage)) {
            console.log("Sending immediate response:", result);
            sendResponse(result);
        }
        // Otherwise, we're waiting for a postMessage response
        else if (result.pendingMessage) {
            console.log("Waiting for postMessage response...");
            // We'll respond via the message listener below
            // Just keep the sendResponse reference
            window.qrPendingResponse = sendResponse;
            // Return true to indicate we'll respond asynchronously
            return true;
        }
    }
});

// Listen for messages from page scripts as well
window.addEventListener('message', function(event) {
    // Only accept messages from the same frame
    if (event.source !== window) return;

    console.log("Content script received window message:", event.data);
    const data = event.data;

    // Check for our QR code message from the injected script
    if (data && data.action === "qrCodeCreated" && data.dataUrl) {
        console.log("Received QR code data URL from page script");
        // If we have a pending response callback, use it
        if (window.qrPendingResponse) {
            console.log("Sending response with data URL");
            window.qrPendingResponse({
                success: true,
                dataUrl: data.dataUrl
            });
            delete window.qrPendingResponse;
        }
    }
    // Handle QR code error from page script
    else if (data && data.action === "qrCodeError") {
        console.error("Error creating QR code in page script:", data.error);
        if (window.qrPendingResponse) {
            window.qrPendingResponse({
                success: false,
                error: data.error
            });
            delete window.qrPendingResponse;
        }
    }
    // Check if this is a message from our QR generator
    else if (data && data.action === "qrCodeGenerated") {
        console.log("Content script received window message:", data);
        updateQrCodeContainer(data.index, data.imageData, data.error);
    }
}, false);

// Load our app, but don't load it twice
let hasProcessedPage = false;

// Wait for the page to be fully loaded
if (document.readyState === 'complete' && !hasProcessedPage) {
    console.log("Document already complete, processing page immediately");
    processPage();
    hasProcessedPage = true;
} else {
    console.log("Document not yet complete, adding load listener");
    window.addEventListener('load', function() {
        if (!hasProcessedPage) {
            processPage();
            hasProcessedPage = true;
        }
    });
}

})(); // IIFE End