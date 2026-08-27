import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import { remarkGfm, remarkAdmonition, rehypeCode } from "fumadocs-core/mdx-plugins";

export const docs = defineDocs({});

export default defineConfig({
  mdxOptions: {
    remarkPlugins: [remarkGfm, remarkAdmonition],
    rehypePlugins: [
      [
        rehypeCode,
        {
          themes: {
            light: "github-light",
            dark: "github-dark",
          },
        },
      ],
    ],
  },
});
