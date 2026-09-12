'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const formLead = require('../form-lead.js');

function read(name) {
    return fs.readFileSync(path.join(root, name), 'utf8');
}

function hiddenValue(html, name) {
    const match = html.match(new RegExp('<input[^>]*name="' + name + '"[^>]*>', 'i'));
    if (!match) return null;
    const value = match[0].match(/value="([^"]*)"/i);
    return value ? value[1] : '';
}

function cspContent(html) {
    const match = html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i);
    return match ? match[1] : '';
}

function connectSrcHosts(csp) {
    const match = csp.match(/connect-src\s+([^;]+)/i);
    return match ? match[1].trim().split(/\s+/) : [];
}

describe('canonical page and email subject', () => {
    it('normalizes city paths to a trailing-slash canonical page', () => {
        assert.equal(formLead.canonicalPage('/afula'), '/afula/');
        assert.equal(formLead.canonicalPage('/afula/'), '/afula/');
        assert.equal(formLead.canonicalPage('/afula/index.html'), '/afula/');
        assert.equal(formLead.canonicalPage('/kiryat-bialik'), '/kiryat-bialik/');
        assert.equal(formLead.canonicalPage('/kiryat-bialik/'), '/kiryat-bialik/');
        assert.equal(formLead.canonicalPage('/'), '/');
        assert.equal(formLead.canonicalPage('/index.html'), '/');
        assert.equal(formLead.canonicalPage(''), '/');
    });

    it('builds the manager-facing subject with city, page and name', () => {
        assert.equal(
            formLead.buildSubject('afula', '/afula/', 'דנה'),
            'NirFit ליד | afula | /afula/ | דנה'
        );
        assert.equal(
            formLead.buildSubject('', '/', 'יוסי'),
            'NirFit ליד |  | / | יוסי'
        );
    });

    it('puts ISO date, name, phone, city and page in the email body', () => {
        const body = formLead.buildEmailBody({
            date: '2026-09-12T18:22:00.000Z',
            name: 'דנה',
            phone: '0542063967',
            city: 'afula',
            page: '/afula/'
        });
        assert.match(body, /date: 2026-09-12T18:22:00\.000Z/);
        assert.match(body, /name: דנה/);
        assert.match(body, /phone: 0542063967/);
        assert.match(body, /city: afula/);
        assert.match(body, /page: \/afula\//);
    });

    it('builds a single UTF-8 ntfy line for the manager webhook', () => {
        assert.equal(
            formLead.buildWebhookBody({
                date: '2026-09-12T18:22:00.000Z',
                name: 'דנה',
                phone: '0542063967',
                city: 'afula',
                page: '/afula/'
            }),
            'NirFit ליד | 2026-09-12T18:22:00.000Z | דנה | 0542063967 | afula | /afula/'
        );
    });
});

describe('enrichFormData for Web3Forms', () => {
    it('sets subject, date, city, page and prepends the lead body to a user message', () => {
        const formData = new FormData();
        formData.set('name', 'דנה');
        formData.set('phone', '0542063967');
        formData.set('city', 'afula');
        formData.set('page', '/afula/');
        formData.set('message', 'מתעניינת באימון בוקר');

        const lead = formLead.enrichFormData(formData, {
            date: '2026-09-12T18:22:00.000Z'
        });

        assert.equal(lead.source, 'contact_form');
        assert.equal(lead.date, '2026-09-12T18:22:00.000Z');
        assert.equal(formData.get('subject'), 'NirFit ליד | afula | /afula/ | דנה');
        assert.equal(formData.get('date'), '2026-09-12T18:22:00.000Z');
        assert.match(formData.get('message'), /date: 2026-09-12T18:22:00\.000Z/);
        assert.match(formData.get('message'), /מתעניינת באימון בוקר/);
    });

    it('fills missing city/page from the page context', () => {
        const formData = new FormData();
        formData.set('name', 'יוסי');
        formData.set('phone', '0500000000');

        const lead = formLead.enrichFormData(formData, {
            date: '2026-09-12T18:22:00.000Z',
            city: 'kiryat-bialik',
            pathname: '/kiryat-bialik'
        });

        assert.equal(lead.city, 'kiryat-bialik');
        assert.equal(lead.page, '/kiryat-bialik/');
        assert.equal(formData.get('page'), '/kiryat-bialik/');
        assert.equal(formData.get('subject'), 'NirFit ליד | kiryat-bialik | /kiryat-bialik/ | יוסי');
    });
});

describe('optional manager webhook', () => {
    it('skips silently when the window constant and meta tag are empty', () => {
        const calls = [];
        const result = formLead.notifyWebhook(
            { date: '2026-09-12T18:22:00.000Z', source: 'contact_form' },
            {
                window: { NIRFIT_FORM_WEBHOOK: '' },
                document: { querySelector() { return null; } },
                fetch: () => { calls.push('fetch'); }
            }
        );
        assert.equal(result.sent, false);
        assert.equal(result.reason, 'empty');
        assert.equal(calls.length, 0);
        assert.equal(formLead.resolveWebhookUrl({
            window: { NIRFIT_FORM_WEBHOOK: '' },
            document: { querySelector() { return null; } }
        }), '');
    });

    it('prefers window.NIRFIT_FORM_WEBHOOK over the meta tag', () => {
        const url = formLead.resolveWebhookUrl({
            window: { NIRFIT_FORM_WEBHOOK: 'https://example.test/hook' },
            document: {
                querySelector() {
                    return { getAttribute() { return 'https://example.test/meta'; } };
                }
            }
        });
        assert.equal(url, 'https://example.test/hook');
    });

    it('falls back to meta[name="nirfit-form-webhook"] when the constant is empty', () => {
        const url = formLead.resolveWebhookUrl({
            window: { NIRFIT_FORM_WEBHOOK: '' },
            document: {
                querySelector(sel) {
                    return sel === 'meta[name="nirfit-form-webhook"]'
                        ? { getAttribute() { return 'https://example.test/meta'; } }
                        : null;
                }
            }
        });
        assert.equal(url, 'https://example.test/meta');
    });

    it('POSTs a plain-text ntfy line with keepalive and does not throw when fetch rejects', async () => {
        const calls = [];
        const result = formLead.notifyWebhook(
            {
                date: '2026-09-12T18:22:00.000Z',
                name: 'דנה',
                phone: '0542063967',
                city: 'afula',
                page: '/afula/',
                source: 'contact_form'
            },
            {
                url: 'https://ntfy.sh/nirfit-leads-51c1b3a4b8910d6309d9553bcf4c8121',
                fetch(url, opts) {
                    calls.push({ url, opts });
                    return Promise.reject(new Error('network down'));
                }
            }
        );
        assert.equal(result.sent, true);
        assert.equal(calls.length, 1);
        assert.equal(calls[0].url, 'https://ntfy.sh/nirfit-leads-51c1b3a4b8910d6309d9553bcf4c8121');
        assert.equal(calls[0].opts.method, 'POST');
        assert.equal(calls[0].opts.keepalive, true);
        assert.equal(calls[0].opts.headers['Content-Type'], 'text/plain; charset=utf-8');
        assert.equal(calls[0].opts.headers.Title, 'NirFit ליד');
        assert.equal(calls[0].opts.headers.Tags, 'envelope');
        assert.equal(calls[0].opts.headers.Priority, 'default');
        assert.equal(
            calls[0].opts.body,
            'NirFit ליד | 2026-09-12T18:22:00.000Z | דנה | 0542063967 | afula | /afula/'
        );
        assert.equal(calls[0].opts.body.includes('{'), false);
        await Promise.resolve();
    });

    it('swallows a synchronous fetch throw so success UI can still run', () => {
        assert.doesNotThrow(() => {
            const result = formLead.notifyWebhook(
                { source: 'contact_form' },
                {
                    url: 'https://example.test/hook',
                    fetch() { throw new Error('blocked'); }
                }
            );
            assert.equal(result.sent, false);
            assert.equal(result.reason, 'error');
        });
    });
});

describe('static HTML and script wiring', () => {
    it('wires the public ntfy.sh sink at the top of script.js', () => {
        const script = read('script.js');
        const helper = read('form-lead.js');
        assert.match(
            script,
            /window\.NIRFIT_FORM_WEBHOOK\s*=\s*'https:\/\/ntfy\.sh\/nirfit-leads-51c1b3a4b8910d6309d9553bcf4c8121';/
        );
        assert.ok(script.indexOf("window.NIRFIT_FORM_WEBHOOK = 'https://ntfy.sh/") < script.indexOf('Preloader'));
        assert.match(helper, /keepalive:\s*true/);
        assert.match(helper, /text\/plain; charset=utf-8/);
        assert.match(helper, /Title': 'NirFit ליד'/);
        assert.match(helper, /Tags': 'envelope'/);
        assert.match(helper, /Priority': 'default'/);
        assert.match(script, /source:\s*'contact_form'/);
        assert.match(script, /NirFit ליד/);
        assert.match(script, /nirfit-form-webhook/);
        assert.match(script, /NirFitMeasurement\.trackLeadSubmit/);
        assert.equal(script.includes('close_convert_lead'), false);
        assert.equal(script.includes('generate_lead'), false);
        assert.doesNotMatch(script, /send_to:\s*'AW-/);
        assert.equal(script.includes('crsr_'), false);
        assert.equal(helper.includes('crsr_'), false);
    });

    it('adds hidden city and page fields on homepage and both city forms', () => {
        const home = read('index.html');
        const afula = read('afula/index.html');
        const kiryat = read('kiryat-bialik/index.html');

        assert.equal(hiddenValue(home, 'city'), '');
        assert.equal(hiddenValue(home, 'page'), '/');
        assert.equal(hiddenValue(afula, 'city'), 'afula');
        assert.equal(hiddenValue(afula, 'page'), '/afula/');
        assert.equal(hiddenValue(kiryat, 'city'), 'kiryat-bialik');
        assert.equal(hiddenValue(kiryat, 'page'), '/kiryat-bialik/');

        [home, afula, kiryat].forEach((html) => {
            assert.match(html, /id="contactForm"/);
            assert.match(html, /form-lead\.js/);
            assert.match(
                html,
                /<meta name="nirfit-form-webhook" content="https:\/\/ntfy\.sh\/nirfit-leads-51c1b3a4b8910d6309d9553bcf4c8121">/
            );
            assert.equal(html.includes('crsr_'), false);
        });
    });

    it('keeps the city-page form below the hero WhatsApp CTA', () => {
        ['afula/index.html', 'kiryat-bialik/index.html'].forEach((name) => {
            const html = read(name);
            const heroWa = html.indexOf('class="btn btn-whatsapp btn-lg"');
            const heroEnd = html.indexOf('</section>');
            const contact = html.indexOf('id="contact"');
            const formAt = html.indexOf('id="contactForm"');
            assert.ok(heroWa !== -1 && heroWa < heroEnd, name + ' hero WhatsApp must stay in the first section');
            assert.ok(formAt > contact && contact > heroEnd, name + ' form must stay in #contact below the hero');
        });
    });

    it('allows https://ntfy.sh in connect-src and keeps web3forms', () => {
        ['index.html', 'afula/index.html', 'kiryat-bialik/index.html'].forEach((name) => {
            const hosts = connectSrcHosts(cspContent(read(name)));
            assert.ok(hosts.includes('https://api.web3forms.com'), name + ' must keep web3forms');
            assert.ok(hosts.includes('https://ntfy.sh'), name + ' connect-src must allow ntfy.sh');
        });
    });
});
