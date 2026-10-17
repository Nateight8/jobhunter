import DOMPurify from "dompurify";

let hooked = false;

// Job descriptions are third-party HTML, so always sanitize before rendering.
export function sanitizeHtml(html: string): string {
  if (typeof window === "undefined") return "";
  if (!hooked) {
    DOMPurify.addHook("afterSanitizeAttributes", (node) => {
      if (node.tagName === "A") {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer");
      }
    });
    hooked = true;
  }
  return DOMPurify.sanitize(html);
}
