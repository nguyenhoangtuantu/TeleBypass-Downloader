(function () {
  if (window.__tgDownloaderMainLoaded) return;
  window.__tgDownloaderMainLoaded = true;

  const contentRangeRegexRule = /^bytes (\d+)-(\d+)\/(\d+)$/;
const REFRESH_DELAY = 500;
const DOWNLOAD_DEDUP_MS = 3000;
const recentDownloadKeys = new Map();
const recentMediaUrls = [];
const audioInstances = [];

function isTrackedMediaUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase();
  if (lower.startsWith('blob:')) return true;
  if (/\.(jpg|jpeg|png|gif|webp|svg)(\?|#|$)/.test(lower)) return false;
  return (
    lower.includes('/progressive/') ||
    lower.includes('/stream/') ||
    lower.includes('/download/') ||
    /\.(mp3|m4a|ogg|opus|aac|mpeg|mpga|wav|flac|weba)(\?|#|$)/.test(lower) ||
    (lower.includes('document') && !lower.includes('videoplay'))
  );
}

function trackMediaUrl(url, source) {
  if (!isTrackedMediaUrl(url)) return;
  recentMediaUrls.push({ url, time: Date.now(), source });
  if (recentMediaUrls.length > 300) {
    recentMediaUrls.splice(0, recentMediaUrls.length - 300);
  }
}

function getTrackedMediaUrlsSince(since) {
  const items = recentMediaUrls.filter((item) => item.time >= since);
  audioInstances.forEach(({ audio, createdAt }) => {
    const url = audio.currentSrc || audio.src;
    if (!url || !isTrackedMediaUrl(url)) return;
    const assignedAt = Number(audio.dataset?.tgDownloaderSrcAt || createdAt);
    if (assignedAt < since && audio.paused) return;
    items.push({ url, time: assignedAt, source: 'audio-instance' });
  });

  items.sort((a, b) => a.time - b.time);
  const deduped = [];
  const seen = new Set();
  items.forEach((item) => {
    if (seen.has(item.url)) return;
    seen.add(item.url);
    deduped.push(item);
  });
  return deduped;
}

(function hookAudioConstructor() {
  if (window.__tgDownloaderAudioCtorHook) return;
  window.__tgDownloaderAudioCtorHook = true;
  const OrigAudio = window.Audio;
  window.Audio = function (...args) {
    const audio = new OrigAudio(...args);
    audioInstances.push({ audio, createdAt: Date.now() });
    if (audioInstances.length > 80) audioInstances.shift();
    return audio;
  };
  window.Audio.prototype = OrigAudio.prototype;
})();

(function hookMediaElementSrc() {
  if (window.__tgDownloaderMediaSrcHook) return;
  window.__tgDownloaderMediaSrcHook = true;
  const srcDescriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src');
  if (!srcDescriptor?.set) return;
  Object.defineProperty(HTMLMediaElement.prototype, 'src', {
    configurable: true,
    enumerable: srcDescriptor.enumerable,
    get: srcDescriptor.get,
    set(value) {
      trackMediaUrl(value, 'src');
      try {
        this.dataset.tgDownloaderSrcAt = String(Date.now());
      } catch (error) {
        // ignore
      }
      return srcDescriptor.set.call(this, value);
    },
  });
})();

(function hookSetAttribute() {
  if (window.__tgDownloaderSetAttributeHook) return;
  window.__tgDownloaderSetAttributeHook = true;
  const origSetAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (name, value) {
    if (name === 'src' && value && (this instanceof HTMLMediaElement || this.tagName === 'AUDIO' || this.tagName === 'VIDEO')) {
      trackMediaUrl(String(value), 'setAttribute');
      try {
        this.dataset.tgDownloaderSrcAt = String(Date.now());
      } catch (error) {
        // ignore
      }
    }
    return origSetAttribute.call(this, name, value);
  };
})();

(function hookFetch() {
  if (window.__tgDownloaderFetchHook) return;
  window.__tgDownloaderFetchHook = true;
  const origFetch = window.fetch;
  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : input?.url;
    if (url) trackMediaUrl(url, 'fetch');
    return origFetch.call(this, input, init);
  };
})();

(function hookCreateObjectURL() {
  if (window.__tgDownloaderBlobHook) return;
  window.__tgDownloaderBlobHook = true;
  const origCreateObjectURL = URL.createObjectURL;
  URL.createObjectURL = function (blob) {
    const url = origCreateObjectURL.call(URL, blob);
    const type = blob?.type || '';
    if (!type || type.startsWith('audio/') || type.startsWith('video/') || type === 'application/octet-stream') {
      trackMediaUrl(url, 'blob');
    }
    return url;
  };
})();

function respondWithTrackedMediaUrls(event) {
  const since = typeof event.data.since === 'number' ? event.data.since : 0;
  const items = getTrackedMediaUrlsSince(since);
  window.postMessage(
    {
      type: 'TG_DOWNLOADER_MEDIA_URLS_RESPONSE',
      requestId: event.data.requestId,
      items,
      urls: items.map((item) => item.url),
    },
    '*',
  );
}

window.addEventListener('message', function (event) {
  if (event.source !== window || !event.data) return;
  if (event.data.type === 'TG_DOWNLOADER_GET_MEDIA_URLS' || event.data.type === 'TG_DOWNLOADER_GET_AUDIO_SRCS') {
    respondWithTrackedMediaUrls(event);
  }
});

document.addEventListener('tg_downloader_get_media_urls', function (event) {
  const { requestId, since } = event.detail || {};
  const items = getTrackedMediaUrlsSince(typeof since === 'number' ? since : 0);
  document.dispatchEvent(
    new CustomEvent('tg_downloader_media_urls_response', {
      detail: {
        requestId,
        items,
        urls: items.map((item) => item.url),
      },
    }),
  );
});

/**
 * 关闭高级导出后重置 Telegram Web K 布局。
 * 在 page world 执行，才能驱动 windowSize / updateColumnWidths。
 */
document.addEventListener('tg_downloader_reset_layout', function () {
  try {
    const root = document.documentElement;
    const body = document.body;
    const vw = window.innerWidth || root.clientWidth || 0;
    if (vw < 200) return;

    // 清理可能的横向偏移残留
    root.style.removeProperty('width');
    root.style.removeProperty('max-width');
    root.scrollLeft = 0;
    if (body) {
      body.style.removeProperty('width');
      body.style.removeProperty('max-width');
      body.scrollLeft = 0;
    }
    if (window.scrollX) {
      window.scrollTo(0, window.scrollY);
    }

    const page = document.getElementById('page-chats') || document.getElementById('main-columns');
    if (page) {
      page.style.removeProperty('margin-left');
      page.style.removeProperty('margin-right');
      page.style.removeProperty('transform');
      page.style.removeProperty('left');
      page.removeAttribute('data-tg-downloader-shift-fix');
    }

    // 按当前视口同步关键列宽变量（对齐 tweb updateColumnWidths）
    const DEFAULT_COLUMN_WIDTH = 360;
    const PAGE_CHATS_PADDING = 16;
    const CHAT_WIDTH_MAX = 696;
    const FLOATING_LEFT = 925;
    const readPx = (name, fallback) => {
      const n = parseFloat(getComputedStyle(root).getPropertyValue(name));
      return Number.isFinite(n) ? n : fallback;
    };
    const rootStyle = getComputedStyle(root);
    const safeAreaX =
      (parseFloat(rootStyle.paddingLeft) || 0) + (parseFloat(rootStyle.paddingRight) || 0);
    const availableWidth = Math.max(320, vw - safeAreaX);
    const leftWidth = readPx('--left-column-width', Math.min(vw, DEFAULT_COLUMN_WIDTH));
    const rightWidth = readPx('--right-column-width', Math.min(vw, DEFAULT_COLUMN_WIDTH));
    const foldersOffset = readPx('--folders-sidebar-offset', 0);
    const isMobile = !!(body && body.classList.contains('is-mobile'));
    const isFloatingLeft = !isMobile && vw <= FLOATING_LEFT;
    const rightColumnFits =
      foldersOffset + leftWidth + rightWidth + CHAT_WIDTH_MAX + PAGE_CHATS_PADDING * 4;
    const floats = isMobile || availableWidth < rightColumnFits;
    const middleWidth = isMobile ? vw : availableWidth - PAGE_CHATS_PADDING * 2;
    const chatAvailableWidth =
      isMobile || isFloatingLeft
        ? middleWidth
        : availableWidth - foldersOffset - leftWidth - PAGE_CHATS_PADDING * 3;
    const chatWidth = isMobile ? vw : Math.min(Math.max(280, chatAvailableWidth), CHAT_WIDTH_MAX);

    root.style.setProperty('--middle-column-width', middleWidth + 'px');
    root.style.setProperty('--middle-column-width-value', String(middleWidth));
    root.style.setProperty('--chat-width', chatWidth + 'px');
    root.style.setProperty('--page-chats-padding', (isMobile ? 0 : PAGE_CHATS_PADDING) + 'px');
    root.style.setProperty('--default-column-width', Math.min(vw, DEFAULT_COLUMN_WIDTH) + 'px');
    const center = document.getElementById('column-center');
    if (center) {
      center.style.setProperty('--page-chats-padding', (isMobile ? 8 : PAGE_CHATS_PADDING) + 'px');
    }
    if (body) {
      body.classList.toggle('right-column-floats', floats);
    }

    // 驱动 TG 内部 windowSize
    const fireResize = function () {
      window.dispatchEvent(new Event('resize'));
      window.dispatchEvent(new Event('orientationchange'));
      if (window.visualViewport) {
        window.visualViewport.dispatchEvent(new Event('resize'));
      }
    };
    fireResize();
    setTimeout(fireResize, 50);
    setTimeout(fireResize, 200);
    setTimeout(fireResize, 500);
  } catch (e) {
    try {
      window.dispatchEvent(new Event('resize'));
    } catch (_) {
      // ignore
    }
  }
});

function getDownloadDedupKey(videoUrl, videoId) {
  const id = videoId || '';
  if (!videoUrl) {
    return id;
  }
  if (videoUrl.startsWith('blob:')) {
    return `blob:${id}`;
  }
  try {
    const parsed = new URL(videoUrl);
    return `${id}:${parsed.pathname}`;
  } catch (error) {
    return `${id}:${videoUrl.split('?')[0]}`;
  }
}

function shouldStartDownload(videoUrl, videoId) {
  const key = getDownloadDedupKey(videoUrl, videoId);
  const now = Date.now();
  const lastStartedAt = recentDownloadKeys.get(key);
  if (lastStartedAt && now - lastStartedAt < DOWNLOAD_DEDUP_MS) {
    console.warn('[TG Downloader] Skip duplicate download:', key);
    return false;
  }
  recentDownloadKeys.set(key, now);
  return true;
}

function dispatchDownloadError(id, page, download_id, reason) {
  if (!id) {
    return;
  }
  document.dispatchEvent(
    new CustomEvent(id + '_download_progress', {
      detail: {
        video_id: id,
        progress: 0,
        page,
        download_id,
        error: true,
        errorMessage: reason instanceof Error ? reason.message : String(reason),
      },
    }),
  );
}

function inferExtensionFromMime(mimeType, fallback = 'mp4') {
  if (!mimeType || typeof mimeType !== 'string') return fallback;
  const part = mimeType.split('/')[1];
  if (!part || part === 'octet-stream') return fallback;
  const ext = part.split(';')[0] || fallback;
  if (ext === 'jpeg') return 'jpg';
  if (ext === 'quicktime') return 'mov';
  if (ext === 'mpeg') return 'mp3';
  return ext;
}

/** 是否已带已知媒体扩展名（勿用 includes('.')，频道名常含句点） */
function hasKnownMediaExtension(name) {
  return /\.(jpe?g|png|gif|webp|bmp|svg|mp4|webm|mov|mkv|avi|mp3|m4a|ogg|opus|wav|flac|aac|pdf|zip|rar|7z|tgs|webp)$/i.test(
    String(name || ''),
  );
}

function normalizeDownloadExtension(ext, fallback = 'mp4') {
  const raw = String(ext || fallback).replace(/^\./, '').trim().toLowerCase();
  if (!raw || raw === 'octet-stream') return fallback;
  if (raw === 'jpeg') return 'jpg';
  if (raw === 'quicktime') return 'mov';
  return raw;
}

function ensureFileExtension(name, ext) {
  const safeExt = normalizeDownloadExtension(ext, 'mp4');
  const cleaned = String(name || '')
    .trim()
    .replace(/[.\s]+$/g, '');
  if (!cleaned) return `download.${safeExt}`;
  if (hasKnownMediaExtension(cleaned)) return cleaned;
  return `${cleaned}.${safeExt}`;
}

function defaultExtensionFromDetail(detail, fallback = 'mp4') {
  if (detail?.fileType === 'image' || detail?.fileType === 'photo') return 'jpg';
  if (detail?.fileType === 'audio') return 'mp3';
  if (detail?.fileType === 'gif') return 'mp4';
  if (detail?.fileType === 'video') return 'mp4';
  return normalizeDownloadExtension(fallback, 'mp4');
}

function resolveDownloadFilename(detail, fallbackName, fallbackExt = 'mp4') {
  const customTitle = typeof detail?.customTitle === 'string' ? detail.customTitle.trim() : '';
  const safeExt = defaultExtensionFromDetail(detail, fallbackExt);
  const fallback = fallbackName || `download.${safeExt}`;

  // 高级导出模板名通常不含扩展名；即使含句点（日期/频道名）也要补上真实扩展名
  if (customTitle && detail?.useExportFilename) {
    return ensureFileExtension(customTitle, safeExt);
  }

  if (!customTitle) {
    return ensureFileExtension(fallback, safeExt);
  }

  if (!fallbackName || fallbackName === 'undefined') {
    return ensureFileExtension(customTitle, safeExt);
  }

  if (String(fallbackName).startsWith(`${customTitle}_`) || fallbackName === customTitle) {
    return ensureFileExtension(fallbackName, safeExt);
  }

  return ensureFileExtension(`${customTitle}_${fallback}`, safeExt);
}

function handleMediaDownloadDetail(detail) {
  if (!detail) return;
  if (detail.type == 'single') {
    const { video_url, video_id, page, download_id } = detail.video_src;
    if (!shouldStartDownload(video_url, video_id)) {
      return;
    }
    handleDownload(video_url, video_id, page, download_id, detail).catch((error) => {
      dispatchDownloadError(video_id, page, download_id, error);
    });
  } else if (detail.type == 'batch') {
    const video_list = detail.video_src;
    for (let i = 0; i < video_list.length; i++) {
      const { video_url, video_id, page, download_id } = video_list[i];
      if (!shouldStartDownload(video_url, video_id)) {
        continue;
      }
      handleDownload(video_url, video_id, page, download_id, detail).catch((error) => {
        dispatchDownloadError(video_id, page, download_id, error);
      });
    }
  }
}

// 与 main 分支一致：监听 content script 派发的 DOM 事件（page world 中 fetch 可携带会话）
document.addEventListener('media_download_event', function (e) {
  handleMediaDownloadDetail(e.detail);
});

// postMessage 仅作为兜底
window.addEventListener('message', function (event) {
  if (event.source !== window || !event.data) return;
  if (event.data.type !== 'TG_DOWNLOADER_MEDIA_DOWNLOAD') return;
  handleMediaDownloadDetail(event.data.detail);
});

const downloadVideo = (url, id = '', page, download_id, detail) => {
  let blobs = [];
  let nextOffset = 0;
  let _totalSize = null;
  let fileExtension = defaultExtensionFromDetail(detail, 'mp4');
  const UserAgent = 'User-Agent Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/117.0';

  let fileName = detail?.title || (id ? `${id}.${fileExtension}` : (Math.random() + 1).toString(36).substring(2, 10) + '.' + fileExtension);
  try {
    const metadata = JSON.parse(decodeURIComponent(url.split('/')[url.split('/').length - 1]));
    if (metadata.fileName) {
      fileName = metadata.fileName;
    }
  } catch (e) {}
  const fetchNextPart = () => {
    fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: {
        Range: `bytes=${nextOffset}-`,
      },
      'User-Agent': UserAgent,
    })
      .then(async (res) => {
        if (![200, 206].includes(res.status)) {
          throw new Error('Non 200/206 response was received: ' + res.status);
        }
        const contentType = res.headers.get('Content-Type');
        const mime = contentType?.split(';')[0] || '';
        fileExtension = inferExtensionFromMime(mime, fileExtension);
        if (!detail?.title) {
          fileName = ensureFileExtension(fileName.replace(/\.[^.]+$/, '') || fileName, fileExtension);
        }

        const contentRange = res.headers.get('Content-Range');
        const match = contentRange?.match(contentRangeRegexRule);

        // 服务端未返回 Content-Range（常见于 200 整文件响应）时按整文件处理
        if (!match) {
          if (res.status !== 200) {
            throw new Error('Missing or invalid Content-Range header');
          }
          const blob = await res.blob();
          const totalSize = parseInt(res.headers.get('Content-Length'), 10) || blob.size;
          nextOffset = totalSize;
          _totalSize = totalSize;
          if (id != '') {
            document.dispatchEvent(
              new CustomEvent(id + '_download_progress', {
                detail: { video_id: id, progress: '100', page: page, download_id: download_id },
              }),
            );
          }
          return blob;
        }

        const startOffset = parseInt(match[1], 10);
        const endOffset = parseInt(match[2], 10);
        const totalSize = parseInt(match[3], 10);

        if (startOffset !== nextOffset) {
          throw 'Gap detected between responses.';
        }
        if (_totalSize && totalSize !== _totalSize) {
          throw 'Total size differs';
        }

        nextOffset = endOffset + 1;
        _totalSize = totalSize;

        //定一个事件，用于传递文件的下载进度情况：
        if (id != '') {
          let mediaDownloadEventProgress = new CustomEvent(id + '_download_progress', {
            detail: { video_id: id, progress: ((nextOffset * 100) / totalSize).toFixed(0), page: page, download_id: download_id },
          });
          //触发事件
          document.dispatchEvent(mediaDownloadEventProgress);
        }
        return res.blob();
      })
      .then((resBlob) => {
        blobs.push(resBlob);
      })
      .then(() => {
        if (!_totalSize) {
          throw new Error('_totalSize is NULL');
        }

        if (nextOffset < _totalSize) {
          fetchNextPart();
        } else {
          saveFile();
        }
      })
      .catch((reason) => {
        console.error(reason, fileName);
        dispatchDownloadError(id, page, download_id, reason);
      });
  };

  const saveFile = () => {
    const customFilename = resolveDownloadFilename(detail, fileName, fileExtension || 'mp4');
    const blobType = fileExtension ? `${detail?.fileType === 'audio' ? 'audio' : 'video'}/${fileExtension}` : detail?.fileType === 'audio' ? 'audio/mpeg' : 'video/mp4';
    const blob = new Blob(blobs, { type: blobType });
    const blobUrl = window.URL.createObjectURL(blob);

    const a = document.createElement('a');
    document.body.appendChild(a);
    a.href = blobUrl;
    a.download = customFilename;
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(blobUrl);
    updateProgress(100, id, page, download_id);
  };

  fetchNextPart();
};

async function fetchUrl(url) {
  let t = await fetch(url, { credentials: 'include', headers: { Range: 'bytes=0-' } });
  if (!t.ok) throw Error(`HTTP error! Status: ${t.status}`);
  const contentRange = t.headers.get('Content-Range');
  if (!contentRange) {
    throw Error('Missing Content-Range header');
  }
  let r = parseInt(contentRange.split('/')[1], 10),
    o = parseInt(t.headers.get('Content-Length'), 10),
    n = t.headers.get('Content-Type'),
    s = t.headers.get('Accept-Ranges');
  if ('bytes' !== s) throw Error('Server does not support partial content (byte ranges)');
  if (!Number.isFinite(r) || !Number.isFinite(o) || o <= 0) {
    throw Error('Invalid Content-Range or Content-Length');
  }
  return {
    contentType: n,
    segmentCount: Math.ceil(r / o),
    contentSize: r,
    segmentSize: o,
  };
}

function shouldFallbackToFullDownload(error) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('Content-Range') ||
    message.includes('partial content') ||
    message.includes('Content-Length') ||
    message.includes("reading 'split'")
  );
}

