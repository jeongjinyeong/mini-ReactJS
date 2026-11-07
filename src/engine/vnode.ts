export type VNode =
  | { type: "text"; value: string }
  | {
      type: "element";
      tag: string;
      attrs: Record<string, string>;
      children: VNode[];
      input?: { value: string; checked?: boolean };
    };

export type VTree = VNode[];
