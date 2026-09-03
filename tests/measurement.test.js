'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const measurement = require('../measurement.js');

function memoryStorage(seed) {
    const data = Object.assign({}, seed || {});
    return {
        getItem(key) {
            return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
        },
        setItem(key, value) {
            data[key] = String(value);
        },
        removeItem(key) {
            delete data[key];
        },
        dump() {
            return Object.assign({}, data);
        }
    };
}

function createGtagRecorder() {
    const calls = [];
    function gtag() {
        const args = Array.from(arguments);
        calls.push(args);
        const params = args[2];
        if (params && typeof params.event_callback === 'function') {
            params.event_callback();
        }
    }
    gtag.calls = calls;
    return gtag;
}

function eventCalls(gtag, name) {
    return gtag.calls.filter((args) => args[0] === 'event' && args[1] === name);
}

function createLink(href, className, extras) {
    extras = extras || {};
    const attrs = {};
    const listeners = {};
    const classList = new Set((className || '').split(/\s+/).filter(Boolean));
    const el = {
        href,
        id: extras.id || '',
        parentElement: extras.parent || null,
        classList: {
            contains(name) { return classList.has(name); }
        },
        getAttribute(key) { return attrs[key]; },
        setAttribute(key, value) { attrs[key] = String(value); },
        addEventListener(type, fn) {
            listeners[type] = listeners[type] || [];
            listeners[type].push(fn);
        },
        click() {
            const event = {
                defaultPrevented: false,
                preventDefault() { event.defaultPrevented = true; },
                currentTarget: el,
                target: el
            };
            (listeners.click || []).forEach((fn) => fn(event));
            return event;
        }
    };
    return el;
}

function createDoc(links) {
    return {
        querySelectorAll(sel) {
            if (sel.includes('wa.me')) return links.filter((l) => l.href.includes('wa.me'));
            if (sel.includes('tel:')) return links.filter((l) => l.href.startsWith('tel:'));
            return [];
        },
        querySelector() { return null; },
        body: { getAttribute() { return null; } }
    };
}

beforeEach(() => {
    measurement.resetForTests();
});

describe('attribution parsing and consent-gated storage', () => {
    it('parses gclid, wbraid/gbraid and all UTM fields from the query string', () => {
        const parsed = measurement.parseAttributionFromSearch(
            '?gclid=GCLID1&wbraid=WB1&gbraid=GB1&utm_source=google&utm_medium=cpc&utm_campaign=fit&utm_term=trainer&utm_content=ad1&ignored=x'
        );
        assert.deepEqual(parsed, {
            gclid: 'GCLID1',
            wbraid: 'WB1',
            gbraid: 'GB1',
            utm_source: 'google',
            utm_medium: 'cpc',
            utm_campaign: 'fit',
            utm_term: 'trainer',
            utm_content: 'ad1'
        });
    });

    it('lets the current URL win over stored values', () => {
        const merged = measurement.mergeAttribution(
            { gclid: 'NEW', utm_source: 'google' },
            { gclid: 'OLD', utm_source: 'direct', utm_campaign: 'keep' }
        );
        assert.equal(merged.gclid, 'NEW');
        assert.equal(merged.utm_source, 'google');
        assert.equal(merged.utm_campaign, 'keep');
    });

    it('does not persist click IDs when consent is missing or denied', () => {
        const session = memoryStorage();
        const local = memoryStorage({ gclid: 'LEGACY', gclid_ts: '1' });
        const captured = measurement.captureAttribution({
            location: { search: '?gclid=FROMURL&utm_source=google' },
            sessionStorage: session,
            localStorage: local
        });
        assert.equal(captured.gclid, 'FROMURL');
        assert.equal(session.getItem('nirfit_attrib'), null);
        assert.equal(local.getItem('gclid'), null);
        assert.equal(local.getItem('gclid_ts'), null);
    });

    it('persists attribution in sessionStorage only after accept, and clears it on reject', () => {
        const session = memoryStorage();
        const local = memoryStorage({ cookieConsent: 'accepted' });
        measurement.captureAttribution({
            location: { search: '?gclid=OK&utm_campaign=spring' },
            sessionStorage: session,
            localStorage: local
        });
        const stored = JSON.parse(session.getItem('nirfit_attrib'));
        assert.equal(stored.gclid, 'OK');
        assert.equal(stored.utm_campaign, 'spring');
        assert.equal(local.getItem('gclid'), null);

        measurement.onConsentChange('essential', {
            gtag: createGtagRecorder(),
            sessionStorage: session,
            localStorage: local
        });
        assert.equal(session.getItem('nirfit_attrib'), null);
    });

    it('restores stored campaign params on a later page when consent is granted', () => {
        const session = memoryStorage({
            nirfit_attrib: JSON.stringify({ gclid: 'KEEP', utm_source: 'google', utm_campaign: 'fit' })
        });
        const local = memoryStorage({ cookieConsent: 'accepted' });
        const captured = measurement.captureAttribution({
            location: { search: '' },
            sessionStorage: session,
            localStorage: local
        });
        assert.equal(captured.gclid, 'KEEP');
        assert.equal(captured.utm_source, 'google');
        assert.equal(captured.utm_campaign, 'fit');
    });
});

