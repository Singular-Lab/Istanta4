function trimString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function ensureTrailingSlash(pathname: string): string {
  return pathname.endsWith("/") ? pathname : `${pathname}/`;
}

export function isHubServiceAbsoluteUrl(value?: string | null): boolean {
  if (!value) return false;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function normalizeHubServiceRedirectPage(value?: string | null, baseUrl?: string | null): string | undefined {
  const redirectPage = trimString(value);
  if (!redirectPage) return undefined;

  if (!isHubServiceAbsoluteUrl(baseUrl) || !isHubServiceAbsoluteUrl(redirectPage)) {
    return redirectPage;
  }

  try {
    const base = new URL(baseUrl!);
    const target = new URL(redirectPage);

    if (base.origin !== target.origin) {
      return redirectPage;
    }

    const basePath = ensureTrailingSlash(base.pathname || "/");

    if (basePath === "/") {
      return `${target.pathname}${target.search}${target.hash}` || "/";
    }

    if (!target.pathname.startsWith(basePath)) {
      return redirectPage;
    }

    const remainingPath = target.pathname.slice(basePath.length);
    const normalizedPath = remainingPath ? `/${remainingPath.replace(/^\/+/, "")}` : "/";
    return `${normalizedPath}${target.search}${target.hash}`;
  } catch {
    return redirectPage;
  }
}

export function cloneHubServiceMetaWithoutRedirect(meta?: Record<string, unknown> | null): Record<string, unknown> {
  const nextMeta = meta && typeof meta === "object" ? { ...meta } : {};
  delete nextMeta.route;
  delete nextMeta.redirect_page;
  return nextMeta;
}

export function extractHubServiceRedirectPage(
  meta?: Record<string, unknown> | null,
  baseUrl?: string | null
): { present: boolean; value?: string } {
  if (!meta || typeof meta !== "object") {
    return { present: false, value: undefined };
  }

  if (Object.prototype.hasOwnProperty.call(meta, "route")) {
    return {
      present: true,
      value: normalizeHubServiceRedirectPage(trimString(meta.route), baseUrl),
    };
  }

  if (Object.prototype.hasOwnProperty.call(meta, "redirect_page")) {
    return {
      present: true,
      value: normalizeHubServiceRedirectPage(trimString(meta.redirect_page), baseUrl),
    };
  }

  return { present: false, value: undefined };
}

export function readHubServiceRedirectPage(
  meta?: Record<string, unknown> | null,
  baseUrl?: string | null
): string | undefined {
  return extractHubServiceRedirectPage(meta, baseUrl).value;
}
