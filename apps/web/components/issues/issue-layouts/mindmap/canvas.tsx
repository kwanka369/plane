/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "@plane/i18n";
import { buildMindmapTree, NODE_HEIGHT, NODE_WIDTH, PROJECT_ROOT_ID } from "./tree";
import type { MindmapIssue } from "./tree";
import { clampZoom, fitZoom, zoomScroll } from "./viewport";
import { MindmapNodeCard } from "./node-card";

export type MindmapCard = MindmapIssue & {
  name: string;
  identifier: string;
  stateName?: string;
  stateColor?: string;
  modules?: { id: string; name: string }[];
  labels?: { id: string; name: string; color?: string }[];
};

type Props = {
  cards: MindmapCard[];
  modules: { id: string; name: string }[];
  isPartial: boolean;
  projectName: string;
  label: string;
  detachedLabel: string;
  onOpen: (issueId: string) => void;
};

export function MindmapCanvas({ cards, modules, isPartial, projectName, label, detachedLabel, onOpen }: Props) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<Set<string>>(new Set([PROJECT_ROOT_ID]));
  const [groupByModule, setGroupByModule] = useState(true);
  const [zoom, setZoom] = useState(1);
  const viewport = useRef<HTMLDivElement>(null);
  const pendingScroll = useRef<{ left: number; top: number } | null>(null);
  const autoFit = useRef(true);
  const pendingFocus = useRef<string | null>(null);
  const drag = useRef<{ id: number; x: number; y: number; left: number; top: number } | null>(null);
  const tree = buildMindmapTree(cards, new Set(), {
    groupByModule,
    moduleIds: modules.map((module) => module.id),
    expanded,
  });
  const nodesById = new Map(tree.nodes.map((node) => [node.id, node]));
  const cardsById = new Map(cards.map((card) => [card.id, card]));
  const moduleNames = new Map(modules.map((module) => [module.id, module.name]));
  for (const card of cards) {
    for (const module of card.modules ?? []) moduleNames.set(module.id, module.name);
  }

  useLayoutEffect(() => {
    if (!viewport.current || !pendingScroll.current) return;
    viewport.current.scrollLeft = pendingScroll.current.left;
    viewport.current.scrollTop = pendingScroll.current.top;
    pendingScroll.current = null;
  }, [zoom]);

  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    function fitOverview() {
      if (!autoFit.current || !element) return;
      element.scrollTo(0, 0);
      setZoom(fitZoom(tree.width, tree.height, element.clientWidth, element.clientHeight));
    }
    fitOverview();
    const observer = new ResizeObserver(fitOverview);
    observer.observe(element);
    return () => observer.disconnect();
  }, [tree.width, tree.height, groupByModule]);

  useLayoutEffect(() => {
    const element = viewport.current;
    const node = tree.nodes.find((candidate) => candidate.id === pendingFocus.current);
    if (!element || !node) return;
    element.scrollLeft = Math.max(0, node.x * zoom - element.clientWidth * 0.15);
    element.scrollTop = Math.max(0, (node.y + NODE_HEIGHT / 2) * zoom - element.clientHeight / 2);
    pendingFocus.current = null;
  }, [tree.nodes, zoom]);

  function changeZoom(nextZoom: number) {
    const element = viewport.current;
    if (!element) return;
    autoFit.current = false;
    const next = clampZoom(nextZoom);
    pendingScroll.current = {
      left: zoomScroll(element.scrollLeft, element.clientWidth / 2, zoom, next),
      top: zoomScroll(element.scrollTop, element.clientHeight / 2, zoom, next),
    };
    setZoom(next);
  }

  function fit() {
    const element = viewport.current;
    if (!element) return;
    autoFit.current = false;
    pendingScroll.current = { left: 0, top: 0 };
    element.scrollTo(0, 0);
    setZoom(fitZoom(tree.width, tree.height, element.clientWidth, element.clientHeight));
  }

  function toggle(id: string) {
    autoFit.current = false;
    pendingFocus.current = id;
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <section aria-label={label} className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-subtle px-3 py-2 text-12">
        <button
          type="button"
          aria-label={t("issue.mindmap.zoom_out")}
          disabled={zoom <= 0.05}
          onClick={() => changeZoom(zoom / 1.25)}
          className="rounded border border-subtle px-2 py-1 disabled:opacity-50"
        >
          -
        </button>
        <button type="button" onClick={() => changeZoom(1)} className="rounded border border-subtle px-2 py-1">
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          aria-label={t("issue.mindmap.zoom_in")}
          disabled={zoom >= 2}
          onClick={() => changeZoom(zoom * 1.25)}
          className="rounded border border-subtle px-2 py-1 disabled:opacity-50"
        >
          +
        </button>
        <button type="button" onClick={fit} className="rounded border border-subtle px-2 py-1">
          {t("issue.mindmap.fit")}
        </button>
        <label className="flex items-center gap-2">
          {t("common.group_by")}
          <select
            value={groupByModule ? "module" : "none"}
            className="rounded border border-subtle bg-layer-1 px-2 py-1"
            onChange={(event) => {
              const grouped = event.target.value === "module";
              autoFit.current = true;
              setGroupByModule(grouped);
              setExpanded(new Set([PROJECT_ROOT_ID]));
              viewport.current?.scrollTo(0, 0);
              setZoom(1);
            }}
          >
            <option value="none">{t("none")}</option>
            <option value="module">{t("common.module")}</option>
          </select>
        </label>
      </div>
      {tree.detachedCount > 0 && (
        <p role="status" className="px-3 pt-3 text-12 text-secondary">
          {detachedLabel}
        </p>
      )}
      <div
        ref={viewport}
        className="min-h-0 flex-1 cursor-grab overflow-auto overscroll-contain"
        onPointerDown={(event) => {
          if (
            event.button !== 0 ||
            event.pointerType === "touch" ||
            (event.target instanceof Element && event.target.closest("button"))
          )
            return;
          const element = event.currentTarget;
          autoFit.current = false;
          drag.current = {
            id: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            left: element.scrollLeft,
            top: element.scrollTop,
          };
          element.setPointerCapture(event.pointerId);
          element.style.cursor = "grabbing";
          event.preventDefault();
        }}
        onPointerMove={(event) => {
          const start = drag.current;
          if (!start || start.id !== event.pointerId) return;
          event.currentTarget.scrollLeft = start.left - (event.clientX - start.x);
          event.currentTarget.scrollTop = start.top - (event.clientY - start.y);
        }}
        onLostPointerCapture={(event) => {
          drag.current = null;
          event.currentTarget.style.cursor = "";
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
        }}
      >
        <div className="relative overflow-hidden" style={{ width: tree.width * zoom, height: tree.height * zoom }}>
          <div
            className="absolute top-0 left-0 origin-top-left"
            style={{ width: tree.width, height: tree.height, transform: `scale(${zoom})` }}
          >
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              width={tree.width}
              height={tree.height}
            >
              {tree.nodes.map((node) => {
                const parent = node.parentId ? nodesById.get(node.parentId) : undefined;
                if (!parent) return null;
                const x1 = parent.x + NODE_WIDTH;
                const y1 = parent.y + NODE_HEIGHT / 2;
                const y2 = node.y + NODE_HEIGHT / 2;
                const midpoint = (x1 + node.x) / 2;
                return (
                  <path
                    key={node.id}
                    d={`M ${x1} ${y1} C ${midpoint} ${y1}, ${midpoint} ${y2}, ${node.x} ${y2}`}
                    fill="none"
                    stroke="currentColor"
                    className="text-tertiary"
                    strokeWidth={1.5}
                    strokeDasharray={node.detached ? "4 4" : undefined}
                  />
                );
              })}
            </svg>
            {tree.nodes.map((node) => {
              const card = node.issueId ? cardsById.get(node.issueId) : undefined;
              const name =
                card?.name ??
                (node.groupKey === "none"
                  ? t("module.no_module")
                  : node.groupKey
                    ? (moduleNames.get(node.groupKey) ?? node.groupKey)
                    : projectName);
              const linkedParent = node.linkedParentId ? cardsById.get(node.linkedParentId) : undefined;
              return (
                <MindmapNodeCard
                  key={node.id}
                  node={node}
                  card={card}
                  linkedParent={linkedParent}
                  name={name}
                  expanded={expanded.has(node.id)}
                  isPartial={isPartial}
                  detachedLabel={detachedLabel}
                  onOpen={onOpen}
                  onToggle={toggle}
                />
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
