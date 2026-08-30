import { createApp, type Component } from "vue";

export interface MountedComponent {
  readonly host: HTMLElement;
  unmount(): void;
}

export function mountComponent(component: Component, props: Record<string, unknown>): MountedComponent {
  const host = document.createElement("div");
  document.body.append(host);
  const app = createApp(component, props);
  app.mount(host);
  return {
    host,
    unmount() {
      app.unmount();
      host.remove();
    },
  };
}
