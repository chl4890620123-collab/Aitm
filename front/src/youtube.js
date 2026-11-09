// A YouTube page is a visual learning reference, not a raw video file.
// Never treat the watch URL as a decoded MP4 that can be sent to MediaPipe.
export function getYouTubeVideoId(value) {
  if (!value) return null;
  let url;
  try { url = new URL(value); }
  catch { return null; }
  if (url.protocol !== 'https:') return null;
  const host = url.hostname.toLowerCase();
  let id = null;
  if (host === 'youtu.be') id = url.pathname.split('/').filter(Boolean)[0];
  else if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] === 'watch') id = url.searchParams.get('v');
    if (['shorts', 'embed', 'live'].includes(parts[0])) id = parts[1];
  }
  return /^[a-zA-Z0-9_-]{11}$/.test(id || '') ? id : null;
}

export function getYouTubeEmbed(value) {
  const id = getYouTubeVideoId(value);
  return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
}
