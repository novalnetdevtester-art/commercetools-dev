declare module '*.scss';

declare global {
  interface Window {
    Novalnet: {
      setParam(key: string, value: string): void;
      render(): void;
      closeChildWindow(method?: string): void;
    };
  }
}

export {};
