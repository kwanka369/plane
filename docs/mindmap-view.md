# Project mind map preview

The experimental mind map is a read-only view of existing Plane work items,
available from the project work-item header on desktop and mobile. It does not
run the MindSpark server, use SQLite, or require a separate login or API token.

## Using the preview

In a development build containing this feature, open a project's work items and
select **Mind map (preview)**. Alternatively, append `?mindmap=1` to its work-item
list URL. The selection is held in the URL, not submitted as a new backend layout
value. Toggle the button again or select an existing layout to leave the preview.
Other URL parameters are preserved.

- The project is a virtual root. Each card is an existing work item.
- Parent-child links come from `parent_id`. Work items without a parent appear
  under the project root.
- Cards show the identifier, title, and state from Plane stores. Selecting a card
  uses the existing work-item peek/detail navigation.
- The `+` / `-` buttons collapse or expand branches locally. They never change
  `parent_id`, sorting, or any work-item data. Tab and Enter can navigate and
  activate the buttons; the canvas scrolls to accommodate wider hierarchies.
- Existing work-item filters and ordering apply, but grouping is removed and
  sub-work items are included so that the hierarchy can be built.
- Results are paginated. A notice and **Load more** button identify a partial
  tree. A parent missing from the current selection is not assumed to be deleted.
- Unavailable parents and cycles are handled by attaching a branch to the
  virtual project root with a dashed edge and explanatory notice.
- **Refresh** revalidates the loaded pages. A failed request displays an explicit
  error and **Retry** action; a partial tree is not silently presented as complete.

## Boundaries

This is a hierarchy POC, not completion of INFRA-1's dependency-graph acceptance.
Dependency/cross-branch edges are **not yet rendered**. The preview explicitly
states this limitation.

Creation from branches, reparenting, dragging, zoom controls, persisted view
settings, saved mind-map views, workspace-wide views, and AI are not implemented.
The existing Plane work-item editor remains the way to edit work items.
There is no new cross-browser real-time synchronization mechanism.

The tree uses an adapted, iterative version of MindSpark's subtree-extent and
forward-placement algorithm. Its MIT attribution is retained in
[MINDSPARK-LICENSE](../apps/web/components/issues/issue-layouts/mindmap/MINDSPARK-LICENSE).
No MindSpark authentication, persistence, service worker, or entire `app.js`
bundle is imported.

## Validation

From the repository root, after installing the repository's declared dependencies
and building the web app's workspace dependencies:

```sh
node --test apps/web/components/issues/issue-layouts/mindmap/tree.test.mjs
pnpm --filter web check:types
pnpm --filter web build
pnpm --filter @plane/i18n sync:check
```

The tests use Node's built-in runner and TypeScript stripping (Node 22.22+);
no additional test-runner dependency is needed. They exercise the tree adapter,
cycle handling, collapse, deep hierarchies, and read-query construction.

The initial browser check used the real preview components with synthetic
project/API responses in an isolated local harness. It exercised pagination,
collapse/expand, peek navigation, query preservation, narrow viewport scrolling,
keyboard activation, error/retry, empty state, and GET-only work-item requests.
It is not a production-backend compatibility or live-deployment test.

React Doctor's latest version could not install because its registry dependency
`@sentry/node@^10.54.0` was unavailable. The repository version's diff comparison
also failed to detect React in its temporary baseline checkout. A local-only full
web scan (`pnpm exec react-doctor apps/web --verbose --diff false --no-score
--no-dead-code`) found no diagnostics in the new mind-map directory, but exited
nonzero with 15 errors in unchanged files. A numeric baseline score comparison
was therefore not available.

New translations are machine-translated and require native-speaker review.
All supported locales have the same new keys.

## Deployment

This code is on `feat/infra-1-mindmap-view`. The existing server's official Plane
images have not been replaced. A local production build does not deploy it.
Backend compatibility, real project verification, and deployment approval are
required before replacing any running frontend. No database migration is needed
for this read-only preview.
