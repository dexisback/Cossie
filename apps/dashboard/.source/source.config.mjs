// source.config.ts
import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import { remarkGfm, remarkAdmonition, rehypeCode } from "fumadocs-core/mdx-plugins";
var docs = defineDocs({});
var source_config_default = defineConfig({
  mdxOptions: {
    remarkPlugins: [remarkGfm, remarkAdmonition],
    rehypePlugins: [
      [
        rehypeCode,
        {
          themes: {
            light: "github-light",
            dark: "github-dark"
          }
        }
      ]
    ]
  }
});
export {
  source_config_default as default,
  docs
};
