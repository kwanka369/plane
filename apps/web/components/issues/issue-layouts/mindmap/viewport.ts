/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 2;

export function clampZoom(zoom: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

export function fitZoom(width: number, height: number, viewportWidth: number, viewportHeight: number) {
  return clampZoom(Math.min(1, Math.max(1, viewportWidth - 32) / width, Math.max(1, viewportHeight - 32) / height));
}

export function zoomScroll(scroll: number, anchor: number, oldZoom: number, newZoom: number) {
  return ((scroll + anchor) / oldZoom) * newZoom - anchor;
}
