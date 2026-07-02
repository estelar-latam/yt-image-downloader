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

  function escapeAttr(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
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
    return { type: 'banner', label: 'Banner del canal', url, previewClass: 'banner' };
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
    return { type: 'avatar', label: 'Logo del canal', url, previewClass: 'avatar' };
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
      previewClass: 'thumbnail',
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

  async function convertImageToDataUrl(url, format) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas no disponible');

    if (format === 'jpg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    const mime = format === 'png' ? 'image/png' : 'image/jpeg';
    const quality = format === 'jpg' ? 0.92 : undefined;
    const converted = await new Promise((resolve, reject) => {
      canvas.toBlob((result) => {
        if (!result) {
          reject(new Error('Conversion fallida'));
          return;
        }
        resolve(result);
      }, mime, quality);
    });

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Lectura fallida'));
      reader.readAsDataURL(converted);
    });
  }

  async function downloadImage(url, imageType, format, button = null) {
    const originalText = button?.textContent ?? 'Descargar';

    if (button) {
      button.disabled = true;
      button.textContent = '...';
    }

    try {
      const dataUrl = await convertImageToDataUrl(url, format);
      const filename = `${sanitizeFilename(`youtube_${imageType}`)}.${format}`;

      const response = await chrome.runtime.sendMessage({
        type: 'DOWNLOAD_DATA',
        dataUrl,
        filename,
      });

      if (!response?.ok) throw new Error(response?.error || 'Descarga fallida');

      if (button) button.textContent = 'Listo';
      return { ok: true };
    } catch (error) {
      if (button) button.textContent = 'Error';
      throw error;
    } finally {
      if (button) {
        button.disabled = false;
        setTimeout(() => {
          if (button.textContent === 'Listo' || button.textContent === 'Error') {
            button.textContent = originalText;
          }
        }, 1800);
      }
    }
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
        width: 300px;
        max-height: 80vh;
        overflow-y: auto;
      }
      #${PANEL_ID} .yt-img-dl-title {
        font-weight: 600;
        margin-bottom: 10px;
      }
      #${PANEL_ID} .yt-img-dl-empty {
        color: #aaa;
        font-size: 12px;
        line-height: 1.4;
      }
      #${PANEL_ID} .yt-img-dl-item {
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid #333;
      }
      #${PANEL_ID} .yt-img-dl-item:first-of-type {
        border-top: none;
        margin-top: 0;
        padding-top: 0;
      }
      #${PANEL_ID} .yt-img-dl-label {
        font-weight: 500;
        margin-bottom: 8px;
        display: block;
      }
      #${PANEL_ID} .yt-img-dl-preview {
        display: flex;
        align-items: center;
        justify-content: center;
        background: #111;
        border: 1px solid #333;
        border-radius: 8px;
        overflow: hidden;
        margin-bottom: 8px;
      }
      #${PANEL_ID} .yt-img-dl-preview.banner,
      #${PANEL_ID} .yt-img-dl-preview.thumbnail {
        height: 84px;
      }
      #${PANEL_ID} .yt-img-dl-preview.avatar {
        width: 72px;
        height: 72px;
        margin-left: auto;
        margin-right: auto;
      }
      #${PANEL_ID} .yt-img-dl-preview img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      #${PANEL_ID} .yt-img-dl-preview.avatar img {
        object-fit: cover;
        border-radius: 50%;
      }
      #${PANEL_ID} .yt-img-dl-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      #${PANEL_ID} .yt-img-dl-formats {
        display: flex;
        gap: 4px;
        flex: 1;
      }
      #${PANEL_ID} .yt-img-dl-format {
        flex: 1;
        background: #333;
        color: #ddd;
        border: 1px solid #444;
        border-radius: 6px;
        padding: 6px 0;
        cursor: pointer;
        font-size: 11px;
      }
      #${PANEL_ID} .yt-img-dl-format.active {
        background: #ff0000;
        border-color: #ff0000;
        color: #fff;
      }
      #${PANEL_ID} .yt-img-dl-download {
        background: #ff0000;
        color: #fff;
        border: none;
        border-radius: 6px;
        padding: 6px 12px;
        cursor: pointer;
        font-size: 12px;
        white-space: nowrap;
      }
      #${PANEL_ID} .yt-img-dl-download:hover {
        background: #cc0000;
      }
      #${PANEL_ID} .yt-img-dl-download:disabled {
        opacity: 0.7;
        cursor: wait;
      }
    `;
    document.head.appendChild(style);
  }

  function bindItemEvents(panel) {
    panel.querySelectorAll('.yt-img-dl-item').forEach((item) => {
      const formats = item.querySelectorAll('.yt-img-dl-format');
      const downloadBtn = item.querySelector('.yt-img-dl-download');
      let selectedFormat = 'jpg';

      formats.forEach((btn) => {
        btn.addEventListener('click', () => {
          selectedFormat = btn.dataset.format;
          formats.forEach((f) => f.classList.toggle('active', f === btn));
        });
      });

      downloadBtn.addEventListener('click', () => {
        downloadImage(
          downloadBtn.dataset.url,
          downloadBtn.dataset.type,
          selectedFormat,
          downloadBtn
        );
      });
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
      .map((image) => {
        const previewClass = image.previewClass || 'thumbnail';
        const defaultFormat = previewClass === 'avatar' ? 'png' : 'jpg';
        return `
      <div class="yt-img-dl-item">
        <span class="yt-img-dl-label">${image.label}</span>
        <div class="yt-img-dl-preview ${previewClass}">
          <img src="${escapeAttr(image.url)}" alt="${escapeAttr(image.label)}" loading="lazy" />
        </div>
        <div class="yt-img-dl-actions">
          <div class="yt-img-dl-formats">
            <button type="button" class="yt-img-dl-format ${defaultFormat === 'png' ? 'active' : ''}" data-format="png">PNG</button>
            <button type="button" class="yt-img-dl-format ${defaultFormat === 'jpg' ? 'active' : ''}" data-format="jpg">JPG</button>
          </div>
          <button type="button" class="yt-img-dl-download" data-url="${escapeAttr(image.url)}" data-type="${escapeAttr(image.type)}">Descargar</button>
        </div>
      </div>
    `;
      })
      .join('');

    panel.innerHTML = `
      <div class="yt-img-dl-title">YT Image Downloader</div>
      ${items}
    `;

    bindItemEvents(panel);
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

    if (message.type === 'DOWNLOAD_IMAGE') {
      downloadImage(message.url, message.imageType, message.format)
        .then(() => sendResponse({ ok: true }))
        .catch((error) => sendResponse({ ok: false, error: error.message }));
      return true;
    }
  });
})();