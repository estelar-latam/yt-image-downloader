function download(url, name) {
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
}

const banner = document.querySelector('img[src*="banner"], yt-page-header-view-model img');
if (banner) {
  const btn = document.createElement('button');
  btn.textContent = '📥 Banner'; btn.onclick = () => download(banner.src, 'banner.jpg');
  document.body.appendChild(btn);
}

const avatar = document.querySelector('img[src*="ytimg"], #avatar img');
if (avatar) {
  const btn = document.createElement('button');
  btn.textContent = '📥 Logo'; btn.onclick = () => download(avatar.src, 'logo.jpg');
  document.body.appendChild(btn);
}

// Thumbnail en página de video
const thumb = document.querySelector('img[src*="hqdefault"], img[src*="maxresdefault"]');
if (thumb) {
  const btn = document.createElement('button');
  btn.textContent = '📥 Thumbnail'; btn.onclick = () => download(thumb.src, 'thumbnail.jpg');
  document.body.appendChild(btn);
}
