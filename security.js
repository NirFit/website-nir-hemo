/**
 * NIRFIT Security Module
 * Comprehensive client-side security protections
 */
(function() {
    'use strict';

    const NirfitSecurity = {

        init() {
            this.secureExternalLinks();
            this.enableFormProtection();
            this.preventClickjacking();
            this.preventXSS();
            this.setupRateLimiter();
            this.addHoneypotProtection();
            this.preventConsoleAccess();
            this.preventDragDrop();
        },

        // ==========================================
        // 1. Secure all external links
        // ==========================================
        secureExternalLinks() {
            document.querySelectorAll('a[target="_blank"]').forEach(link => {
                link.setAttribute('rel', 'noopener noreferrer');
            });

            new MutationObserver(mutations => {
                mutations.forEach(mutation => {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1) {
                            if (node.tagName === 'A' && node.target === '_blank') {
                                node.setAttribute('rel', 'noopener noreferrer');
                            }
                            node.querySelectorAll?.('a[target="_blank"]')?.forEach(link => {
                                link.setAttribute('rel', 'noopener noreferrer');
                            });
                        }
                    });
                });
            }).observe(document.body, { childList: true, subtree: true });
        },

        // ==========================================
        // 2. Form input sanitization & validation
        // ==========================================
        enableFormProtection() {
            document.querySelectorAll('form').forEach(form => {
                form.addEventListener('submit', (e) => {
                    const inputs = form.querySelectorAll('input, textarea, select');
                    let isValid = true;

                    inputs.forEach(input => {
                        if (input.type === 'checkbox' || input.type === 'submit') return;

                        const value = input.value;

                        if (this.containsMaliciousContent(value)) {
                            e.preventDefault();
                            input.value = this.sanitizeInput(value);
                            this.showSecurityWarning(input);
                            isValid = false;
                        }
                    });

                    if (!isValid) {
                        e.preventDefault();
                    }
                });

                form.querySelectorAll('input, textarea').forEach(input => {
                    input.addEventListener('paste', (e) => {
                        setTimeout(() => {
                            if (this.containsMaliciousContent(input.value)) {
                                input.value = this.sanitizeInput(input.value);
                            }
                        }, 10);
                    });
                });
            });
        },

        containsMaliciousContent(str) {
            if (!str) return false;
            const patterns = [
                /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
                /javascript\s*:/gi,
                /on\w+\s*=/gi,
                /<iframe/gi,
                /<object/gi,
                /<embed/gi,
                /<link/gi,
                /eval\s*\(/gi,
                /expression\s*\(/gi,
                /url\s*\(/gi,
                /&#[0-9x]/gi,
                /\.\.\//g,
                /<img[^>]+onerror/gi,
                /document\.(cookie|write|location)/gi,
                /window\.(location|open)/gi,
                /\balert\s*\(/gi,
                /\bconfirm\s*\(/gi,
                /\bprompt\s*\(/gi,
                /<\s*\/?\s*(script|iframe|object|embed|form|input|img|svg|link|style|base|meta)/gi,
            ];
            return patterns.some(pattern => pattern.test(str));
        },

        sanitizeInput(str) {
            if (!str) return '';
            return str
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#x27;')
                .replace(/\//g, '&#x2F;')
                .replace(/javascript\s*:/gi, '')
                .replace(/on\w+\s*=/gi, '')
                .replace(/eval\s*\(/gi, '')
                .replace(/expression\s*\(/gi, '');
        },

        showSecurityWarning(input) {
            input.style.borderColor = '#ff4444';
            input.setAttribute('title', 'תוכן לא תקין זוהה וסונן');
            setTimeout(() => {
                input.style.borderColor = '';
                input.removeAttribute('title');
            }, 3000);
        },

        // ==========================================
        // 3. Prevent clickjacking
        // ==========================================
        preventClickjacking() {
            if (window.self !== window.top) {
                document.body.style.display = 'none';
                window.top.location = window.self.location;
            }
        },

        // ==========================================
        // 4. XSS prevention utilities
        // ==========================================
        preventXSS() {
            const originalInnerHTML = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
            if (originalInnerHTML) {
                Object.defineProperty(Element.prototype, 'safeHTML', {
                    set(value) {
                        const clean = NirfitSecurity.sanitizeInput(value);
                        originalInnerHTML.set.call(this, clean);
                    }
                });
            }

            if (window.location.hash) {
                const hash = decodeURIComponent(window.location.hash);
                if (this.containsMaliciousContent(hash)) {
                    window.location.hash = '';
                }
            }

            const params = new URLSearchParams(window.location.search);
            params.forEach((value, key) => {
                if (this.containsMaliciousContent(value) || this.containsMaliciousContent(key)) {
                    window.history.replaceState({}, '', window.location.pathname);
                }
            });
        },

        // ==========================================
        // 5. Rate limiting for form submissions
        // ==========================================
        setupRateLimiter() {
            this.submissionLog = {};
            this.maxSubmissions = 3;
            this.windowMs = 300000; // 5 minutes

            document.querySelectorAll('form').forEach(form => {
                form.addEventListener('submit', (e) => {
                    const formId = form.id || 'default';
                    const now = Date.now();

                    if (!this.submissionLog[formId]) {
                        this.submissionLog[formId] = [];
                    }

                    this.submissionLog[formId] = this.submissionLog[formId].filter(
                        time => now - time < this.windowMs
                    );

                    if (this.submissionLog[formId].length >= this.maxSubmissions) {
                        e.preventDefault();
                        e.stopImmediatePropagation();
                        this.showRateLimitWarning(form);
                        return false;
                    }

                    this.submissionLog[formId].push(now);
                }, true);
            });
        },

        showRateLimitWarning(form) {
            let warning = form.querySelector('.rate-limit-warning');
            if (!warning) {
                warning = document.createElement('div');
                warning.className = 'rate-limit-warning';
                warning.style.cssText = 'background:#ff4444;color:#fff;padding:12px 16px;border-radius:8px;margin:12px 0;text-align:center;font-size:0.95rem;direction:rtl;';
                warning.textContent = 'שליחות רבות מדי. אנא נסה שוב בעוד מספר דקות.';
                form.insertBefore(warning, form.querySelector('button[type="submit"]'));
            }
            setTimeout(() => warning?.remove(), 5000);
        },

        // ==========================================
        // 6. Honeypot anti-bot protection
        // ==========================================
        addHoneypotProtection() {
            document.querySelectorAll('form').forEach(form => {
                if (form.querySelector('.hp-field')) return;

                const honeypot = document.createElement('div');
                honeypot.style.cssText = 'position:absolute;left:-9999px;top:-9999px;opacity:0;height:0;width:0;overflow:hidden;';
                honeypot.setAttribute('aria-hidden', 'true');
                honeypot.innerHTML = '<input type="text" name="website_url" tabindex="-1" autocomplete="off" class="hp-field" value="">';
                form.appendChild(honeypot);

                const timestampField = document.createElement('input');
                timestampField.type = 'hidden';
                timestampField.name = '_form_loaded';
                timestampField.value = Date.now().toString();
                form.appendChild(timestampField);

                form.addEventListener('submit', (e) => {
                    const hpValue = form.querySelector('.hp-field')?.value;
                    if (hpValue) {
                        e.preventDefault();
                        e.stopImmediatePropagation();
                        return false;
                    }

                    const loadedTime = parseInt(form.querySelector('[name="_form_loaded"]')?.value || '0');
                    if (Date.now() - loadedTime < 2000) {
                        e.preventDefault();
                        e.stopImmediatePropagation();
                        return false;
                    }
                }, true);
            });
        },

        // ==========================================
        // 7. Console protection (deter casual snoopers)
        // ==========================================
        preventConsoleAccess() {
            const warningStyle = 'color: red; font-size: 24px; font-weight: bold;';
            const infoStyle = 'color: #333; font-size: 14px;';
            console.log('%cעצור!', warningStyle);
            console.log('%cאזור זה מיועד למפתחים בלבד. אם מישהו ביקש ממך להדביק כאן משהו, סביר להניח שמדובר בהונאה.', infoStyle);
        },

        // ==========================================
        // 8. Prevent drag & drop attacks
        // ==========================================
        preventDragDrop() {
            document.addEventListener('dragover', (e) => {
                if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'none';
                }
            });
            document.addEventListener('drop', (e) => {
                if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                    e.preventDefault();
                }
            });
        }
    };

    // Phone number validation
    document.querySelectorAll('input[type="tel"]').forEach(input => {
        input.addEventListener('input', function() {
            this.value = this.value.replace(/[^\d\-+() ]/g, '');
            if (this.value.length > 15) {
                this.value = this.value.substring(0, 15);
            }
        });
    });

    // Name field protection
    document.querySelectorAll('input[name="name"]').forEach(input => {
        input.addEventListener('input', function() {
            this.value = this.value.replace(/[<>{}[\]\\\/]/g, '');
        });
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => NirfitSecurity.init());
    } else {
        NirfitSecurity.init();
    }

    window.NirfitSecurity = Object.freeze({
        sanitize: NirfitSecurity.sanitizeInput.bind(NirfitSecurity),
        isMalicious: NirfitSecurity.containsMaliciousContent.bind(NirfitSecurity)
    });
})();