async function handleDownload(url, id, page, download_id, detail) {
  if (url.startsWith('blob:')) {
    return downloadVideo(url, id, page, download_id, detail);
  }
  try {
    let { segmentCount: n, segmentSize: c, contentSize: d, contentType: f } = await fetchUrl(url);

    let progress = Array(n)
        .fill(0)
        .map((e, t) => t * c)
        .map((t, r) => {
          let a = Math.min(t + c - 1, d - 1),
            o = { Range: `bytes=${t}-${a}` };
          return () =>
            fetch(url, { credentials: 'include', headers: o }).then((res) => {
              if (408 === res.status) {
                throw Error('fetch Error', {
                  cause: {
                    range: `bytes=${t}-${a}`,
                    index: r,
                    response: res,
                  },
                });
              }
              let prog = ((a / d) * 100).toFixed(2);

              return (updateProgress(prog, id, page, download_id), res.arrayBuffer());
            });
        }),
      name = extractFileNameFromUrl(url, f) || `${id || 'media'}.${inferExtensionFromMime(f, 'mp4')}`,
      h = await fetchResults(progress, 20, '11'),
      m = new Blob(h, { type: f || 'application/octet-stream' });
    let downloadUrl = URL.createObjectURL(m);
    const customFilename = resolveDownloadFilename(detail, name, inferExtensionFromMime(f, 'mp4'));
    saveFile(downloadUrl, customFilename);
    updateProgress(100, id, page, download_id);
    return;
  } catch (e) {
    if (shouldFallbackToFullDownload(e)) {
      console.warn('[handleDownload] Segmented download failed, falling back to full download:', e instanceof Error ? e.message : e);
      return downloadVideo(url, id, page, download_id, detail);
    }
    dispatchDownloadError(id, page, download_id, e);
    throw e;
  } finally {
    // t(!1);
  }
}

