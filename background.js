// background.js
// Service worker for the Reddit App Helper extension

// Note: We now import scripts via background-wrapper.js

console.log("Background script loaded");

// Function to generate a QR code using the imported QrCreator library
async function generateQRCode(text, size = 64) {
    // Check if QrCreator is available
    if (typeof QrCreator === 'undefined') {
        console.error('QrCreator library not loaded - falling back to content script method');
        // Always use the content script fallback in Firefox
        return createQRDirectly(text, size);
    }

    try {
        console.log(`Generating QR for text: "${text}" with size ${size}`);

        // Check if OffscreenCanvas is supported (Chrome)
        if (typeof OffscreenCanvas !== 'undefined') {
            // Create an OffscreenCanvas
            const canvas = new OffscreenCanvas(size, size);

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
        }
        // Firefox compatibility fallback - use messaging to create the QR in content script
        else {
            console.log("OffscreenCanvas not supported, using content script fallback");
            // Create a base64 encoded QR code directly
            return createQRDirectly(text, size);
        }
    } catch (error) {
        console.error('Error during QR code generation or conversion:', error);
        // Use fallback method
        return createQRDirectly(text, size);
    }
}

// Firefox compatibility fallback: create QR code through direct encoding
function createQRDirectly(text, size) {
    console.log("Using content script fallback method for QR code generation");
    return new Promise((resolve, reject) => {
        try {
            // Create a message to send to the currently active tab
            const message = {
                action: "createQrInContent",
                text: text,
                size: size
            };

            // Find the current active tab and send the message
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                if (tabs && tabs[0] && tabs[0].id) {
                    chrome.tabs.sendMessage(tabs[0].id, message, response => {
                        if (chrome.runtime.lastError) {
                            console.error("Error sending message:", chrome.runtime.lastError);
                            reject(new Error('Error communicating with content script: ' + chrome.runtime.lastError.message));
                            return;
                        }

                        if (response && response.success && response.dataUrl) {
                            console.log("Received QR data URL from content script");
                            resolve(response.dataUrl);
                        } else {
                            reject(new Error('Failed to create QR code in content script: ' + (response?.error || 'No response')));
                        }
                    });
                } else {
                    reject(new Error('No active tab found to create QR code'));
                }
            });
        } catch (error) {
            console.error("Error in createQRDirectly:", error);
            reject(error);
        }
    });
}

// We don't need to inject content script anymore as it's handled by the manifest

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

        // Return true to indicate we'll send a response asynchronously
        return true;
    }
});