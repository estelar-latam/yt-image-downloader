const PAGE_LABELS = {
  channel: 'Canal',
  video: 'Video',
  shorts: 'Short',
  other: 'Otra pagina',
};

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
    list.innerHTML = '<li class="empty">Abre un canal o video de YouTube.</li>';
    return;
  }

  status.textContent = `${pageLabel}: ${images.length} imagen(es) detectada(s).`;
  list.innerHTML = images.map((image) => `<li>${image.label}</li>`).join('');
}

async function refresh() {
  const status = document.getElementById('status');
  const list = document.getElementById('list');
  const rescanButton = document.getElementById('rescan');
  const tab = await getActiveTab();

  if (!tab?.url?.includes('youtube.com')) {
    status.textContent = 'Abre una pestana de YouTube primero.';
    list.innerHTML = '';
    rescanButton.disabled = true;
    return;
  }

  rescanButton.disabled = false;

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'RESCAN' });
    render(response.images, response.pageType);
  } catch (_error) {
    status.textContent = 'Recarga la pagina de YouTube e intentalo de nuevo.';
    list.innerHTML = '';
  }
}

document.getElementById('rescan').addEventListener('click', refresh);
refresh();