async function fetchResults(tasks, batchSize, retryOnError) {
  let results = [],
    currentIndex = 0;

  while (currentIndex < tasks.length) {
    let batch = tasks.slice(currentIndex, currentIndex + batchSize).map((task) => task());
    try {
      let batchResults = await Promise.all(batch);
      results.push(...batchResults);
      currentIndex += batchSize;
    } catch (error) {
      if (error instanceof Error) {
        if (retryOnError && error.message === 'fetch Error') {
          let { index } = error.cause;
          currentIndex = index;
          await delay(1000);
        }
      } else {
        throw error;
      }
    }
  }
  return results;
}

async function delay(e) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(null);
    }, e);
  });
}
function saveFile(e, t, n) {
  let r = document.createElement('a');
  ((r.href = e), (r.download = t), r.click());
}

function extractFileNameFromUrl(url, type) {
  let fileExtension = inferExtensionFromMime(type, 'mp4');

  try {
    let fileName,
      metadata = '';
    if (url.includes('progressive/')) {
      //a-version
      metadata = url.split('document').slice(1);
      fileName = metadata + '.' + fileExtension;
    } else {
      //k-version
      metadata = JSON.parse(JSON.parse(JSON.stringify(decodeURIComponent(url.split('/').slice(1).join('.')))));
      if (metadata.fileName) {
        fileName = metadata.fileName;
      } else if (metadata.location.id) {
        fileName = metadata.location.id + '.' + fileExtension;
      }
    }

    return fileName;
  } catch (e) {
    // Invalid JSON string, pass extracting fileName
  }
}

