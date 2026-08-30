export function formatProfileLayers(input: {
  readonly attraction: readonly string[];
  readonly selection: readonly string[];
  readonly interaction: readonly string[];
}): readonly string[] {
  const layers: ReadonlyArray<readonly [string, readonly string[]]> = [
    ["吸引入口", input.attraction],
    ["选择机制", input.selection],
    ["相处惯性", input.interaction],
  ];
  return Object.freeze(layers.flatMap(([label, statements]) => statements.length ? [`【${label}】${statements.map(sentence).join("")}`] : []));
}

function sentence(value: string): string {
  const trimmed = value.trim();
  return /[。！？；]$/u.test(trimmed) ? trimmed : `${trimmed}。`;
}
