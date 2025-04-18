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
            } else {
                console.warn(`Element ${index}: Could not find parent node for H3:`, element);
            }
        } else {
            console.log(`Element ${index}: Text content "${clientId}" doesn't look like a client ID, skipping.`);
        }
    });
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