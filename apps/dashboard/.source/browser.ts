// @ts-nocheck
import { browser } from 'fumadocs-mdx/runtime/browser';
import type * as Config from '../source.config';

const create = browser<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>();
const browserCollections = {
  docs: create.doc("docs", {"index.md": () => import("../content/docs/index.md?collection=docs"), "concepts/backend-architecture.md": () => import("../content/docs/concepts/backend-architecture.md?collection=docs"), "concepts/policy-engine.md": () => import("../content/docs/concepts/policy-engine.md?collection=docs"), "concepts/system-design.md": () => import("../content/docs/concepts/system-design.md?collection=docs"), "reference/api.md": () => import("../content/docs/reference/api.md?collection=docs"), "security/security-model.md": () => import("../content/docs/security/security-model.md?collection=docs"), }),
};
export default browserCollections;