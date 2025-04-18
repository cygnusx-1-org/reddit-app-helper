// background.js
// Service worker for the Reddit App Helper extension

// Import the QR code library directly in the service worker
try {
    importScripts('qr-creator.js');
    console.log('QR Creator library imported successfully');
} catch (error) {
    console.error('Failed to import QR Creator library:', error);
}

// Function to generate a QR code using the imported QrCreator library
async function generateQRCode(text, size = 64) {
    // Ensure QrCreator is loaded
    if (typeof QrCreator === 'undefined') {
        console.error('QrCreator library not loaded!');
        throw new Error('QrCreator library failed to load.');
    }

    try {
        // Create an OffscreenCanvas
        const canvas = new OffscreenCanvas(size, size);
        console.log(`Generating QR for text: "${text}" with size ${size}`);

        // Generate QR code using the global QrCreator that was imported
        QrCreator.render({
            text: text,
            size: size,
            ecLevel: 'H', // High error correction
            fill: '#000000', // Black foreground
            background: null, // Transparent background
            radius: 0.1, // Slight rounding for aesthetics
            quiet: 1 // Minimal quiet zone for smaller size
        }, canvas);
        console.log("QR code rendered to OffscreenCanvas");

        // Convert canvas to blob, then to data URL
        const blob = await canvas.convertToBlob();
        console.log("Canvas converted to blob");
        const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
        console.log("Blob converted to data URL");
        return dataUrl;

    } catch (error) {
        console.error('Error during QR code generation or conversion:', error);
        // Re-throw the error to be caught by the caller
        throw error;
    }
}

// Listen for when a tab is updated
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Check if the tab is fully loaded and the URL matches
    if (changeInfo.status === 'complete' && tab.url && tab.url.includes('reddit.com/prefs/apps')) {
        console.log('Target page loaded:', tab.url);

        // Inject content script
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content.js']
        })
        .then(() => {
            console.log('Injected content script');
        })
        .catch(err => console.error('Failed to inject content script:', err));
    }
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Background script received message:", request);

    if (request.action === "generateQrCode") {
        const { text, index } = request;

        generateQRCode(text, 128) // Request size 128x128
            .then(imageData => {
                // Send successful image data (data URL) to content script
                console.log(`Successfully generated QR for index ${index}, sending to content script.`);
                chrome.tabs.sendMessage(sender.tab.id, {
                    action: "qrCodeGenerated",
                    index: index,
                    imageData: imageData // Send the data URL directly
                });
            })
            .catch(error => {
                // Log the full error object for better debugging in the service worker console
                console.error(`Background Script - Error generating QR code for index ${index}:`, error);
                // Attempt to stringify the error to see properties like stack
                try {
                    console.error("Background Script - Full error details:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
                } catch (e) {
                    console.error("Background Script - Could not stringify error object:", e);
                }

                // Send a more detailed error message (including stack if available) to content script
                const errorString = `BG Error: ${error.name || 'Unknown Error'}: ${error.message || 'No message'} \nStack: ${error.stack || 'Stack trace not available'}`;
                console.log("Background Script - Sending error to content script:", errorString);
                chrome.tabs.sendMessage(sender.tab.id, {
                    action: "qrCodeGenerated",
                    index: index,
                    imageData: null,
                    error: errorString
                });
            });
    }

    // Return true to indicate we'll send a response asynchronously
    return true;
});