describe('WhatsApp handoff does not expose click IDs', () => {
    it('keeps the customer-facing message unchanged when no IDs are present', () => {
        const href = 'https://wa.me/972542063967?text=' + encodeURIComponent('היי ניר! באתי דרך האתר שלך');
        assert.equal(measurement.buildWhatsAppUrl({ href }), href);
        assert.equal(measurement.messageContainsSensitiveIds(href), false);
    });

    it('does not copy gclid/wbraid/gbraid into the WhatsApp text', () => {
        const href = 'https://wa.me/972542063967?text=' + encodeURIComponent('היי ניר gclid=ABC wbraid=W gbraid=G');
        const cleaned = measurement.buildWhatsAppUrl({ href });
        assert.equal(measurement.messageContainsSensitiveIds(cleaned), false);
        assert.doesNotMatch(decodeURIComponent(cleaned), /gclid=|wbraid=|gbraid=/);
    });

    it('sends campaign params to GA4 events, not in the chat URL', () => {
        const href = 'https://wa.me/972542063967?text=hello';
        const gtag = createGtagRecorder();
        const result = measurement.trackWhatsAppClick({
            href,
            gtag,
            fallbackMs: 0,
            navigate() {},
            attribution: {
                gclid: 'SECRET',
                utm_source: 'google',
                utm_medium: 'cpc',
                utm_campaign: 'fit'
            }
        });
        assert.equal(result.href.includes('gclid'), false);
        const gaEvent = eventCalls(gtag, 'whatsapp_click')[0][2];
        assert.equal(gaEvent.utm_source, 'google');
        assert.equal(gaEvent.utm_campaign, 'fit');
        assert.equal(gaEvent.gclid, undefined);
    });
});

