export {};

declare global {
  interface Window {
    _hmt: any[];
    
    alert: {
      (message: string): void;
      (message: string, title: string): void;
      native?: typeof window.alert;
    };
    
    confirm: {
      (message: string): boolean;
      (message: string, title: string): boolean;
      native?: typeof window.confirm;
    };
  }
}
