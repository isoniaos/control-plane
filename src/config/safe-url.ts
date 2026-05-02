const SENSITIVE_QUERY_KEY_PATTERN = /(api|key|secret|token|password|pass)/i;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export function maskUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    if (url.username) {
      url.username = '***';
    }
    if (url.password) {
      url.password = '***';
    }
    for (const key of [...url.searchParams.keys()]) {
      if (SENSITIVE_QUERY_KEY_PATTERN.test(key)) {
        url.searchParams.set(key, '***');
      }
    }
    if (!LOCAL_HOSTS.has(url.hostname)) {
      maskLikelyPathSecret(url);
    }
    return url.toString();
  } catch {
    return rawUrl;
  }
}

function maskLikelyPathSecret(url: URL): void {
  const segments = url.pathname.split('/');
  const lastIndex = segments.length - 1;
  const lastSegment = segments[lastIndex];
  if (lastSegment && lastSegment.length >= 16) {
    segments[lastIndex] = '***';
    url.pathname = segments.join('/');
  }
}
