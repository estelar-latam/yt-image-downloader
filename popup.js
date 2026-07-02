const PAGE_LABELS = {
  channel: 'Canal',
  video: 'Video',
  shorts: 'Short',
  other: 'Otra pagina',
};

const FALLBACK_MESSAGE =
  'Clic en "Reescanear pagina". Si no funciona, actualiza Chrome o reinicia la extension.';

let activeTabId = null;

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function defaultFormat(image) {
  return image.previewClass === 'avatar' ? 'png' : 'jpg';
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function bindCardEvents(card, image) {
  const formatButtons = card.querySelectorAll('.format-btn');
  const downloadButton = card.querySelector('.download-btn');
  let selectedFormat = defaultFormat(image);

  formatButtons.forEach((button) => {
    button.addEventListener('click', () => {
      selectedFormat = button.dataset.format;
      formatButtons.forEach((btn) => btn.classList.toggle('active', btn === button));
    });
  });

  downloadButton.addEventListener('click', async () => {
    if (!activeTabId) return;

    const originalText = downloadButton.textContent;
    downloadButton.disabled = true;
    downloadButton.textContent = '...';

    try {
      const response = await chrome.tabs.sendMessage(activeTabId, {
        type: 'DOWNLOAD_IMAGE',
        url: image.url,
        imageType: image.type,
        format: selectedFormat,
      });

      if (!response?.ok) throw new Error(response?.error || 'Descarga fallida');
      downloadButton.textContent = 'Listo';
    } catch (_error) {
      downloadButton.textContent = 'Error';
    } finally {
      downloadButton.disabled = false;
      setTimeout(() => {
        downloadButton.textContent = originalText;
      }, 1800);
    }
  });
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

  status.textContent = `${pageLabel}: ${images.length} imagen(es) con vista previa.`;
  list.innerHTML = images
    .map((image) => {
      const previewClass = image.previewClass || 'thumbnail';
      const format = defaultFormat(image);
      return `
        <li class="card" data-type="${escapeAttr(image.type)}">
          <div class="card-title">${image.label}</div>
          <div class="preview ${previewClass}">
            <img src="${escapeAttr(image.url)}" alt="${escapeAttr(image.label)}" />
          </div>
          <div class="actions">
            <div class="formats">
              <button type="button" class="format-btn ${format === 'png' ? 'active' : ''}" data-format="png">PNG</button>
              <button type="button" class="format-btn ${format === 'jpg' ? 'active' : ''}" data-format="jpg">JPG</button>
            </div>
            <button type="button" class="download-btn">Descargar</button>
          </div>
        </li>
      `;
    })
    .join('');

  list.querySelectorAll('.card').forEach((card) => {
    const image = images.find((item) => item.type === card.dataset.type);
    if (image) bindCardEvents(card, image);
  });
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

  activeTabId = tab?.id ?? null;

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