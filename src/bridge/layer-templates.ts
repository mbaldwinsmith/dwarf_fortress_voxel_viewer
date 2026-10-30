// Expand installed native templates before parsing/evaluating their layer rules.
export function layerTemplates(sources: string[]) {
  const templates = new Map<string, string>();
  for (const source of sources) {
    const headers = [...source.matchAll(/\[LAYER_SET_TEMPLATE:([^\]]+)\]/g)];
    for (const [i, h] of headers.entries())
      templates.set(
        h[1],
        source.slice(
          h.index! + h[0].length,
          headers[i + 1]?.index ?? source.length,
        ),
      );
  }
  return templates;
}
export function expandLayerTemplates(
  source: string,
  templates: Map<string, string>,
) {
  return source.replace(
    /\[USE_LAYER_SET_TEMPLATE:([^\]]+)\]([\s\S]*?)(?=\[LAYER_SET:|\[CREATURE(?:_CASTE)?_GRAPHICS:|$)/g,
    (_all, name: string, body: string) => {
      const template = templates.get(name);
      if (!template) return "";
      const args = new Map<string, string>();
      for (const m of body.matchAll(/\[(ARG_[^:\]]+):([^\]]*)\]/g))
        args.set(m[1], m[2]);
      return [...template.matchAll(/\[([^\]]+)\]/g)]
        .map(
          (m) =>
            "[" +
            m[1]
              .split(":")
              .map((a) => (a.startsWith("ARG_") ? (args.get(a) ?? "NO") : a))
              .join(":") +
            "]",
        )
        .join("\n");
    },
  );
}
