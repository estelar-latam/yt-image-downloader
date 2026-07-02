const PAGE_LABELS = {
  channel: 'Canal',
  video: 'Video',
  shorts: 'Short',
  other: 'Otra pagina',
};

const FALLBACK_MESSAGE =
  'Clic en "Reescanear pagina". Si no funciona, actualiza Chrome o reinicia la extension.';

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function render(images, pageType) {
  const status = document.getElementById('status');
  const list = document.getElementById('list');
  const pageLabel = PAGE_LABELS[pageType] || PAGE_LABELS.other;

  if (!images.length) {
    status.textContent = `${pageLabel}: no se encontraron imagenes descargables.`;
    list.innerHTML =
      '<li class="empty">Abre un canal o video de YouTube y vuelve a escanear.</li>';
    return;
  }

  status.textContent = `${pageLabel}: ${images.length} imagen(es) detectada(s).`;
  list.innerHTML = images.map((image) => `<li>${image.label}</li>`).join('');
}

async function isContentScriptReady(tabId) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: 'PING' });
    return Boolean(response?.ready);
  } catch (_error) {
    return false;
  }
}

async function injectContentScript(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js'],
  });
  await new Promise((resolve) => setTimeout(resolve, 150));
}

async function requestScan(tabId) {
  return chrome.tabs.sendMessage(tabId, { type: 'RESCAN' });
}

async function scanActiveTab(tab) {
  if (!(await isContentScriptReady(tab.id))) {
    await injectContentScript(tab.id);
  }

  return requestScan(tab.id);
}

async function refresh() {
  const status = document.getElementById('status');
  const list = document.getElementById('list');
  const rescanButton = document.getElementById('rescan');
  const tab = await getActiveTab();

  if (!tab?.id || !tab.url?.includes('youtube.com')) {
    status.textContent = 'Abre una pestana de YouTube primero.';
    list.innerHTML = '';
    rescanButton.disabled = true;
    return;
  }

  rescanButton.disabled = true;
  status.textContent = 'Escaneando...';
  list.innerHTML = '';

  try {
    const response = await scanActiveTab(tab);
    render(response.images, response.pageType);
  } catch (_error) {
    status.textContent = FALLBACK_MESSAGE;
    list.innerHTML =
      '<li class="empty">Tambien puedes recargar la pagina de YouTube (F5).</li>';
  } finally {
    rescanButton.disabled = false;
  }
}

document.getElementById('rescan').addEventListener('click', refresh);
refresh();