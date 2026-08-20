/** Viewport-relative box used to place the ⋮ menu panel. */
export interface ActionMenuBox {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
}

export interface ActionMenuViewport {
  width: number;
  height: number;
}

export interface ActionMenuPlacement {
  top: number;
  left: number;
  openUpward: boolean;
}

/**
 * Pin the action panel to the ⋮ trigger in viewport coordinates.
 * Right-aligns with the trigger, flips above when there is no room below,
 * and clamps so the panel stays on screen on narrow layouts.
 */
export function computeActionMenuPosition(
  trigger: ActionMenuBox,
  panel: { width: number; height: number },
  viewport: ActionMenuViewport,
  options?: { preferUp?: boolean; gap?: number; margin?: number },
): ActionMenuPlacement {
  const gap = options?.gap ?? 4;
  const margin = options?.margin ?? 8;
  const panelWidth = Math.max(1, panel.width);
  const panelHeight = Math.max(1, panel.height);

  const spaceBelow = viewport.height - trigger.bottom - margin;
  const spaceAbove = trigger.top - margin;
  const openUpward =
    Boolean(options?.preferUp) ||
    (panelHeight > spaceBelow && spaceAbove > spaceBelow);

  let top = openUpward ? trigger.top - panelHeight - gap : trigger.bottom + gap;
  let left = trigger.right - panelWidth;

  const maxLeft = viewport.width - panelWidth - margin;
  left = Math.min(Math.max(left, margin), Math.max(margin, maxLeft));

  const maxTop = viewport.height - panelHeight - margin;
  top = Math.min(Math.max(top, margin), Math.max(margin, maxTop));

  return { top, left, openUpward };
}