function updateProgress(p, id, pa, d_id) {
  //定一个事件，用于传递文件的下载进度情况：
  if (id != '') {
    let media_download_event_progress = new CustomEvent(id + '_download_progress', {
      detail: { video_id: id, progress: p, page: pa, download_id: d_id },
    });
    //触发事件
    document.dispatchEvent(media_download_event_progress);
  }
}

function tgIsElementVisible(el) {
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width < 8 || rect.height < 8) return false;
  const style = window.getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0.01;
}

function tgIsKRightColumnVisible() {
  return tgIsElementVisible(document.querySelector('#column-right'));
}

function tgIsKSidebarProfileOpen() {
  if (!tgIsKRightColumnVisible()) return false;
  const panel =
    document.querySelector('#column-right .shared-media-container.profile-container.active') ||
    document.querySelector('#column-right .sidebar-slider-item.profile-container.active') ||
    document.querySelector('#column-right .profile-container.active');
  return tgIsElementVisible(panel);
}

function tgIsKMediaSidebarActive() {
  if (!tgIsKSidebarProfileOpen()) return false;
  const mediaPanel = document.querySelector('#column-right .search-super-container-media.active');
  return tgIsElementVisible(mediaPanel);
}

function tgGetKTabsMenu() {
  const root = document.querySelector('#column-right .search-super');
  if (!root) return null;
  return (
    root.querySelector('.search-super-tabs.menu-horizontal-div') ||
    root.querySelector('.search-super-nav-scrollable .search-super-tabs') ||
    root.querySelector('.search-super-tabs-scrollable .menu-horizontal-div')
  );
}

function tgGetKTabsContainer() {
  const root = document.querySelector('#column-right .search-super');
  return root ? root.querySelector('.search-super-tabs-container') : null;
}

function tgGetKTabLabel(tab) {
  const span = tab.querySelector('.menu-horizontal-div-item-span');
  return (span ? span.textContent : tab.textContent || '').trim();
}

function tgClickTab(tab) {
  if (!tab) return;
  tab.scrollIntoView({ block: 'nearest', inline: 'center' });
  const target = tab.classList.contains('menu-horizontal-div-item') ? tab : tab.closest('.menu-horizontal-div-item') || tab;
  const inner = target.querySelector('.menu-horizontal-div-item-span, .Tab_inner');
  const clickTarget = inner || target;
  const rect = clickTarget.getBoundingClientRect();
  const clientX = rect.left + Math.max(1, rect.width / 2);
  const clientY = rect.top + Math.max(1, rect.height / 2);
  const pointerInit = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX,
    clientY,
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
    button: 0,
    buttons: 1,
  };
  const mouseDownInit = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX,
    clientY,
    button: 0,
    buttons: 1,
  };
  const mouseUpInit = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX,
    clientY,
    button: 0,
    buttons: 0,
  };
  clickTarget.dispatchEvent(new PointerEvent('pointerdown', pointerInit));
  clickTarget.dispatchEvent(new MouseEvent('mousedown', mouseDownInit));
  clickTarget.dispatchEvent(new PointerEvent('pointerup', { ...pointerInit, buttons: 0 }));
  clickTarget.dispatchEvent(new MouseEvent('mouseup', mouseUpInit));
  clickTarget.dispatchEvent(new MouseEvent('click', mouseUpInit));
  if (typeof clickTarget.click === 'function') clickTarget.click();
  if (typeof target.click === 'function') target.click();
}

const TG_K_NON_MEDIA_TAB_LABELS = new Set([
  'Gifts', 'Gift', '礼物', '禮物', 'GIF', 'GIFs', 'Files', '文件', '檔案', 'Links', '链接', '連結',
  'Stories', 'Posts', 'Members', '成员', '成員', 'Music', '音乐', '音樂', 'Voice', '语音', '語音',
]);

function tgNormalizeTabLabel(text) {
  return String(text || '').trim().replace(/\s+/g, ' ');
}

