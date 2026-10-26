/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useTranslation } from "@plane/i18n";
import type { MindmapCard } from "./canvas";
import type { MindmapNode } from "./tree";
import { NODE_HEIGHT, NODE_WIDTH } from "./tree";

type Props = {
  node: MindmapNode;
  card?: MindmapCard;
  linkedParent?: MindmapCard;
  name: string;
  expanded: boolean;
  isPartial: boolean;
  detachedLabel: string;
  onOpen: (id: string) => void;
  onToggle: (id: string) => void;
};

export function MindmapNodeCard({
  node,
  card,
  linkedParent,
  name,
  expanded,
  isPartial,
  detachedLabel,
  onOpen,
  onToggle,
}: Props) {
  const { t } = useTranslation();
  const modules = card?.modules ?? [];
  const labels = card?.labels ?? [];
  return (
    <div
      className="shadow-sm absolute flex items-center rounded-lg border border-subtle bg-layer-1"
      style={{ left: node.x, top: node.y, width: NODE_WIDTH, height: NODE_HEIGHT }}
    >
      {card ? (
        <div className="flex h-full min-w-0 flex-1 flex-col">
          <button
            type="button"
            onClick={() => onOpen(card.id)}
            className="flex min-h-0 min-w-0 flex-1 flex-col items-start justify-center gap-1 rounded-lg px-3 text-left hover:bg-layer-transparent-hover focus-visible:outline-2 focus-visible:outline-offset-2"
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
            {modules.length > 0 && (
              <span
                className="flex w-full gap-1 overflow-hidden"
                title={`${t("common.module")}: ${modules.map((module) => module.name).join(", ")}`}
              >
                {modules.slice(0, 2).map((module) => (
                  <span key={module.id} className="max-w-36 truncate rounded border border-subtle px-1 text-11">
                    {module.name}
                  </span>
                ))}
                {modules.length > 2 && <span className="text-11">+{modules.length - 2}</span>}
              </span>
            )}
            {labels.length > 0 && (
              <span
                className="flex w-full gap-1 overflow-hidden"
                title={`${t("labels")}: ${labels.map((tag) => tag.name).join(", ")}`}
              >
                {labels.slice(0, 2).map((tag) => (
                  <span
                    key={tag.id}
                    className="flex max-w-36 items-center gap-1 rounded border border-subtle px-1 text-11"
                  >
                    <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: tag.color }} />
                    <span className="truncate">{tag.name}</span>
                  </span>
                ))}
                {labels.length > 2 && <span className="text-11">+{labels.length - 2}</span>}
              </span>
            )}
          </button>
          {linkedParent && (
            <button
              type="button"
              className="mx-3 mb-2 truncate text-left text-11 text-secondary underline hover:text-primary"
              title={`${linkedParent.identifier} ${linkedParent.name}`}
              onClick={() => onOpen(linkedParent.id)}
            >
              {t("issue.mindmap.parent_link", { identifier: linkedParent.identifier })}
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onToggle(node.id)}
          disabled={!node.childIds.length}
          aria-label={name}
          aria-expanded={node.childIds.length ? expanded : undefined}
          className="flex h-full min-w-0 flex-1 flex-col justify-center gap-2 rounded-lg px-3 text-left hover:bg-layer-transparent-hover"
        >
          <span className="flex w-full items-center gap-2">
            <span className="line-clamp-2 min-w-0 flex-1 text-14 font-semibold break-words text-primary">{name}</span>
            {node.childIds.length > 0 && (
              <span aria-hidden="true" className="shrink-0 text-secondary">
                {expanded ? "-" : "+"}
              </span>
            )}
          </span>
          {node.progress && (
            <>
              <span className="text-12 text-primary">
                {t("issue.mindmap.progress", { done: node.progress.done, total: node.progress.total })}
              </span>
              <progress
                aria-label={name}
                max={Math.max(1, node.progress.total)}
                value={node.progress.done}
                className="h-1 w-full"
              />
              <span className="text-11 text-secondary">
                {t("issue.mindmap.progress_detail", {
                  remaining: node.progress.remaining,
                  cancelled: node.progress.cancelled,
                  unknown: node.progress.unknown,
                })}
              </span>
              <span className="text-11 text-secondary" title={isPartial ? t("issue.mindmap.partial") : undefined}>
                {t("issue.mindmap.loaded_only")}
                {isPartial ? " *" : ""}
              </span>
            </>
          )}
        </button>
      )}
      {card && node.childIds.length > 0 && (
        <button
          type="button"
          aria-label={name}
          aria-expanded={expanded}
          onClick={() => onToggle(node.id)}
          className="mr-2 grid size-7 shrink-0 place-items-center rounded border border-subtle text-secondary hover:bg-layer-transparent-hover"
        >
          {expanded ? "-" : "+"}
        </button>
      )}
    </div>
  );
}
