import { toJpeg } from "html-to-image";

const MAX_THUMBNAIL_BYTES = 150_000;

// Best-effort, low-cost capture of whatever's currently visible on the canvas —
// not a fit-to-content render (that would mean silently moving the user's viewport
// mid-edit). In practice the current view is usually representative, since the user
// is looking at what they just edited.
export async function captureThumbnail(): Promise<string | null> {
  const el = document.querySelector<HTMLElement>(".react-flow");
  if (!el) return null;

  try {
    const dataUrl = await toJpeg(el, {
      quality: 0.4,
      pixelRatio: 0.5,
      backgroundColor: "#ffffff",
      filter: (node) => {
        if (!(node instanceof HTMLElement)) return true;
        return !(
          node.classList.contains("react-flow__controls") ||
          node.classList.contains("react-flow__minimap") ||
          node.classList.contains("react-flow__panel")
        );
      },
    });
    return dataUrl.length <= MAX_THUMBNAIL_BYTES ? dataUrl : null;
  } catch {
    return null;
  }
}