describe('one activation = one canonical event', () => {
    it('WhatsApp click fires exactly one whatsapp_click and one Ads conversion without a value', () => {
        const gtag = createGtagRecorder();
        const navigations = [];
        measurement.trackWhatsAppClick({
            href: 'https://wa.me/972542063967?text=hi',
            source: 'wa_float',
            gtag,
            fallbackMs: 0,
            navigate: (url) => navigations.push(url),
            attribution: { utm_source: 'google' }
        });
        assert.equal(eventCalls(gtag, 'whatsapp_click').length, 1);
        assert.equal(eventCalls(gtag, 'conversion').length, 1);
        assert.equal(eventCalls(gtag, 'close_convert_lead').length, 0);
        assert.equal(eventCalls(gtag, 'generate_lead').length, 0);
        assert.equal(eventCalls(gtag, 'lead_submit').length, 0);
        assert.equal(eventCalls(gtag, 'phone_click').length, 0);

        const conversion = eventCalls(gtag, 'conversion')[0][2];
        assert.equal(conversion.send_to, 'AW-933342010/V4FuCNuUsJEcELrWhr0D');
        assert.equal(conversion.value, undefined);
        assert.equal(conversion.currency, undefined);
        assert.equal(navigations.length, 1);
    });

    it('a second WhatsApp click on the same CTA is ignored while the lock is active', () => {
        const gtag = createGtagRecorder();
        const opts = {
            href: 'https://wa.me/972542063967?text=hi',
            source: 'wa_float',
            lockKey: 'same-wa',
            gtag,
            fallbackMs: 0,
            navigate() {}
        };
        assert.equal(measurement.trackWhatsAppClick(opts).fired, true);
        assert.equal(measurement.trackWhatsAppClick(opts).fired, false);
        assert.equal(eventCalls(gtag, 'whatsapp_click').length, 1);
        assert.equal(eventCalls(gtag, 'conversion').length, 1);
    });

    it('phone click fires exactly one phone_click and no Ads conversion', () => {
        const gtag = createGtagRecorder();
        measurement.trackPhoneClick({
            href: 'tel:+972542063967',
            source: 'phone_sticky',
            gtag,
            fallbackMs: 0,
            navigate() {}
        });
        assert.equal(eventCalls(gtag, 'phone_click').length, 1);
        assert.equal(eventCalls(gtag, 'conversion').length, 0);
        assert.equal(eventCalls(gtag, 'close_convert_lead').length, 0);
        assert.equal(eventCalls(gtag, 'whatsapp_click').length, 0);
        const params = eventCalls(gtag, 'phone_click')[0][2];
        assert.equal(params.send_to, 'G-F41R697N61');
        assert.equal(params.value, undefined);
        assert.equal(params.currency, undefined);
    });

    it('form success fires exactly one lead_submit and no Ads conversion or fake value', () => {
        const gtag = createGtagRecorder();
        measurement.trackLeadSubmit({
            gtag,
            phone: '0542063967',
            location: 'סטודיו קריית ביאליק',
            goal: 'ירידה במשקל'
        });
        assert.equal(eventCalls(gtag, 'lead_submit').length, 1);
        assert.equal(eventCalls(gtag, 'generate_lead').length, 0);
        assert.equal(eventCalls(gtag, 'close_convert_lead').length, 0);
        assert.equal(eventCalls(gtag, 'conversion').length, 0);
        const params = eventCalls(gtag, 'lead_submit')[0][2];
        assert.equal(params.send_to, 'G-F41R697N61');
        assert.equal(params.location, 'סטודיו קריית ביאליק');
        assert.equal(params.value, undefined);
        assert.equal(params.currency, undefined);
        const userData = gtag.calls.find((args) => args[0] === 'set' && args[1] === 'user_data');
        assert.equal(userData[2].phone_number, '+972542063967');
    });

    it('double-binding the same links still yields one event per click', () => {
        const gtag = createGtagRecorder();
        const wa = createLink('https://wa.me/972542063967?text=hi', 'whatsapp-float');
        const phone = createLink('tel:+972542063967', 'sticky-cta-phone');
        const doc = createDoc([wa, phone]);
        const opts = { document: doc, gtag, navigate() {}, force: true, fallbackMs: 0, location: { search: '', pathname: '/' } };
        measurement.init(opts);
        measurement.init(opts);
        wa.click();
        phone.click();
        assert.equal(eventCalls(gtag, 'whatsapp_click').length, 1);
        assert.equal(eventCalls(gtag, 'conversion').length, 1);
        assert.equal(eventCalls(gtag, 'phone_click').length, 1);
    });

    it('includes city only when the page or element actually provides it', () => {
        const gtag = createGtagRecorder();
        measurement.trackWhatsAppClick({
            href: 'https://wa.me/972542063967?text=hi',
            gtag,
            fallbackMs: 0,
            navigate() {}
        });
        assert.equal(eventCalls(gtag, 'whatsapp_click')[0][2].city, undefined);

        measurement.resetForTests();
        const gtag2 = createGtagRecorder();
        measurement.trackWhatsAppClick({
            href: 'https://wa.me/972542063967?text=hi',
            city: 'afula',
            gtag: gtag2,
            fallbackMs: 0,
            navigate() {}
        });
        assert.equal(eventCalls(gtag2, 'whatsapp_click')[0][2].city, 'afula');
        assert.equal(measurement.getPageCity({
            body: { getAttribute() { return null; } },
            querySelector(sel) { return sel === 'meta[name="geo.placename"]' ? { content: 'Krayot, Afula' } : null; }
        }), '');
    });
});

