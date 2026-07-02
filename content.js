(() => {
  if (window.__YT_IMG_DL_LOADED__) return;
  window.__YT_IMG_DL_LOADED__ = true;

  const PANEL_ID = 'yt-img-dl-extension-panel';
  let debounceTimer = null;
  let lastPath = location.pathname + location.search;

  function getPageType() {
    const path = location.pathname;
    if (path.startsWith('/watch')) return 'video';
    if (path.startsWith('/shorts/')) return 'shorts';
    if (
      path.startsWith('/@') ||
      path.startsWith('/channel/') ||
      path.startsWith('/c/') ||
      path.startsWith('/user/')
    ) {
      return 'channel';
    }
    return 'other';
  }

  function getExtensionFromUrl(url) {
    try {
      const clean = url.split('?')[0];
      const match = clean.match(/\.(jpe?g|png|webp|gif)$/i);
      if (match) return match[1].toLowerCase().replace('jpeg', 'jpg');
    } catch (_) {
      /* ignore */
    }
    if (/webp/i.test(url)) return 'webp';
    return 'jpg';
  }

  function sanitizeFilename(name) {
    return name.replace(/[^\w.-]+/g, '_').slice(0, 80) || 'image';
  }

  function normalizeUrl(url) {
    if (!url) return '';
    try {
      const parsed = new URL(url);
      parsed.search = '';
      return parsed.href;
    } catch (_) {
      return url.split('?')[0];
    }
  }

  function upgradeThumbnailUrl(url) {
    return url
      .replace(/hqdefault/i, 'maxresdefault')
      .replace(/sddefault/i, 'maxresdefault')
      .replace(/mqdefault/i, 'maxresdefault');
  }

  function queryImage(selectors) {
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      const url = el?.src || el?.content || el?.href;
      if (url) return url;
    }
    return null;
  }

  function findChannelBanner() {
    const url = queryImage([
      'ytd-channel-banner-renderer img',
      'yt-image-banner-view-model img',
      'yt-page-header-renderer yt-image-banner-view-model img',
      '#channel-header-container #header img',
      'yt-page-header-renderer img',
    ]);
    if (!url) return null;
    return { type: 'banner', label: 'Banner del canal', url };
  }

  function findChannelAvatar() {
    const url = queryImage([
      'ytd-channel-header-renderer #avatar img',
      'yt-channel-profile-image-renderer img',
      '#channel-header #avatar img',
      'ytd-video-owner-renderer #avatar img',
      'ytd-channel-name #avatar img',
    ]);
    if (!url || /hqdefault|maxresdefault|sddefault/i.test(url)) return null;
    return { type: 'avatar', label: 'Logo del canal', url };
  }

  function findVideoThumbnail() {
    const url = queryImage([
      'meta[property="og:image"]',
      'link[itemprop="thumbnailUrl"]',
      'video[poster]',
    ]);
    if (!url) return null;
    return {
      type: 'thumbnail',
      label: 'Thumbnail del video',
      url: upgradeThumbnailUrl(url),
    };
  }

  function findImages() {
    const pageType = getPageType();
    const found = [];
    const seen = new Set();

    const add = (item) => {
      if (!item?.url) return;
      const key = normalizeUrl(item.url);
      if (seen.has(key)) return;
      seen.add(key);
      found.push(item);
    };

    if (pageType === 'channel') {
      add(findChannelBanner());
      add(findChannelAvatar());
    } else if (pageType === 'video' || pageType === 'shorts') {
      add(findVideoThumbnail());
      add(findChannelAvatar());
    } else {
      add(findChannelBanner());
      add(findChannelAvatar());
      add(findVideoThumbnail());
    }

    return found;
  }

  function injectStyles() {
    if (document.getElementById('yt-img-dl-styles')) return;
    const style = document.createElement('style');
    style.id = 'yt-img-dl-styles';
    style.textContent = `
      #${PANEL_ID} {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 999999;
        background: #212121;
        color: #fff;
        border-radius: 12px;
        padding: 12px 14px;
        font-family: "Roboto", "Segoe UI", Arial, sans-serif;
        font-size: 13px;
        box-shadow: 0 4px 24px rgba(0, 0, 0, 0.45);
        min-width: 220px;
        max-width: 280px;
      }
      #${PANEL_ID} .yt-img-dl-title {
        font-weight: 600;
        margin-bottom: 8px;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      #${PANEL_ID} .yt-img-dl-empty {
        color: #aaa;
        font-size: 12px;
        line-height: 1.4;
      }
      #${PANEL_ID} .yt-img-dl-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-top: 6px;
        padding-top: 6px;
        border-top: 1px solid #333;
      }
      #${PANEL_ID} .yt-img-dl-item:first-of-type {
        border-top: none;
        margin-top: 0;
        padding-top: 0;
      }
      #${PANEL_ID} button {
        background: #ff0000;
        color: #fff;
        border: none;
        border-radius: 6px;
        padding: 6px 10px;
        cursor: pointer;
        font-size: 12px;
        white-space: nowrap;
      }
      #${PANEL_ID} button:hover {
        background: #cc0000;
      }
      #${PANEL_ID} .yt-img-dl-label {
        flex: 1;
        line-height: 1.3;
      }
    `;
    document.head.appendChild(style);
  }

  function requestDownload(url, type, button) {
    const ext = getExtensionFromUrl(url);
    const filename = `${sanitizeFilename(`youtube_${type}`)}.${ext}`;

    chrome.runtime.sendMessage({ type: 'DOWNLOAD', url, filename }, (response) => {
      if (chrome.runtime.lastError || !response?.ok) {
        button.textContent = 'Error';
        return;
      }
      button.textContent = 'Listo';
    });
  }

  function renderPanel(images) {
    injectStyles();

    let panel = document.getElementById(PANEL_ID);
    if (!panel) {
      panel = document.createElement('div');
      panel.id = PANEL_ID;
      document.body.appendChild(panel);
    }

    if (images.length === 0) {
      panel.innerHTML = `
        <div class="yt-img-dl-title">YT Image Downloader</div>
        <div class="yt-img-dl-empty">No se detectaron imagenes en esta pagina. Abre un canal o video de YouTube.</div>
      `;
      return;
    }

    const items = images
      .map(
        (image) => `
      <div class="yt-img-dl-item">
        <span class="yt-img-dl-label">${image.label}</span>
        <button type="button" data-url="${image.url}" data-type="${image.type}">Descargar</button>
      </div>
    `
      )
      .join('');

    panel.innerHTML = `
      <div class="yt-img-dl-title">YT Image Downloader</div>
      ${items}
    `;

    panel.querySelectorAll('button').forEach((button) => {
      button.addEventListener('click', () => {
        requestDownload(button.dataset.url, button.dataset.type, button);
      });
    });
  }

  function update() {
    renderPanel(findImages());
  }

  function debouncedUpdate() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(update, 400);
  }

  function onNavigate() {
    const current = location.pathname + location.search;
    if (current !== lastPath) {
      lastPath = current;
      debouncedUpdate();
    }
  }

  update();

  document.addEventListener('yt-navigate-finish', onNavigate);
  window.addEventListener('popstate', debouncedUpdate);

  const observer = new MutationObserver(debouncedUpdate);
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'PING') {
      sendResponse({ ready: true });
      return true;
    }

    if (message.type === 'GET_STATUS' || message.type === 'RESCAN') {
      if (message.type === 'RESCAN') update();
      sendResponse({ images: findImages(), pageType: getPageType() });
      return true;
    }
  });
})();