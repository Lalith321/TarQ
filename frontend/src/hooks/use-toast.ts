interface ToastOptions { title?: string; description?: string; variant?: string; }
export function useToast() {
  return {
    toast: ({ title, description }: ToastOptions) => {
      console.warn(`[toast] ${title}${description ? ': ' + description : ''}`);
    },
  };
}
