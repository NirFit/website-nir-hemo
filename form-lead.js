/**
 * Contact-form lead payload helpers.
 * Enriches the Web3Forms email and an optional manager webhook.
 * lead_submit stays GA4-only in measurement.js — this file never talks to Ads.
 */
(function (root, factory) {
    var api = factory();
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    root.NirFitFormLead = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    function trimStr(value) {
        return String(value == null ? '' : value).trim();
    }

    function canonicalPage(pathname) {
        var path = trimStr(pathname).split('?')[0].split('#')[0];
        if (!path || path === '/index.html') return '/';
        path = path.replace(/\/index\.html$/, '/');
        if (path !== '/' && path.charAt(path.length - 1) !== '/') path += '/';
        return path;
    }

    function buildSubject(city, page, name) {
        return 'NirFit ליד | ' + trimStr(city) + ' | ' + trimStr(page) + ' | ' + trimStr(name);
    }

    function buildEmailBody(fields) {
        fields = fields || {};
        return [
            'date: ' + trimStr(fields.date),
            'name: ' + trimStr(fields.name),
            'phone: ' + trimStr(fields.phone),
            'city: ' + trimStr(fields.city),
            'page: ' + trimStr(fields.page)
        ].join('\n');
    }

    function resolveWebhookUrl(options) {
        options = options || {};
        var win = options.window != null ? options.window : (typeof window !== 'undefined' ? window : null);
        var doc = options.document != null ? options.document : (typeof document !== 'undefined' ? document : null);
        try {
            if (win && trimStr(win.NIRFIT_FORM_WEBHOOK)) {
                return trimStr(win.NIRFIT_FORM_WEBHOOK);
            }
            var meta = doc && doc.querySelector && doc.querySelector('meta[name="nirfit-form-webhook"]');
            if (meta) {
                var content = trimStr(meta.getAttribute ? meta.getAttribute('content') : meta.content);
                if (content) return content;
            }
        } catch (e) { /* empty webhook must stay silent */ }
        return '';
    }

    function notifyWebhook(payload, options) {
        options = options || {};
        var url = trimStr(options.url != null ? options.url : resolveWebhookUrl(options));
        if (!url) return { sent: false, reason: 'empty' };

        var fetchFn = options.fetch || (typeof fetch !== 'undefined' ? fetch : null);
        if (!fetchFn) return { sent: false, reason: 'no-fetch' };

        try {
            var req = fetchFn(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(payload),
                keepalive: true
            });
            if (req && typeof req.catch === 'function') {
                req.catch(function () { /* webhook must never block success UI */ });
            }
            return { sent: true };
        } catch (e) {
            return { sent: false, reason: 'error' };
        }
    }

    function enrichFormData(formData, options) {
        options = options || {};
        var date = options.date || new Date().toISOString();
        var name = trimStr(formData.get('name'));
        var phone = trimStr(formData.get('phone'));
        var city = trimStr(formData.get('city') || options.city);
        var page = trimStr(formData.get('page')) || canonicalPage(options.pathname);
        var existingMessage = trimStr(formData.get('message'));
        var leadBody = buildEmailBody({
            date: date,
            name: name,
            phone: phone,
            city: city,
            page: page
        });

        formData.set('city', city);
        formData.set('page', page);
        formData.set('date', date);
        formData.set('subject', buildSubject(city, page, name));
        formData.set('message', existingMessage ? (leadBody + '\n\n' + existingMessage) : leadBody);

        return {
            date: date,
            name: name,
            phone: phone,
            city: city,
            page: page,
            source: 'contact_form',
            subject: buildSubject(city, page, name)
        };
    }

    return {
        canonicalPage: canonicalPage,
        buildSubject: buildSubject,
        buildEmailBody: buildEmailBody,
        resolveWebhookUrl: resolveWebhookUrl,
        notifyWebhook: notifyWebhook,
        enrichFormData: enrichFormData
    };
});
