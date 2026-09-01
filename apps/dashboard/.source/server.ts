// @ts-nocheck
import * as __fd_glob_9 from "../content/docs/security/security-model.md?collection=docs"
import * as __fd_glob_8 from "../content/docs/reference/api.md?collection=docs"
import * as __fd_glob_7 from "../content/docs/concepts/system-design.md?collection=docs"
import * as __fd_glob_6 from "../content/docs/concepts/policy-engine.md?collection=docs"
import * as __fd_glob_5 from "../content/docs/concepts/backend-architecture.md?collection=docs"
import * as __fd_glob_4 from "../content/docs/index.md?collection=docs"
import { default as __fd_glob_3 } from "../content/docs/reference/meta.json?collection=docs"
import { default as __fd_glob_2 } from "../content/docs/security/meta.json?collection=docs"
import { default as __fd_glob_1 } from "../content/docs/concepts/meta.json?collection=docs"
import { default as __fd_glob_0 } from "../content/docs/meta.json?collection=docs"
import { server } from 'fumadocs-mdx/runtime/server';
import type * as Config from '../source.config';

const create = server<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>();

export const docs = await create.docs("docs", "content/docs", {"meta.json": __fd_glob_0, "concepts/meta.json": __fd_glob_1, "security/meta.json": __fd_glob_2, "reference/meta.json": __fd_glob_3, }, {"index.md": __fd_glob_4, "concepts/backend-architecture.md": __fd_glob_5, "concepts/policy-engine.md": __fd_glob_6, "concepts/system-design.md": __fd_glob_7, "reference/api.md": __fd_glob_8, "security/security-model.md": __fd_glob_9, });