function tgIsKNonMediaTabLabel(text) {
  const normalized = tgNormalizeTabLabel(text);
  if (!normalized) return false;
  if (TG_K_NON_MEDIA_TAB_LABELS.has(normalized)) return true;
  if (/^gift(s)?$/i.test(normalized)) return true;
  if (/^gif(s)?$/i.test(normalized)) return true;
  return false;
}

function tgIsKMediaTabLabel(text) {
  const normalized = tgNormalizeTabLabel(text);
  if (!normalized) return false;
  if (normalized === 'Media' || /^media\b/i.test(normalized)) return true;
  return /媒体|媒體|медиа|メディア|미디어/i.test(normalized);
}

function tgFindKMediaTabByPanelIndex() {
  const tabsContainer = tgGetKTabsContainer();
  const tabsMenu = tgGetKTabsMenu();
  if (!tabsContainer || !tabsMenu) return null;
  const mediaPanel = tabsContainer.querySelector('.search-super-container-media');
  if (!mediaPanel) return null;
  const panelIndex = Array.from(tabsContainer.children).indexOf(mediaPanel);
  if (panelIndex < 0) return null;
  const tabItems = [...tabsMenu.querySelectorAll('.menu-horizontal-div-item')].filter((t) => !t.classList.contains('hide'));
  const tabItem = tabItems[panelIndex];
  if (!tabItem) return null;
  const label = tgGetKTabLabel(tabItem);
  if (tgIsKNonMediaTabLabel(label) || !tgIsKMediaTabLabel(label)) return null;
  return tabItem;
}

function tgFindKMediaTabByLabel() {
  const tabsMenu = tgGetKTabsMenu();
  if (!tabsMenu) return null;
  for (const tab of tabsMenu.querySelectorAll('.menu-horizontal-div-item')) {
    if (tab.classList.contains('hide')) continue;
    const label = tgGetKTabLabel(tab);
    if (tgIsKNonMediaTabLabel(label)) continue;
    if (tgIsKMediaTabLabel(label)) return tab;
  }
  return null;
}

function tgHasKSearchSuper() {
  return !!document.querySelector('#column-right .search-super');
}

async function tgClickKMediaStatSubtitle() {
  const items = document.querySelectorAll('#column-right .sidebar-header__subtitle .transition-item');
  for (const item of items) {
    const text = (item.textContent || '').trim();
    if (!/\d/.test(text)) continue;
    if (!/(media|媒体|媒體|média|medien|медиа|メディア|미디어|medio|mídia)/i.test(text)) continue;
    tgClickTab(item);
    await delay(500);
    if (tgIsKMediaSidebarActive()) return true;
  }
  return false;
}

async function tgOpenKChatSidebar(maxWait = 4000) {
  if (tgIsKSidebarProfileOpen()) return true;

  const topbar =
    document.querySelector('#column-center .topbar') ||
    document.querySelector('#column-center .sidebar-header.topbar');

  const openTargets = [
    topbar?.querySelector('.chat-info'),
    document.querySelector('#column-center .chat-info-container .chat-info'),
    document.querySelector('#column-center .chat-info-container'),
    document.querySelector('#column-center .sidebar-header.topbar .chat-info'),
    document.querySelector('#column-center .topbar .chat-info'),
    document.querySelector('#column-center .chat-info .avatar'),
    document.querySelector('#column-center .chat-info .peer-title'),
    document.querySelector('#column-center .topbar .peer-title'),
    document.querySelector('#column-center .chat-info'),
  ].filter(Boolean);

  for (const target of openTargets) {
    tgClickTab(target);
    const start = Date.now();
    while (Date.now() - start < maxWait) {
      if (tgIsKSidebarProfileOpen()) return true;
      await delay(120);
    }
  }

  return tgIsKSidebarProfileOpen();
}

function tgFindKMediaViewerCloseButton() {
  const viewer =
    document.querySelector('div.media-viewer-whole.active') ||
    document.querySelector('div.media-viewer-whole.is-visible');
  if (!viewer) return null;

  const buttonsRoot =
    viewer.querySelector('.media-viewer-topbar .media-viewer-buttons') ||
    viewer.querySelector('.media-viewer-buttons');
  if (!buttonsRoot) return null;

  const candidates = [...buttonsRoot.children].filter(
    (node) =>
      node instanceof HTMLElement &&
      node.classList.contains('btn-icon') &&
      !node.classList.contains('hide') &&
      tgIsElementVisible(node) &&
      !node.classList.contains('btn-menu-toggle') &&
      !node.classList.contains('quality-download-options-button-menu'),
  );

  return candidates[candidates.length - 1] || null;
}

async function tgCloseKMediaViewer(maxAttempts = 5) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (!tgIsKMediaViewerOpen()) return true;

    const closeBtn = tgFindKMediaViewerCloseButton();
    if (closeBtn) {
      tgClickTab(closeBtn);
      await delay(400);
      if (!tgIsKMediaViewerOpen()) return true;
    }

    await delay(250);
  }

  return !tgIsKMediaViewerOpen();
}

async function tgClickKSidebarMediaByMid(mid) {
  if (!mid) return false;

  const selectors = [
    `#column-right .search-super-container-media .media-container[data-mid="${mid}"]`,
    `#column-right .search-super-container-media [data-mid="${mid}"]`,
    `#column-right .search-super-container-media .grid-item[data-mid="${mid}"]`,
  ];

  let container = null;
  for (const selector of selectors) {
    container = document.querySelector(selector);
    if (container) break;
  }
  if (!container) return false;

  const target =
    container.querySelector('.media-inner') ||
    container.querySelector('img.media-photo, canvas.media-photo, video.media-video, .media-video') ||
    container;

  tgClickTab(target);
  await delay(450);
  return !!target;
}

async function tgEnsureKSidebarMediaOpen() {
  if (tgIsKMediaSidebarActive()) return true;
  if (tgIsKMediaViewerOpen()) return false;

  if (tgIsKSidebarProfileOpen() || tgHasKSearchSuper()) {
    await delay(200);
    if (await tgClickKMediaStatSubtitle()) return true;
    return tgActivateKMediaTab();
  }

  if (!(await tgOpenKChatSidebar())) return false;

  await delay(500);

  const tabsReadyStart = Date.now();
  while (Date.now() - tabsReadyStart < 5000) {
    if (tgGetKTabsMenu() && tgGetKTabsContainer()) break;
    await delay(120);
  }

  await delay(300);

  if (await tgClickKMediaStatSubtitle()) return true;

  return tgActivateKMediaTab();
}

