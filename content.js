(function() { // IIFE Start
'use strict';

// Function to handle QR code generation
function processPage() {
    console.log('Processing page for Reddit client IDs');

    // Find all H3 elements containing client IDs within the developed apps list
    // Selector targets the second h3 inside div.app-details within li.developed-app
    const clientIdElements = document.querySelectorAll('li.developed-app div.app-details > h3:nth-of-type(2)');
    console.log(`Found ${clientIdElements.length} potential client ID elements.`);

    clientIdElements.forEach((element, index) => {
        const clientId = element.textContent.trim();
        console.log(`Processing element ${index}: Text content = "${clientId}"`);

        // Basic check to see if the text content looks like a client ID
        if (clientId && clientId.length > 10 && /^[a-zA-Z0-9_-]+$/.test(clientId)) {
            console.log(`Element ${index}: Found valid client ID: ${clientId}`);

            // Create a container for the QR code (using a span for inline behavior)
            const qrCodeContainer = document.createElement('span');
            qrCodeContainer.style.display = 'inline-block';
            qrCodeContainer.style.marginLeft = '10px';
            qrCodeContainer.style.verticalAlign = 'middle';
            qrCodeContainer.style.width = '128px'; // Doubled size
            qrCodeContainer.style.height = '128px'; // Doubled size
            qrCodeContainer.title = clientId;

            // Add loading indicator
            qrCodeContainer.textContent = 'Loading...';
            qrCodeContainer.style.fontSize = '9px';
            qrCodeContainer.style.textAlign = 'center';
            qrCodeContainer.style.lineHeight = '128px'; // Doubled size

            // Insert the QR code container immediately after the H3 element
            if (element.parentNode) {
                console.log(`Element ${index}: Inserting QR code span after H3.`);
                element.parentNode.insertBefore(qrCodeContainer, element.nextSibling);

                // Use chrome.runtime.sendMessage to ask background script to generate QR code
                chrome.runtime.sendMessage({
                    action: "generateQrCode",
                    text: clientId,
                    index: index
                });
            } else {
                console.warn(`Element ${index}: Could not find parent node for H3:`, element);
            }
        } else {
            console.log(`Element ${index}: Text content "${clientId}" doesn't look like a client ID, skipping.`);
        }
    });
}

// Function to update the QR code container with image data
function updateQrCodeContainer(index, imageData, error) {
    // Find the container we created earlier
    const containers = document.querySelectorAll('li.developed-app div.app-details > h3:nth-of-type(2) + span');
    if (containers && containers[index]) {
        const container = containers[index];

        if (imageData) {
            // Create an image from the data URL
            const img = new Image();
            img.width = 128; // Doubled size
            img.height = 128; // Doubled size
            img.src = imageData;
            container.innerHTML = ''; // Clear any previous content
            container.appendChild(img);
        } else {
            // Display error indicator
            container.textContent = '[QR ERR]';
            container.style.color = 'red';
            container.style.fontSize = '10px';
            container.style.width = 'auto';
            container.style.height = 'auto';
            console.error('Error generating QR code:', error);
        }
    }
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log("Content script received message:", request);

    if (request.action === "qrCodeGenerated") {
        const { index, imageData, error } = request;
        updateQrCodeContainer(index, imageData, error);
    }
});

// Listen for messages from page scripts as well
window.addEventListener('message', function(event) {
    // Only accept messages from the same frame
    if (event.source !== window) return;

    const data = event.data;

    // Check if this is a message from our QR generator
    if (data && data.action === "qrCodeGenerated") {
        console.log("Content script received window message:", data);
        updateQrCodeContainer(data.index, data.imageData, data.error);
    }
}, false);

// Wait for the page to be fully loaded
if (document.readyState === 'complete') {
    processPage();
} else {
    window.addEventListener('load', processPage);
}

})(); // IIFE End