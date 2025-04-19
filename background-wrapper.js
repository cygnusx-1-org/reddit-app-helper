// Background wrapper script that works in both Chrome and Firefox
// This detects the browser and loads the appropriate background script

// Check if we're running in Firefox (importScripts is synchronous in Firefox)
const isFirefox = typeof browser !== 'undefined';

console.log("Starting background-wrapper.js, detected browser:", isFirefox ? "Firefox" : "Chrome");

// Load the QR creator library, which is required by our background script
try {
    importScripts('qr-creator.js');
    console.log('QR Creator library imported successfully');
} catch (error) {
    console.error('Failed to import QR Creator library:', error);
}

// Now load our actual background script
try {
    importScripts('background.js');
    console.log('Background script imported successfully');
} catch (error) {
    console.error('Failed to import background script:', error);
}