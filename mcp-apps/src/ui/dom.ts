export type ElementChild = Node | string | number | null | undefined | false;

export function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function append(parent: Node, ...children: ElementChild[]): void {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    parent.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

export function replace(parent: Element, ...children: ElementChild[]): void {
  parent.replaceChildren();
  append(parent, ...children);
}

export function button(label: string, className = "button"): HTMLButtonElement {
  const node = element("button", className, label);
  node.type = "button";
  return node;
}

export function externalLink(label: string, href: string, className?: string): HTMLAnchorElement {
  const node = element("a", className, label);
  node.href = href;
  node.target = "_blank";
  node.rel = "noopener noreferrer";
  return node;
}

export function requiredRoot(selector = "#app"): HTMLElement {
  const root = document.querySelector<HTMLElement>(selector);
  if (!root) throw new Error(`缺少界面挂载节点：${selector}`);
  return root;
}

export function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
