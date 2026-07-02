chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'DOWNLOAD') return;

  chrome.downloads.download(
    {
      url: message.url,
      filename: message.filename,
      saveAs: false,
    },
    (downloadId) => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      sendResponse({ ok: true, downloadId });
    }
  );

  return true;
});