
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {

    if (changeInfo.status === "complete" && tab.url.includes("facebook.com")) {
        return; 
    }
});
