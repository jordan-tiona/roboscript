declare global {
  interface Window {
    grecaptcha: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

const SITE_KEY = import.meta.env["VITE_RECAPTCHA_SITE_KEY"] as string | undefined;

let loadPromise: Promise<void> | null = null;

export function preloadRecaptcha(): void {
  if (!SITE_KEY || loadPromise) return;
  loadPromise = new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${SITE_KEY}`;
    script.onload = () => resolve();
    document.head.appendChild(script);
  });
}

export async function getRecaptchaToken(action: string): Promise<string> {
  if (!SITE_KEY) return "";
  if (!loadPromise) preloadRecaptcha();
  await loadPromise;
  return new Promise((resolve) => {
    window.grecaptcha.ready(() => {
      window.grecaptcha.execute(SITE_KEY!, { action }).then(resolve);
    });
  });
}