async function tgActivateKMediaTab() {
  if (tgIsKMediaSidebarActive()) return true;
  if (tgIsKMediaViewerOpen()) return false;

  if (await tgClickKMediaStatSubtitle()) return true;

  const labelTab = tgFindKMediaTabByLabel();
  if (labelTab) {
    tgClickTab(labelTab);
    await delay(500);
    if (tgIsKMediaSidebarActive()) return true;
  }

  const indexTab = tgFindKMediaTabByPanelIndex();
  if (indexTab && indexTab !== labelTab) {
    tgClickTab(indexTab);
    await delay(500);
    if (tgIsKMediaSidebarActive()) return true;
  }

  const tabsMenu = tgGetKTabsMenu();
  if (tabsMenu) {
    const tabs = [...tabsMenu.querySelectorAll('.menu-horizontal-div-item')].filter((t) => !t.classList.contains('hide'));
    for (const tab of tabs) {
      const label = tgGetKTabLabel(tab);
      if (tgIsKNonMediaTabLabel(label)) continue;
      if (!tgIsKMediaTabLabel(label)) continue;
      tgClickTab(tab);
      await delay(500);
      if (tgIsKMediaSidebarActive()) return true;
    }
  }

  return tgIsKMediaSidebarActive();
}

const TG_A_NON_MEDIA_TAB_LABELS = new Set([
  'Gifts', 'Gift', '礼物', '禮物', 'GIF', 'GIFs', 'Files', '文件', '檔案', 'Links', '链接', '連結',
  'Members', '成员', '成員', 'Music', '音乐', '音樂', 'Voice', '语音', '語音', 'Posts', 'Stories',
  'Similar Channels',
]);

const TG_A_PROFILE_HEADER_LABELS = new Set([
  'Channel Info', 'Group Info', 'User Info', 'Profile',
  '频道信息', '群组信息', '群組信息', '用户信息', '用戶信息',
]);

function tgIsAProfileHeaderLabel(text) {
  const normalized = tgNormalizeTabLabel(text);
  if (!normalized) return false;
  if (TG_A_PROFILE_HEADER_LABELS.has(normalized)) return true;
  return /(channel|group|user)\s*info/i.test(normalized) || /信息|資訊/.test(normalized);
}

function tgIsANonMediaTabLabel(text) {
  const normalized = tgNormalizeTabLabel(text);
  if (!normalized) return false;
  if (tgIsAProfileHeaderLabel(normalized)) return false;
  if (TG_A_NON_MEDIA_TAB_LABELS.has(normalized)) return true;
  if (/^gift(s)?$/i.test(normalized)) return true;
  if (/^gif(s)?$/i.test(normalized)) return true;
  return false;
}

function tgIsAMediaTabLabel(text) {
  const normalized = tgNormalizeTabLabel(text);
  if (!normalized) return false;
  if (normalized === 'Media' || /^media\b/i.test(normalized)) return true;
  return /媒体|媒體|共享媒体|共享媒體|медиа|メディア|미디어|Médias|Medien|Medios|Mídia|Multimedia/i.test(normalized);
}

function tgIsARightColumnOpen() {
  const main = document.getElementById('Main');
  if (main?.classList.contains('right-column-open') || main?.classList.contains('right-column-shown')) {
    return true;
  }
  const mediaHint = document.querySelector(
    '#RightColumn .Media.scroll-item, #RightColumn [id^="shared-mediamessage-"], #RightColumn .shared-media-tabs, #RightColumn .shared-media',
  );
  if (mediaHint) {
    const mediaRect = mediaHint.getBoundingClientRect();
    if (mediaRect.width > 8 && mediaRect.height > 8 && mediaRect.left < window.innerWidth - 4 && mediaRect.right > 4) {
      return true;
    }
  }
  const wrapper = document.getElementById('RightColumn-wrapper');
  if (wrapper) {
    const wrapperStyle = getComputedStyle(wrapper);
    if (
      (wrapperStyle.visibility === 'hidden' || wrapperStyle.display === 'none') &&
      !document.querySelector('#RightColumn .Media, #RightColumn [id^="shared-mediamessage-"]')
    ) {
      return false;
    }
  }
  const rightColumn = document.querySelector('#RightColumn');
  if (!rightColumn) return false;
  const rect = rightColumn.getBoundingClientRect();
  if (rect.width < 8 || rect.height < 8) return false;
  return rect.left < window.innerWidth - 8 && rect.right > 8;
}

function tgIsASidebarProfileOpen() {
  if (!tgIsARightColumnOpen()) return false;
  const profile =
    document.querySelector('#RightColumn .Profile') ||
    document.querySelector('#RightColumn .shared-media') ||
    document.querySelector('#RightColumn .shared-media-tabs');
  return !!profile && tgIsElementVisible(profile);
}

function tgNormalizeAActiveTabText(text) {
  const value = tgNormalizeTabLabel(text);
  if (tgIsAMediaTabLabel(value)) return 'Media';
  return value;
}

function tgGetAActiveTabText() {
  const headerText = document.querySelector('#RightColumn .RightHeader .title')?.textContent?.trim() || '';
  if (tgIsAMediaTabLabel(headerText)) return 'Media';

  const roleTab = document.querySelector('#RightColumn [role="tab"][aria-selected="true"]');
  if (roleTab?.textContent?.trim()) return tgNormalizeAActiveTabText(roleTab.textContent);

  const legacyActiveTab = document.querySelector('#RightColumn .shared-media .TabList .Tab--active .Tab_inner');
  if (legacyActiveTab?.textContent?.trim()) return tgNormalizeAActiveTabText(legacyActiveTab.textContent);

  const tabList = document.querySelector('#RightColumn .shared-media-tabs .TabList');
  const activeMask = tabList?.querySelector('[aria-hidden="true"]');
  const tabItems = [...(tabList?.children || [])].filter((element) => element !== activeMask && element.textContent?.trim());

  if (tabList && activeMask && tabItems.length > 0) {
    const tabListWidth = tabList.getBoundingClientRect().width;
    const clipPath = getComputedStyle(activeMask).clipPath || activeMask.style.clipPath;
    const insetMatch = clipPath?.match(/^inset\((.*)\)$/);

    if (tabListWidth > 0 && insetMatch) {
      const insetValues = insetMatch[1].split(/\s+round\s+/)[0].trim().split(/\s+/);
      if (insetValues.length >= 4) {
        const toPixels = (value) => {
          if (value.endsWith('%')) return (parseFloat(value) / 100) * tabListWidth;
          if (value.endsWith('rem')) {
            const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
            return parseFloat(value) * rootFontSize;
          }
          return parseFloat(value) || 0;
        };
        const rightInset = toPixels(insetValues[1]);
        const leftInset = toPixels(insetValues[3]);
        const activeCenter = leftInset + Math.max(0, tabListWidth - leftInset - rightInset) / 2;
        const tabListLeft = tabList.getBoundingClientRect().left;
        const activeTab = tabItems.find((tab) => {
          const rect = tab.getBoundingClientRect();
          const left = rect.left - tabListLeft;
          const right = rect.right - tabListLeft;
          return activeCenter >= left && activeCenter <= right;
        });
        if (activeTab?.textContent?.trim()) {
          return tgNormalizeAActiveTabText(activeTab.textContent);
        }
      }
    }
  }

  return tgNormalizeAActiveTabText(headerText);
}