describe('Consent Mode v2', () => {
    it('accept grants all ads/analytics storage flags; reject keeps them denied', () => {
        const gtag = createGtagRecorder();
        measurement.applyConsentUpdate(gtag, 'accepted');
        measurement.applyConsentUpdate(gtag, 'essential');
        assert.deepEqual(gtag.calls[0], ['consent', 'update', measurement.CONSENT_GRANTED]);
        assert.deepEqual(gtag.calls[1], ['consent', 'update', measurement.CONSENT_DENIED]);
        assert.equal(measurement.CONSENT_DENIED.ad_storage, 'denied');
        assert.equal(measurement.CONSENT_DENIED.analytics_storage, 'denied');
    });

    it('index.html defaults storage to denied before the Google tag script', () => {
        const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
        const defaultAt = html.indexOf("gtag('consent', 'default'");
        const tagAt = html.indexOf('https://www.googletagmanager.com/gtag/js?id=G-F41R697N61');
        const deniedAt = html.indexOf("'ad_storage': 'denied'");
        assert.ok(defaultAt !== -1 && tagAt !== -1 && defaultAt < tagAt);
        assert.ok(deniedAt !== -1 && deniedAt < tagAt);
        assert.match(html, /cookieConsent[\s\S]*accepted[\s\S]*granted/);
        assert.match(html, /cookieConsent[\s\S]*essential[\s\S]*denied/);
        assert.match(html, /<script src="measurement\.js"><\/script>/);
    });

    it('does not register a second consent restore in script.js', () => {
        const script = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
        assert.equal((script.match(/gtag\('consent'/g) || []).length, 0);
        assert.match(script, /NirFitMeasurement\.onConsentChange/);
        assert.match(script, /nirfitConsentBound/);
    });
});

describe('static audit of removed duplication and fake values', () => {
    it('production scripts no longer emit overlapping lead events or ₪40/30/25 values', () => {
        const files = ['script.js', 'measurement.js', 'index.html', 'whatsapp.html']
            .map((name) => ({ name, src: fs.readFileSync(path.join(root, name), 'utf8') }));

        files.forEach((file) => {
            assert.equal(file.src.includes('close_convert_lead'), false, file.name + ' still has close_convert_lead');
            assert.equal(file.src.includes('generate_lead'), false, file.name + ' still has generate_lead');
            assert.doesNotMatch(file.src, /value['"]?\s*:\s*40/);
            assert.doesNotMatch(file.src, /value['"]?\s*:\s*30/);
            assert.doesNotMatch(file.src, /value['"]?\s*:\s*25/);
        });

        const measurementSrc = files.find((f) => f.name === 'measurement.js').src;
        const scriptSrc = files.find((f) => f.name === 'script.js').src;
        assert.match(measurementSrc, /whatsapp_click/);
        assert.match(measurementSrc, /lead_submit/);
        assert.match(measurementSrc, /phone_click/);
        assert.match(measurementSrc, /V4FuCNuUsJEcELrWhr0D/);
        assert.equal(measurementSrc.includes('1pMZCKfLr5EcELrWhr0D'), false);
        assert.equal(measurementSrc.includes('nnPNCKTBu78cELrWhr0D'), false);
        assert.equal(scriptSrc.includes('querySelectorAll(\'a[href*="wa.me"]\')'), false);
        assert.equal(scriptSrc.includes('querySelectorAll(\'a[href^="tel:"]\')'), false);
    });

    it('index.html still has the live WhatsApp, phone and form CTAs that measurement binds', () => {
        const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
        const wa = html.match(/href="https:\/\/wa\.me\/972542063967/g) || [];
        const tel = html.match(/href="tel:\+972542063967"/g) || [];
        assert.equal(wa.length, 6);
        assert.equal(tel.length, 4);
        assert.match(html, /id="contactForm"/);
        assert.match(html, /id="G-F41R697N61"|gtag\/js\?id=G-F41R697N61/);
        assert.match(html, /AW-933342010/);
    });
});
