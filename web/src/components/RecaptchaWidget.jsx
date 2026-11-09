import React, { useEffect, useRef } from 'react';

const DEFAULT_SITE_KEY =
  import.meta.env.VITE_RECAPTCHA_SITE_KEY || '6LdsdwwuAAAAABqyPGKwo-zQCwhVHYobHdRN-TFt';

let recaptchaScriptPromise = null;

function loadRecaptchaScript() {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.grecaptcha && typeof window.grecaptcha.render === 'function') {
    return Promise.resolve(window.grecaptcha);
  }
  if (recaptchaScriptPromise) {
    return recaptchaScriptPromise;
  }

  recaptchaScriptPromise = new Promise((resolve) => {
    const existingScript = document.querySelector('script[src*="google.com/recaptcha/api.js"]');
    if (!existingScript) {
      const script = document.createElement('script');
      script.src = 'https://www.google.com/recaptcha/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    const checkInterval = setInterval(() => {
      if (window.grecaptcha && typeof window.grecaptcha.render === 'function') {
        clearInterval(checkInterval);
        resolve(window.grecaptcha);
      }
    }, 100);

    setTimeout(() => {
      clearInterval(checkInterval);
      resolve(window.grecaptcha || null);
    }, 15000);
  });

  return recaptchaScriptPromise;
}

/**
 * Component hiển thị Google reCAPTCHA v2 trong SPA.
 * Chỉ khởi tạo widget khi vùng chứa đang hiển thị (isVisible = true) để đảm bảo
 * kích thước khung và vùng chạm (touch target) trên Mobile hoạt động chính xác 100%.
 */
export default function RecaptchaWidget({
  siteKey = DEFAULT_SITE_KEY,
  onChange,
  resetSignal = 0,
  isVisible = true,
}) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const isRenderingRef = useRef(false);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!isVisible) return undefined;
    let isCancelled = false;

    loadRecaptchaScript().then((grecaptcha) => {
      if (isCancelled || !grecaptcha || !containerRef.current) return;
      if (widgetIdRef.current !== null || isRenderingRef.current) return;

      grecaptcha.ready(() => {
        if (isCancelled || !containerRef.current) return;
        if (widgetIdRef.current !== null || isRenderingRef.current) return;
        if (containerRef.current.childElementCount > 0) return;

        try {
          isRenderingRef.current = true;
          widgetIdRef.current = grecaptcha.render(containerRef.current, {
            sitekey: siteKey,
            callback: (token) => {
              if (onChangeRef.current) onChangeRef.current(token || '');
            },
            'expired-callback': () => {
              if (onChangeRef.current) onChangeRef.current('');
            },
            'error-callback': () => {
              if (onChangeRef.current) onChangeRef.current('');
            },
          });
        } catch (_) {
          // Bỏ qua nếu widget đã được render
        } finally {
          isRenderingRef.current = false;
        }
      });
    });

    return () => {
      isCancelled = true;
    };
  }, [siteKey, isVisible]);

  useEffect(() => {
    if (resetSignal > 0 && widgetIdRef.current !== null && window.grecaptcha) {
      try {
        window.grecaptcha.reset(widgetIdRef.current);
        if (onChangeRef.current) onChangeRef.current('');
      } catch (_) {
        // Bỏ qua lỗi khi reset
      }
    }
  }, [resetSignal]);

  return (
    <div
      ref={containerRef}
      className="g-recaptcha"
      data-sitekey={siteKey}
      style={{ minHeight: '78px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
    />
  );
}