function tgGetAVisibleMediaGridCount() {
  return document.querySelectorAll(
    '#RightColumn .Media.scroll-item, #RightColumn [id^="shared-mediamessage-"], #RightColumn .shared-media-transition .Transition_slide-active .Media',
  ).length;
}

function tgIsASidebarMediaActive() {
  if (!tgIsARightColumnOpen()) return false;
  const gridCount = tgGetAVisibleMediaGridCount();
  if (gridCount > 0) {
    const activeTab = tgGetAActiveTabText();
    if (tgIsANonMediaTabLabel(activeTab)) return false;
    return true;
  }
  if (!tgIsASidebarProfileOpen()) return false;
  const activeTab = tgGetAActiveTabText();
  if (tgIsAMediaTabLabel(activeTab)) return true;
  if (tgIsANonMediaTabLabel(activeTab)) return false;
  return false;
}

function tgFindAMediaTab() {
  const rightColumn = document.querySelector('#RightColumn');
  if (!rightColumn) return null;
  const tabList = rightColumn.querySelector('.shared-media-tabs .TabList, .shared-media .TabList');
  if (tabList) {
    const activeMask = tabList.querySelector('[aria-hidden="true"]');
    const tabItems = [...tabList.children].filter((element) => element !== activeMask && element.textContent?.trim());
    for (const tab of tabItems) {
      const text = tab.textContent?.trim() || '';
      if (tgIsANonMediaTabLabel(text)) continue;
      if (tgIsAMediaTabLabel(text)) return tab;
    }
  }
  for (const el of rightColumn.querySelectorAll('[role="tab"], .Tab, .TabList > *')) {
    const text = el.textContent?.trim() || '';
    if (!text || tgIsANonMediaTabLabel(text)) continue;
    if (tgIsAMediaTabLabel(text)) return el;
  }
  return null;
}

function tgDispatchMouseClick(clickTarget, longPressSafe) {
  if (!clickTarget) return;
  const rect = clickTarget.getBoundingClientRect();
  const clientX = rect.left + Math.max(1, rect.width / 2);
  const clientY = rect.top + Math.max(1, rect.height / 2);
  const pointerInit = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX,
    clientY,
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
    button: 0,
    buttons: 1,
  };
  const mouseDownInit = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX,
    clientY,
    button: 0,
    buttons: 1,
  };
  const mouseUpInit = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX,
    clientY,
    button: 0,
    buttons: 0,
  };
  clickTarget.dispatchEvent(new PointerEvent('pointerdown', pointerInit));
  clickTarget.dispatchEvent(new MouseEvent('mousedown', mouseDownInit));
  clickTarget.dispatchEvent(new PointerEvent('pointerup', { ...pointerInit, buttons: 0 }));
  clickTarget.dispatchEvent(new MouseEvent('mouseup', mouseUpInit));
  clickTarget.dispatchEvent(new MouseEvent('click', mouseUpInit));
  if (!longPressSafe && typeof clickTarget.click === 'function') clickTarget.click();
}

async function tgOpenAChatSidebar(maxWait = 2800) {
  if (tgIsASidebarProfileOpen()) return true;

  const openTargets = [
    document.querySelector('.MiddleHeader .chat-info-wrapper'),
    document.querySelector('.MiddleHeader .ChatInfo'),
    document.querySelector('.MiddleHeader .chat-info'),
    document.querySelector('.MiddleHeader .ChatInfo .Avatar'),
    document.querySelector('.MiddleHeader .ChatInfo .fullName'),
    document.querySelector('.MiddleHeader .fullName'),
    document.querySelector('#MiddleColumn .MiddleHeader .chat-info-wrapper'),
  ].filter(Boolean);

  // 去重
  const uniqueTargets = [];
  const seen = new Set();
  for (const target of openTargets) {
    if (seen.has(target)) continue;
    seen.add(target);
    uniqueTargets.push(target);
  }

  if (!uniqueTargets.length) return false;

  for (const target of uniqueTargets) {
    try {
      document.activeElement?.blur?.();
    } catch (error) {
      // ignore
    }
    const longPressHost = target.closest?.('.chat-info-wrapper') || (target.classList?.contains('chat-info-wrapper') ? target : null);
    const clickTarget = longPressHost || target;
    tgDispatchMouseClick(clickTarget, true);
    await delay(50);

    const start = Date.now();
    while (Date.now() - start < maxWait) {
      if (tgIsASidebarProfileOpen()) return true;
      await delay(100);
    }
  }

  return tgIsASidebarProfileOpen();
}

async function tgActivateAMediaTab() {
  if (tgIsASidebarMediaActive()) return true;

  const scrollable =
    document.querySelector('#RightColumn .Profile.custom-scroll') ||
    document.querySelector('#RightColumn .Profile') ||
    document.querySelector('#RightColumn .custom-scroll');
  const tabs =
    document.querySelector('#RightColumn .shared-media-tabs') ||
    document.querySelector('#RightColumn .TabList');
  if (scrollable && tabs && typeof tabs.scrollIntoView === 'function') {
    tabs.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    await delay(200);
  }

  const mediaTab = tgFindAMediaTab();
  if (mediaTab) {
    tgClickTab(mediaTab);
    await delay(500);
    if (tgIsASidebarMediaActive()) return true;
    const inner = mediaTab.querySelector('.Tab_inner');
    if (inner) {
      tgDispatchMouseClick(inner, false);
      await delay(500);
      if (tgIsASidebarMediaActive()) return true;
    }
  }
  return tgIsASidebarMediaActive();
}

async function tgEnsureASidebarMediaOpen() {
  if (tgGetAVisibleMediaGridCount() > 0 || tgIsASidebarMediaActive()) return true;

  if (tgIsASidebarProfileOpen()) {
    await delay(200);
    for (let attempt = 0; attempt < 4; attempt++) {
      if (await tgActivateAMediaTab()) return true;
      if (tgGetAVisibleMediaGridCount() > 0) return true;
      await delay(350);
    }
    return tgGetAVisibleMediaGridCount() > 0 || tgIsASidebarMediaActive();
  }

  if (!(await tgOpenAChatSidebar())) return false;
  await delay(400);
  for (let attempt = 0; attempt < 5; attempt++) {
    if (await tgActivateAMediaTab()) return true;
    if (tgGetAVisibleMediaGridCount() > 0) return true;
    await delay(350);
  }
  return tgGetAVisibleMediaGridCount() > 0 || tgIsASidebarMediaActive();
}

function tgIsKMediaViewerOpen() {
  return [...document.querySelectorAll('div.media-viewer-whole.active, div.media-viewer-whole.is-visible')].some((viewer) => {
    if (!viewer?.isConnected) return false;
    if (!tgIsElementVisible(viewer)) return false;
    const rect = viewer.getBoundingClientRect();
    return rect.width > 80 && rect.height > 80;
  });
}

function tgHasKRightSidebarStructure() {
  if (!tgIsKRightColumnVisible()) return false;
  return !!document.querySelector('#column-right .search-super, #column-right .profile-container');
}

