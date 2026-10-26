/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { buildMindmapTree, NODE_HEIGHT, NODE_WIDTH } from "./tree";

export type MindmapCard = {
  id: string;
  parent_id: string | null;
  name: string;
  identifier: string;
  stateName?: string;
  stateColor?: string;
};

type Props = {
  cards: MindmapCard[];
  projectName: string;
  label: string;
  detachedLabel: string;
  onOpen: (issueId: string) => void;
};

export function MindmapCanvas({ cards, projectName, label, detachedLabel, onOpen }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const tree = buildMindmapTree(cards, collapsed);
  const nodesById = new Map(tree.nodes.map((node) => [node.id, node]));
  const cardsById = new Map(cards.map((card) => [card.id, card]));

  function toggle(id: string) {
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <section aria-label={label} className="min-h-0 flex-1 overflow-auto">
      {tree.detachedCount > 0 && (
        <p role="status" className="sticky left-0 px-3 pt-3 text-12 text-secondary">
          {detachedLabel}
        </p>
      )}
      <div className="relative" style={{ width: tree.width, height: tree.height }}>
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
          const name = card?.name ?? projectName;
          return (
            <div
              key={node.id}
              className="shadow-sm absolute flex items-center rounded-lg border border-subtle bg-layer-1"
              style={{ left: node.x, top: node.y, width: NODE_WIDTH, height: NODE_HEIGHT }}
            >
              {card ? (
                <button
                  type="button"
                  onClick={() => onOpen(card.id)}
                  className="flex h-full min-w-0 flex-1 flex-col items-start justify-center gap-1 rounded-lg px-3 text-left hover:bg-layer-transparent-hover focus-visible:outline-2 focus-visible:outline-offset-2"
                  title={`${card.identifier} ${card.name}`}
                >
                  <span className="flex w-full items-center gap-2 text-11 text-secondary">
                    <span className="shrink-0">{card.identifier}</span>
                    {card.stateName && (
                      <span className="flex min-w-0 items-center gap-1 truncate">
                        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: card.stateColor }} />
                        <span className="truncate">{card.stateName}</span>
                      </span>
                    )}
                    {node.detached && <span title={detachedLabel}>!</span>}
                  </span>
                  <span className="line-clamp-2 w-full text-13 break-words text-primary">{name}</span>
                </button>
              ) : (
                <span className="line-clamp-3 min-w-0 flex-1 px-3 text-14 font-semibold break-words text-primary">
                  {name}
                </span>
              )}
              {node.childIds.length > 0 && (
                <button
                  type="button"
                  aria-label={name}
                  aria-expanded={!collapsed.has(node.id)}
                  onClick={() => toggle(node.id)}
                  className="mr-2 grid size-7 shrink-0 place-items-center rounded border border-subtle text-secondary hover:bg-layer-transparent-hover"
                >
                  {collapsed.has(node.id) ? "+" : "-"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
