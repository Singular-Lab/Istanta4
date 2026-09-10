const ALLOWED_TAGS = new Set([
  "a",
  "b",
  "blockquote",
  "br",
  "code",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "li",
  "ol",
  "p",
  "pre",
  "span",
  "strong",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "u",
  "ul",
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "title"]),
};

const SAFE_URL_PATTERN = /^(https?:|mailto:|tel:|\/|#)/i;

function sanitizeElementAttributes(element: Element) {
  const tagName = element.tagName.toLowerCase();
  const allowed = ALLOWED_ATTRS[tagName] ?? new Set<string>();

  Array.from(element.attributes).forEach((attribute) => {
    const attributeName = attribute.name.toLowerCase();
    const attributeValue = attribute.value.trim();

    if (attributeName.startsWith("on")) {
      element.removeAttribute(attribute.name);
      return;
    }

    if (!allowed.has(attributeName)) {
      element.removeAttribute(attribute.name);
      return;
    }

    if (
      tagName === "a" &&
      attributeName === "href" &&
      attributeValue &&
      !SAFE_URL_PATTERN.test(attributeValue)
    ) {
      element.removeAttribute(attribute.name);
    }
  });

  if (tagName === "a" && element.getAttribute("href")) {
    element.setAttribute("target", "_blank");
    element.setAttribute("rel", "noopener noreferrer");
  }
}

function sanitizeNode(node: Node) {
  if (node.nodeType === Node.COMMENT_NODE) {
    node.parentNode?.removeChild(node);
    return;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return;
  }

  const element = node as Element;
  const tagName = element.tagName.toLowerCase();

  if (!ALLOWED_TAGS.has(tagName)) {
    const parent = element.parentNode;
    if (!parent) return;

    const children = Array.from(element.childNodes);
    while (element.firstChild) {
      parent.insertBefore(element.firstChild, element);
    }
    parent.removeChild(element);
    children.forEach(sanitizeNode);
    return;
  }

  sanitizeElementAttributes(element);

  Array.from(element.childNodes).forEach(sanitizeNode);
}

export function sanitizeHtml(html?: string | null): string {
  if (!html) return "";
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return html;
  }

  const documentParser = new DOMParser();
  const parsed = documentParser.parseFromString(html, "text/html");
  Array.from(parsed.body.childNodes).forEach(sanitizeNode);
  return parsed.body.innerHTML;
}

export function stripHtml(html?: string | null): string {
  if (!html) return "";
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  const documentParser = new DOMParser();
  const parsed = documentParser.parseFromString(html, "text/html");
  return (parsed.body.textContent || "").replace(/\s+/g, " ").trim();
}