let tgKRouteGuardDepth = 0;
let tgKSavedHref = '';

function tgIsLeftSearchInput(el) {
  if (!el || typeof el.closest !== 'function') return false;
  if (!el.closest('#column-left')) return false;
  return (
    el.matches?.('input, textarea, [contenteditable="true"]') ||
    !!el.closest?.('.input-search, .input-field-input, .input-search-input')
  );
}

function tgInstallExportFocusHookOnce() {
  if (window.__tgKExportFocusHookInstalled) return;
  window.__tgKExportFocusHookInstalled = true;
  const origFocus = HTMLElement.prototype.focus;
  HTMLElement.prototype.focus = function (...args) {
    if (tgKRouteGuardDepth > 0 && tgIsLeftSearchInput(this)) {
      return;
    }
    return origFocus.apply(this, args);
  };
}

function tgHasChatHash(href) {
  if (!href) return false;
  const hash = href.includes('#') ? href.slice(href.indexOf('#')) : '';
  return hash.startsWith('#@') || /^#-?\d/.test(hash);
}

function tgIsChatRouteLost(savedHref) {
  if (!tgHasChatHash(savedHref)) return false;
  const savedHash = savedHref.slice(savedHref.indexOf('#'));
  const curHash = location.hash;
  if (!curHash || curHash === '#') return true;
  if (curHash === savedHash) return false;
  const base = (u) => u.split('#')[0];
  if (base(location.href) !== base(savedHref)) return false;
  return tgHasChatHash(savedHref) && !tgHasChatHash(location.href);
}

function tgRestoreChatRoute() {
  if (!tgKSavedHref || tgKRouteGuardDepth <= 0) return;
  if (!tgIsChatRouteLost(tgKSavedHref)) return;
  try {
    history.replaceState(history.state, '', tgKSavedHref);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } catch (error) {
    const hash = tgKSavedHref.includes('#') ? tgKSavedHref.slice(tgKSavedHref.indexOf('#')) : '';
    if (hash) location.hash = hash;
  }
}

function tgDefocusLeftSearchOnly() {
  document.querySelectorAll('#column-left input, #column-left textarea').forEach((el) => {
    try {
      el.blur();
    } catch (error) {
      // ignore
    }
  });
}

function tgStartKRouteGuard(savedHref) {
  tgKRouteGuardDepth += 1;
  if (savedHref) tgKSavedHref = savedHref;
  if (tgKRouteGuardDepth > 1) return;

  tgInstallExportFocusHookOnce();

  const onFocusIn = (event) => {
    if (tgKRouteGuardDepth <= 0) return;
    if (tgIsLeftSearchInput(event.target)) {
      queueMicrotask(() => tgDefocusLeftSearchOnly());
    }
  };

  const onVisibilityChange = () => {
    if (tgKRouteGuardDepth <= 0) return;
    tgDefocusLeftSearchOnly();
    tgRestoreChatRoute();
  };

  const onHashChange = () => tgRestoreChatRoute();

  const intervalId = setInterval(() => {
    tgDefocusLeftSearchOnly();
    tgRestoreChatRoute();
  }, 350);

  window.__tgKRouteGuardHandlers = { onFocusIn, onVisibilityChange, onHashChange, intervalId };
  document.addEventListener('focusin', onFocusIn, true);
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('hashchange', onHashChange);
}

function tgStopKRouteGuard() {
  tgKRouteGuardDepth = Math.max(0, tgKRouteGuardDepth - 1);
  if (tgKRouteGuardDepth > 0) return;
  tgKSavedHref = '';
  const handlers = window.__tgKRouteGuardHandlers;
  if (handlers) {
    document.removeEventListener('focusin', handlers.onFocusIn, true);
    document.removeEventListener('visibilitychange', handlers.onVisibilityChange);
    window.removeEventListener('hashchange', handlers.onHashChange);
    clearInterval(handlers.intervalId);
    window.__tgKRouteGuardHandlers = null;
  }
}

window.addEventListener('message', (event) => {
  if (event.source !== window) return;

  if (event.data?.type === 'TG_K_EXPORT_ROUTE_GUARD') {
    if (event.data.active) {
      tgStartKRouteGuard(event.data.href || location.href);
    } else {
      tgStopKRouteGuard();
    }
    return;
  }

  if (event.data?.type === 'TG_ENSURE_K_SIDEBAR_MEDIA') {
    const requestId = event.data.requestId;
    Promise.resolve(tgEnsureKSidebarMediaOpen())
      .then((success) => {
        window.postMessage({ type: 'TG_ENSURE_K_SIDEBAR_MEDIA_RESULT', requestId, success: !!success }, '*');
      })
      .catch(() => {
        window.postMessage({ type: 'TG_ENSURE_K_SIDEBAR_MEDIA_RESULT', requestId, success: false }, '*');
      });
    return;
  }

  if (event.data?.type === 'TG_ENSURE_A_SIDEBAR_MEDIA') {
    const requestId = event.data.requestId;
    Promise.resolve(tgEnsureASidebarMediaOpen())
      .then((success) => {
        window.postMessage({ type: 'TG_ENSURE_A_SIDEBAR_MEDIA_RESULT', requestId, success: !!success }, '*');
      })
      .catch(() => {
        window.postMessage({ type: 'TG_ENSURE_A_SIDEBAR_MEDIA_RESULT', requestId, success: false }, '*');
      });
    return;
  }

  if (event.data?.type === 'TG_CLOSE_K_MEDIA_VIEWER') {
    const requestId = event.data.requestId;
    Promise.resolve(tgCloseKMediaViewer())
      .then((success) => {
        window.postMessage({ type: 'TG_CLOSE_K_MEDIA_VIEWER_RESULT', requestId, success: !!success }, '*');
      })
      .catch(() => {
        window.postMessage({ type: 'TG_CLOSE_K_MEDIA_VIEWER_RESULT', requestId, success: false }, '*');
      });
    return;
  }

  if (event.data?.type === 'TG_CLICK_K_SIDEBAR_MEDIA') {
    const requestId = event.data.requestId;
    Promise.resolve(tgClickKSidebarMediaByMid(event.data.mid))
      .then((success) => {
        window.postMessage({ type: 'TG_CLICK_K_SIDEBAR_MEDIA_RESULT', requestId, success: !!success }, '*');
      })
      .catch(() => {
        window.postMessage({ type: 'TG_CLICK_K_SIDEBAR_MEDIA_RESULT', requestId, success: false }, '*');
      });
    return;
  }

  if (event.data?.type !== 'TG_ENSURE_K_MEDIA_TAB') return;
  const requestId = event.data.requestId;
  Promise.resolve(tgActivateKMediaTab())
    .then((success) => {
      window.postMessage({ type: 'TG_ENSURE_K_MEDIA_TAB_RESULT', requestId, success: !!success }, '*');
    })
    .catch(() => {
      window.postMessage({ type: 'TG_ENSURE_K_MEDIA_TAB_RESULT', requestId, success: false }, '*');
    });
});
})();
