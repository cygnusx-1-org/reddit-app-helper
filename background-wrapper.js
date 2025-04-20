// Background wrapper script that works in both Chrome and Firefox
// This detects the browser and loads the appropriate background script

console.log("RAH Wrapper: Starting...");

// Check if we're running in Firefox (importScripts is synchronous in Firefox)
const isFirefox = typeof browser !== 'undefined';
console.log("RAH Wrapper: Detected browser:", isFirefox ? "Firefox" : "Chrome");

// Load the QR creator library, which is required by our background script
try {
    importScripts('qr-creator.js');
    console.log('RAH Wrapper: QR Creator library imported successfully');
} catch (error) {
    console.error('RAH Wrapper: Failed to import QR Creator library:', error);
}

// Now load our actual background script
try {
    importScripts('background.js');
    console.log('RAH Wrapper: Background script imported successfully');
} catch (error) {
    console.error('RAH Wrapper: Failed to import background script:', error);
}

console.log("RAH Wrapper: Imports complete.");
console.log("RAH Wrapper: Finished execution.");