/**
 * NIRFIT Stage 1 measurement.
 * Canonical GA4 events: whatsapp_click, lead_submit, phone_click.
 * WhatsApp is the primary Ads conversion; form/phone stay GA4-only.
 * Click IDs are never written into the WhatsApp customer message.
 */
(function (root, factory) {
    var api = factory();
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    root.NirFitMeasurement = api;

    var isBrowser = typeof document !== 'undefined' && typeof window !== 'undefined';
    if (isBrowser && !root.__NIRFIT_MEASUREMENT_NO_AUTO__) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function () { api.init(); });
        } else {
            api.init();
        }
    }
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    var GA4_ID = 'G-F41R697N61';
    var ADS_ID = 'AW-933342010';
    var WA_ADS_LABEL = 'V4FuCNuUsJEcELrWhr0D';
    var CONSENT_KEY = 'cookieConsent';
    var ATTRIB_KEY = 'nirfit_attrib';
    var LEGACY_GCLID_KEY = 'gclid';
    var LEGACY_GCLID_TS_KEY = 'gclid_ts';
    var BOUND_ATTR = 'data-nirfit-bound';
    var LOCK_MS = 1000;
    var ATTRIBUTION_KEYS = [
        'gclid', 'wbraid', 'gbraid',
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'
    ];
    var CLICK_ID_KEYS = ['gclid', 'wbraid', 'gbraid'];
    var CONSENT_GRANTED = {
        ad_storage: 'granted',
        ad_user_data: 'granted',
        ad_personalization: 'granted',
        analytics_storage: 'granted'
    };
    var CONSENT_DENIED = {
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        analytics_storage: 'denied'
    };

    var state = {
        initialized: false,
        attribution: {},
        locks: Object.create(null)
    };

    function now() {
        return Date.now();
    }

    function hasGtag(gtag) {
        return typeof gtag === 'function';
    }

    function safeStorageGet(storage, key) {
        if (!storage) return null;
        try {
            return storage.getItem(key);
        } catch (e) {
            return null;
        }
    }

    function safeStorageSet(storage, key, value) {
        if (!storage) return;
        try {
            storage.setItem(key, value);
        } catch (e) { /* private mode / blocked storage */ }
    }

    function safeStorageRemove(storage, key) {
        if (!storage) return;
        try {
            storage.removeItem(key);
        } catch (e) { /* ignore */ }
    }

    function readConsent(localStorageRef) {
        return safeStorageGet(localStorageRef, CONSENT_KEY);
    }

    function canPersist(consent) {
        return consent === 'accepted';
    }

    function parseAttributionFromSearch(search) {
        var out = {};
        if (!search) return out;
        var query = String(search);
        if (query.charAt(0) === '?') query = query.slice(1);
        var params;
        try {
            params = new URLSearchParams(query);
        } catch (e) {
            return out;
        }
        ATTRIBUTION_KEYS.forEach(function (key) {
            var value = params.get(key);
            if (value) out[key] = value;
        });
        return out;
    }

    function parseStoredAttribution(raw) {
        if (!raw) return {};
        try {
            var parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') return {};
            var out = {};
            ATTRIBUTION_KEYS.forEach(function (key) {
                if (parsed[key]) out[key] = String(parsed[key]);
            });
            return out;
        } catch (e) {
            return {};
        }
    }

    function mergeAttribution(fromUrl, stored) {
        var out = {};
        stored = stored || {};
        fromUrl = fromUrl || {};
        ATTRIBUTION_KEYS.forEach(function (key) {
            if (fromUrl[key]) out[key] = fromUrl[key];
            else if (stored[key]) out[key] = stored[key];
        });
        return out;
    }

    function readStoredAttribution(sessionStorageRef, localStorageRef) {
        var fromSession = parseStoredAttribution(safeStorageGet(sessionStorageRef, ATTRIB_KEY));
        var legacyGclid = safeStorageGet(localStorageRef, LEGACY_GCLID_KEY);
        if (legacyGclid && !fromSession.gclid) fromSession.gclid = legacyGclid;
        return fromSession;
    }

    function writeStoredAttribution(sessionStorageRef, data) {
        var slim = {};
        ATTRIBUTION_KEYS.forEach(function (key) {
            if (data && data[key]) slim[key] = data[key];
        });
        safeStorageSet(sessionStorageRef, ATTRIB_KEY, JSON.stringify(slim));
    }

    function clearStoredAttribution(sessionStorageRef, localStorageRef) {
        safeStorageRemove(sessionStorageRef, ATTRIB_KEY);
        safeStorageRemove(localStorageRef, LEGACY_GCLID_KEY);
        safeStorageRemove(localStorageRef, LEGACY_GCLID_TS_KEY);
    }

    function clearLegacyClickIds(localStorageRef) {
        safeStorageRemove(localStorageRef, LEGACY_GCLID_KEY);
        safeStorageRemove(localStorageRef, LEGACY_GCLID_TS_KEY);
    }

    function captureAttribution(options) {
        options = options || {};
        var loc = options.location || (typeof location !== 'undefined' ? location : { search: '' });
        var sessionStorageRef = options.sessionStorage !== undefined
            ? options.sessionStorage
            : (typeof sessionStorage !== 'undefined' ? sessionStorage : null);
        var localStorageRef = options.localStorage !== undefined
            ? options.localStorage
            : (typeof localStorage !== 'undefined' ? localStorage : null);

        var consent = readConsent(localStorageRef);
        var fromUrl = parseAttributionFromSearch(loc.search || '');
        var stored = canPersist(consent)
            ? readStoredAttribution(sessionStorageRef, localStorageRef)
            : {};
        var merged = mergeAttribution(fromUrl, stored);
        state.attribution = merged;

        if (canPersist(consent)) {
            writeStoredAttribution(sessionStorageRef, merged);
            clearLegacyClickIds(localStorageRef);
        } else {
            clearStoredAttribution(sessionStorageRef, localStorageRef);
        }
        return merged;
    }

    function getPageCity(doc) {
        if (!doc) return '';
        if (doc.body && doc.body.getAttribute) {
            var bodyCity = doc.body.getAttribute('data-city');
            if (bodyCity) return bodyCity;
        }
        var meta = doc.querySelector && doc.querySelector('meta[name="nirfit-city"]');
        if (meta && meta.getAttribute) {
            return meta.getAttribute('content') || '';
        }
        if (meta && meta.content) return meta.content;
        return '';
    }

    function cityFromElement(el) {
        if (!el) return '';
        if (el.getAttribute && el.getAttribute('data-city')) return el.getAttribute('data-city');
        if (typeof el.closest === 'function') {
            var host = el.closest('[data-city]');
            if (host && host.getAttribute) return host.getAttribute('data-city') || '';
        }
        return '';
    }

    function compactParams(obj) {
        var out = {};
        Object.keys(obj).forEach(function (key) {
            if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
                out[key] = obj[key];
            }
        });
        return out;
    }

    function publicCampaignParams(attribution) {
        attribution = attribution || {};
        return compactParams({
            utm_source: attribution.utm_source,
            utm_medium: attribution.utm_medium,
            utm_campaign: attribution.utm_campaign,
            utm_term: attribution.utm_term,
            utm_content: attribution.utm_content
        });
    }

    function buildEventParams(attribution, extra) {
        extra = extra || {};
        return compactParams(Object.assign({
            send_to: GA4_ID
        }, publicCampaignParams(attribution), extra));
    }

    function messageContainsSensitiveIds(text) {
        if (!text) return false;
        var decoded = text;
        try { decoded = decodeURIComponent(String(text)); } catch (e) { decoded = String(text); }
        return /(?:^|[?&#/\s])(?:gclid|wbraid|gbraid)=/i.test(decoded) ||
            /(?:^|[^a-z])(?:gclid|wbraid|gbraid)(?:[^a-z]|$)/i.test(decoded);
    }

    function buildWhatsAppUrl(options) {
        options = options || {};
        var href = options.href || '';
        // Never decorate the customer-facing text with click IDs or raw UTMs.
        if (messageContainsSensitiveIds(href)) {
            try {
                var url = new URL(href, 'https://wa.me');
                var text = url.searchParams.get('text') || '';
                if (messageContainsSensitiveIds(text)) {
                    url.searchParams.set('text', text
                        .replace(/(?:^|\s)(?:gclid|wbraid|gbraid|utm_[a-z]+)=[^\s]+/gi, '')
                        .replace(/\s+/g, ' ')
                        .trim());
                }
                return url.toString();
            } catch (e) {
                return href;
            }
        }
        return href;
    }

    function isLocked(key) {
        var until = state.locks[key];
        return !!(until && until > now());
    }

    function lock(key) {
        state.locks[key] = now() + LOCK_MS;
    }

    function onceFn(fn) {
        var called = false;
        return function () {
            if (called) return;
            called = true;
            fn();
        };
    }

    function getGtag(options) {
        if (options && options.gtag) return options.gtag;
        if (typeof gtag === 'function') return gtag;
        return null;
    }

    function fireGa4(gtagFn, eventName, params, extra) {
        if (!hasGtag(gtagFn)) return;
        var payload = Object.assign({}, params, extra || {});
        gtagFn('event', eventName, payload);
    }

    function fireWhatsAppAdsConversion(gtagFn, callback) {
        if (!hasGtag(gtagFn)) {
            if (callback) callback();
            return;
        }
        var payload = {
            send_to: ADS_ID + '/' + WA_ADS_LABEL,
            transport_type: 'beacon'
        };
        if (callback) payload.event_callback = callback;
        gtagFn('event', 'conversion', payload);
    }

    function whatsappSource(link) {
        if (!link || !link.classList) return 'wa_section';
        if (link.classList.contains('whatsapp-float')) return 'wa_float';
        if (link.classList.contains('sticky-cta-wa')) return 'wa_sticky';
        if (link.classList.contains('btn-whatsapp')) return 'wa_hero';
        if (link.classList.contains('contact-item')) return 'wa_contact';
        if (link.id === 'waLink') return 'wa_landing';
        return 'wa_section';
    }

    function phoneSource(link) {
        if (!link || !link.classList) return 'phone_link';
        if (link.classList.contains('sticky-cta-phone')) return 'phone_sticky';
        if (link.classList.contains('contact-item')) return 'phone_contact';
        if (link.classList.contains('footer-contact-item')) return 'phone_footer';
        if (link.parentElement && link.parentElement.classList &&
            link.parentElement.classList.contains('nav-phone')) {
            return 'phone_nav';
        }
        return 'phone_link';
    }

    function trackWhatsAppClick(options) {
        options = options || {};
        var href = buildWhatsAppUrl({ href: options.href || '' });
        var source = options.source || 'wa_section';
        var lockKey = options.lockKey || ('wa:' + source + ':' + href);
        if (isLocked(lockKey)) return { fired: false, reason: 'locked' };

        lock(lockKey);
        var gtagFn = getGtag(options);
        var navigate = options.navigate || function (url) {
            if (typeof window !== 'undefined') window.location.href = url;
        };
        var go = onceFn(function () { navigate(href); });
        var city = options.city || '';
        var params = buildEventParams(options.attribution || state.attribution, {
            event_category: 'engagement',
            cta_source: source,
            city: city,
            page_path: options.pagePath
        });

        fireGa4(gtagFn, 'whatsapp_click', params, { transport_type: 'beacon' });
        fireWhatsAppAdsConversion(gtagFn, go);
        var waFallback = options.fallbackMs == null ? 900 : options.fallbackMs;
        if (waFallback > 0) setTimeout(go, waFallback);
        return { fired: true, href: href, params: params };
    }

    function trackPhoneClick(options) {
        options = options || {};
        var href = options.href || '';
        var source = options.source || 'phone_link';
        var lockKey = options.lockKey || ('phone:' + source + ':' + href);
        if (isLocked(lockKey)) return { fired: false, reason: 'locked' };

        lock(lockKey);
        var gtagFn = getGtag(options);
        var navigate = options.navigate || function (url) {
            if (typeof window !== 'undefined') window.location.href = url;
        };
        var go = onceFn(function () { navigate(href); });
        var params = buildEventParams(options.attribution || state.attribution, {
            event_category: 'engagement',
            cta_source: source,
            city: options.city || '',
            page_path: options.pagePath
        });

        if (hasGtag(gtagFn)) {
            fireGa4(gtagFn, 'phone_click', params, {
                transport_type: 'beacon',
                event_callback: go
            });
            var phoneFallback = options.fallbackMs == null ? 900 : options.fallbackMs;
            if (phoneFallback > 0) setTimeout(go, phoneFallback);
        } else {
            go();
        }
        return { fired: true, href: href, params: params };
    }

    function normalizePhoneE164(phone) {
        var digits = String(phone || '').replace(/\D/g, '');
        if (!digits) return '';
        if (digits.indexOf('972') === 0) return '+' + digits;
        if (digits.charAt(0) === '0') return '+972' + digits.slice(1);
        return '+972' + digits;
    }

    function trackLeadSubmit(options) {
        options = options || {};
        var lockKey = options.lockKey || 'lead_submit';
        if (isLocked(lockKey)) return { fired: false, reason: 'locked' };
        lock(lockKey);

        var gtagFn = getGtag(options);
        if (options.phone && hasGtag(gtagFn)) {
            try {
                var e164 = normalizePhoneE164(options.phone);
                if (e164.length >= 12) gtagFn('set', 'user_data', { phone_number: e164 });
            } catch (e) { /* ignore enhanced-conversions failures */ }
        }

        var params = buildEventParams(options.attribution || state.attribution, {
            event_category: 'lead',
            cta_source: options.source || 'contact_form',
            city: options.city || '',
            location: options.location || '',
            goal: options.goal || '',
            page_path: options.pagePath
        });
        fireGa4(gtagFn, 'lead_submit', params);
        return { fired: true, params: params };
    }

    function applyConsentUpdate(gtagFn, consent) {
        if (!hasGtag(gtagFn)) return;
        if (consent === 'accepted') gtagFn('consent', 'update', CONSENT_GRANTED);
        else gtagFn('consent', 'update', CONSENT_DENIED);
    }

    function onConsentChange(consent, options) {
        options = options || {};
        var gtagFn = getGtag(options);
        var sessionStorageRef = options.sessionStorage !== undefined
            ? options.sessionStorage
            : (typeof sessionStorage !== 'undefined' ? sessionStorage : null);
        var localStorageRef = options.localStorage !== undefined
            ? options.localStorage
            : (typeof localStorage !== 'undefined' ? localStorage : null);

        applyConsentUpdate(gtagFn, consent);
        if (canPersist(consent)) {
            writeStoredAttribution(sessionStorageRef, state.attribution);
            clearLegacyClickIds(localStorageRef);
        } else {
            clearStoredAttribution(sessionStorageRef, localStorageRef);
        }
    }

    function bindOnce(el, type, handler) {
        if (!el) return false;
        var flag = BOUND_ATTR + '-' + type;
        if (el.getAttribute && el.getAttribute(flag) === '1') return false;
        if (el.getAttribute) el.setAttribute(flag, '1');
        el.addEventListener(type, handler);
        return true;
    }

    function bindOutboundCtas(doc, options) {
        if (!doc || !doc.querySelectorAll) return;
        options = options || {};
        var loc = options.location || (typeof location !== 'undefined' ? location : { pathname: '' });

        doc.querySelectorAll('a[href*="wa.me"]').forEach(function (link) {
            bindOnce(link, 'click', function (e) {
                var liveGtag = getGtag(options);
                if (!hasGtag(liveGtag)) return;
                e.preventDefault();
                trackWhatsAppClick({
                    href: link.href,
                    source: whatsappSource(link),
                    city: cityFromElement(link) || getPageCity(doc),
                    pagePath: loc.pathname,
                    gtag: liveGtag,
                    attribution: state.attribution,
                    lockKey: 'el-wa-' + (link.href || '') + '-' + whatsappSource(link),
                    navigate: options.navigate,
                    fallbackMs: options.fallbackMs
                });
            });
        });

        doc.querySelectorAll('a[href^="tel:"]').forEach(function (link) {
            bindOnce(link, 'click', function (e) {
                var liveGtag = getGtag(options);
                if (!hasGtag(liveGtag)) return;
                e.preventDefault();
                trackPhoneClick({
                    href: link.href,
                    source: phoneSource(link),
                    city: cityFromElement(link) || getPageCity(doc),
                    pagePath: loc.pathname,
                    gtag: liveGtag,
                    attribution: state.attribution,
                    lockKey: 'el-phone-' + (link.href || '') + '-' + phoneSource(link),
                    navigate: options.navigate,
                    fallbackMs: options.fallbackMs
                });
            });
        });
    }

    function init(options) {
        options = options || {};
        if (state.initialized && !options.force) return state;
        state.initialized = true;
        captureAttribution(options);
        bindOutboundCtas(options.document || (typeof document !== 'undefined' ? document : null), options);
        return state;
    }

    function resetForTests() {
        state.initialized = false;
        state.attribution = {};
        state.locks = Object.create(null);
    }

    return {
        GA4_ID: GA4_ID,
        ADS_ID: ADS_ID,
        WA_ADS_LABEL: WA_ADS_LABEL,
        ATTRIBUTION_KEYS: ATTRIBUTION_KEYS,
        CLICK_ID_KEYS: CLICK_ID_KEYS,
        CONSENT_GRANTED: CONSENT_GRANTED,
        CONSENT_DENIED: CONSENT_DENIED,
        parseAttributionFromSearch: parseAttributionFromSearch,
        mergeAttribution: mergeAttribution,
        canPersist: canPersist,
        captureAttribution: captureAttribution,
        readStoredAttribution: readStoredAttribution,
        writeStoredAttribution: writeStoredAttribution,
        clearStoredAttribution: clearStoredAttribution,
        buildEventParams: buildEventParams,
        buildWhatsAppUrl: buildWhatsAppUrl,
        messageContainsSensitiveIds: messageContainsSensitiveIds,
        getPageCity: getPageCity,
        trackWhatsAppClick: trackWhatsAppClick,
        trackPhoneClick: trackPhoneClick,
        trackLeadSubmit: trackLeadSubmit,
        onConsentChange: onConsentChange,
        applyConsentUpdate: applyConsentUpdate,
        bindOnce: bindOnce,
        bindOutboundCtas: bindOutboundCtas,
        init: init,
        resetForTests: resetForTests,
        getAttribution: function () { return Object.assign({}, state.attribution); }
    };
});
