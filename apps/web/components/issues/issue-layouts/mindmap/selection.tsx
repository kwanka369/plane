/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useSearchParams } from "react-router";
import { Button } from "@makeplane/propel/elements/button";
import { useTranslation } from "@plane/i18n";
import { MINDMAP_QUERY_PARAM } from "./query";

export function useMindmapSelection(enabled = true) {
  const [searchParams, setSearchParams] = useSearchParams();
  const isMindmap = enabled && searchParams.get(MINDMAP_QUERY_PARAM) === "1";
  function setMindmap(active: boolean) {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      if (active) next.set(MINDMAP_QUERY_PARAM, "1");
      else next.delete(MINDMAP_QUERY_PARAM);
      return next;
    });
  }
  return { isMindmap, setMindmap };
}

export function MindmapToggle() {
  const { t } = useTranslation();
  const { isMindmap, setMindmap } = useMindmapSelection();
  return (
    <Button
      variant={isMindmap ? "primary" : "secondary"}
      size="sm"
      stretch="auto"
      aria-pressed={isMindmap}
      onClick={() => setMindmap(!isMindmap)}
    >
      {t("issue.mindmap.label")}
    </Button>
  );
}
