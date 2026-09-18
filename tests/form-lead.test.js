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

function selectedOptionValue(html, selectId) {
    const select = html.match(new RegExp('<select[^>]*id="' + selectId + '"[^>]*>[\\s\\S]*?<\\/select>', 'i'));
    if (!select) return null;
    const selected = select[0].match(/<option[^>]*value="([^"]*)"[^>]*selected/i)
        || select[0].match(/<option[^>]*selected[^>]*value="([^"]*)"/i);
    return selected ? selected[1] : null;
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

describe('static HTML and script wiring', () => {
    it('script.js has no public ntfy.sh webhook and form-lead.js delivers via Web3Forms only', () => {
        const script = read('script.js');
        const helper = read('form-lead.js');
        // ntfy must be gone from client code
        assert.equal(script.includes('ntfy.sh'), false, 'script.js must not reference ntfy.sh');
        assert.equal(script.includes('NIRFIT_FORM_WEBHOOK'), false, 'script.js must not set NIRFIT_FORM_WEBHOOK');
        assert.equal(helper.includes('ntfy.sh'), false, 'form-lead.js must not reference ntfy.sh');
        assert.equal(helper.includes('notifyWebhook'), false, 'form-lead.js must not export notifyWebhook');
        // Web3Forms wiring stays intact
        assert.match(script, /source:\s*'contact_form'/);
        assert.match(script, /NirFit ליד/);
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
        assert.equal(selectedOptionValue(afula, 'contactLocation'), 'afula');
        assert.equal(selectedOptionValue(kiryat, 'contactLocation'), 'kiryat-bialik');
        assert.match(kiryat, /<option value="kiryat-bialik" selected>קריית ביאליק — סטודיו<\/option>/);
        assert.doesNotMatch(kiryat, /<option value="krayot"/);

        [home, afula, kiryat].forEach((html) => {
            assert.match(html, /id="contactForm"/);
            assert.match(html, /form-lead\.js/);
            // ntfy meta tag must be gone from all pages
            assert.equal(html.includes('nirfit-form-webhook'), false, 'ntfy meta tag must not appear in ' + html.slice(0, 50));
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

    it('connect-src allows web3forms but NOT ntfy.sh', () => {
        ['index.html', 'afula/index.html', 'kiryat-bialik/index.html'].forEach((name) => {
            const hosts = connectSrcHosts(cspContent(read(name)));
            assert.ok(hosts.includes('https://api.web3forms.com'), name + ' must keep web3forms');
            assert.equal(hosts.includes('https://ntfy.sh'), false, name + ' must NOT expose ntfy.sh in connect-src');
        });
    });
});
