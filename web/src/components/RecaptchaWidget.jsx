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

    // Timeout an toàn sau 15 giây nếu mạng chặn Google
    setTimeout(() => {
      clearInterval(checkInterval);
      resolve(window.grecaptcha || null);
    }, 15000);
  });

  return recaptchaScriptPromise;
}

/**
 * Component hiển thị Google reCAPTCHA v2 trong SPA.
 * Tự động nạp script của Google, render widget vào div.g-recaptcha và hỗ trợ reset khi cần làm mới.
 */
export default function RecaptchaWidget({
  siteKey = DEFAULT_SITE_KEY,
  onChange,
  resetSignal = 0,
}) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let isMounted = true;

    loadRecaptchaScript().then((grecaptcha) => {
      if (!isMounted || !grecaptcha || !containerRef.current) return;
      if (widgetIdRef.current !== null) return;

      try {
        grecaptcha.ready(() => {
          if (!isMounted || !containerRef.current || widgetIdRef.current !== null) return;
          // Làm sạch container trước khi render để tránh lỗi "reCAPTCHA has already been rendered in this element"
          containerRef.current.innerHTML = '';
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
        });
      } catch (_) {
        // Bỏ qua nếu widget đã được khởi tạo
      }
    });

    return () => {
      isMounted = false;
    };
  }, [siteKey]);

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

  return <div ref={containerRef} className="g-recaptcha" data-sitekey={siteKey} />;
}
