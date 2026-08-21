// ==============================
// Preloader — hide as soon as content is ready (critical for paid mobile traffic)
// ==============================
(function () {
    const hidePreloader = () => {
        const preloader = document.getElementById('preloader');
        if (!preloader || preloader.classList.contains('hidden')) return;
        preloader.classList.add('hidden');
        setTimeout(() => { if (preloader.parentNode) preloader.remove(); }, 400);
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(hidePreloader, 150));
    } else {
        setTimeout(hidePreloader, 150);
    }
    // Safety nets so the page is never left masked if something is slow
    window.addEventListener('load', hidePreloader);
    setTimeout(hidePreloader, 1200);
})();

document.addEventListener('DOMContentLoaded', () => {

    // ==============================
    // Typing Animation
    // ==============================
    const typingEl = document.getElementById('typingText');
    if (typingEl) {
        const phrases = [
            'ניר חמו | מאמן כושר אישי מקצועי',
            '13+ שנות ניסיון | 770+ מתאמנים',
            'סטודיו בקריות | אימונים בעפולה',
            'פגישת היכרות + בדיקת גוף - חינם!'
        ];
        let phraseIdx = 0, charIdx = 0, deleting = false;

        function typeLoop() {
            const current = phrases[phraseIdx];
            if (!deleting) {
                typingEl.textContent = current.substring(0, charIdx + 1);
                charIdx++;
                if (charIdx === current.length) {
                    deleting = true;
                    setTimeout(typeLoop, 2200);
                    return;
                }
                setTimeout(typeLoop, 60);
            } else {
                typingEl.textContent = current.substring(0, charIdx - 1);
                charIdx--;
                if (charIdx === 0) {
                    deleting = false;
                    phraseIdx = (phraseIdx + 1) % phrases.length;
                    setTimeout(typeLoop, 400);
                    return;
                }
                setTimeout(typeLoop, 30);
            }
        }
        setTimeout(typeLoop, 2000);
    }

    // ==============================
    // Sticky Mobile CTA
    // ==============================
    const stickyCta = document.getElementById('stickyCta');
    if (stickyCta) {
        const isMobile = () => window.innerWidth <= 768;
        // On mobile the quick call / WhatsApp bar is available immediately — no need to scroll first.
        if (isMobile()) stickyCta.classList.add('visible');
        let stickyShown = isMobile();
        window.addEventListener('scroll', () => {
            if (isMobile()) {
                if (!stickyShown) { stickyCta.classList.add('visible'); stickyShown = true; }
                return;
            }
            if (window.scrollY > 300 && !stickyShown) {
                stickyCta.classList.add('visible');
                stickyShown = true;
            } else if (window.scrollY <= 300 && stickyShown) {
                stickyCta.classList.remove('visible');
                stickyShown = false;
            }
        }, { passive: true });
    }

    // ==============================
    // Promo bar & navbar positioning
    // ==============================
    const promoBar = document.getElementById('promoBar');
    const navbar = document.getElementById('navbar');

    if (promoBar && navbar) {
        navbar.classList.add('has-promo');
    }

    // ==============================
    // Preserve gclid across the session
    // ==============================
    (function() {
        const urlParams = new URLSearchParams(window.location.search);
        const gclid = urlParams.get('gclid');
        if (gclid) {
            localStorage.setItem('gclid', gclid);
            localStorage.setItem('gclid_ts', Date.now());
        }
    })();

    // ==============================
    // Cookie Consent + Consent Mode v2
    // ==============================
    const cookieBanner = document.getElementById('cookieBanner');
    const cookieAccept = document.getElementById('cookieAccept');
    const cookieDecline = document.getElementById('cookieDecline');

    // Restore consent state for returning visitors
    const savedConsent = localStorage.getItem('cookieConsent');
    if (typeof gtag === 'function') {
        if (savedConsent === 'accepted') {
            gtag('consent', 'update', {
                'ad_storage': 'granted',
                'ad_user_data': 'granted',
                'ad_personalization': 'granted',
                'analytics_storage': 'granted'
            });
        }
    }

    if (cookieBanner && cookieAccept && cookieDecline) {
        if (!savedConsent) {
            setTimeout(() => {
                cookieBanner.classList.add('visible');
            }, 500);
        }

        const closeCookieBanner = (consent) => {
            localStorage.setItem('cookieConsent', consent);
            cookieBanner.classList.remove('visible');
        };

        cookieAccept.addEventListener('click', () => {
            closeCookieBanner('accepted');
            if (typeof gtag === 'function') {
                gtag('consent', 'update', {
                    'ad_storage': 'granted',
                    'ad_user_data': 'granted',
                    'ad_personalization': 'granted',
                    'analytics_storage': 'granted'
                });
            }
        });

        cookieDecline.addEventListener('click', () => {
            closeCookieBanner('essential');
            if (typeof gtag === 'function') {
                gtag('consent', 'update', {
                    'ad_storage': 'denied',
                    'ad_user_data': 'denied',
                    'ad_personalization': 'denied',
                    'analytics_storage': 'denied'
                });
            }
        });
    }

    // ==============================
    // Accessibility Widget - ת"י 5568
    // ==============================
    const a11yToggle = document.getElementById('a11yToggle');
    const a11yPanel = document.getElementById('a11yPanel');
    const a11yClose = document.getElementById('a11yClose');
    let fontSizeLevel = 0;

    const openA11yPanel = () => {
        if (!a11yPanel || !a11yToggle) return;
        a11yPanel.classList.add('visible');
        a11yPanel.setAttribute('aria-hidden', 'false');
        a11yToggle.setAttribute('aria-expanded', 'true');
        a11yToggle.setAttribute('aria-label', 'סגור תפריט נגישות');
    };

    const closeA11yPanel = () => {
        if (!a11yPanel || !a11yToggle) return;
        a11yPanel.classList.remove('visible');
        a11yPanel.setAttribute('aria-hidden', 'true');
        a11yToggle.setAttribute('aria-expanded', 'false');
        a11yToggle.setAttribute('aria-label', 'פתח תפריט נגישות - התאמות להקלת הגלישה');
        a11yToggle.focus();
    };

    if (a11yToggle && a11yPanel && a11yClose) {
        a11yToggle.addEventListener('click', () => {
            const isOpen = a11yPanel.classList.contains('visible');
            isOpen ? closeA11yPanel() : openA11yPanel();
        });

        a11yClose.addEventListener('click', closeA11yPanel);

        a11yPanel.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeA11yPanel();
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.a11y-widget')) {
                if (a11yPanel.classList.contains('visible')) closeA11yPanel();
            }
        });
    }

    document.querySelectorAll('.a11y-option').forEach(option => {
        option.addEventListener('click', () => {
            const action = option.dataset.action;
            switch (action) {
                case 'fontIncrease':
                    fontSizeLevel = Math.min(fontSizeLevel + 1, 4);
                    document.documentElement.style.fontSize = (16 + fontSizeLevel * 2) + 'px';
                    break;
                case 'fontDecrease':
                    fontSizeLevel = Math.max(fontSizeLevel - 1, -2);
                    document.documentElement.style.fontSize = (16 + fontSizeLevel * 2) + 'px';
                    break;
                case 'contrast':
                    document.body.classList.toggle('a11y-high-contrast');
                    break;
                case 'links':
                    document.body.classList.toggle('a11y-highlight-links');
                    break;
                case 'readable':
                    document.body.classList.toggle('a11y-readable-font');
                    break;
                case 'reset':
                    fontSizeLevel = 0;
                    document.documentElement.style.fontSize = '16px';
                    document.body.classList.remove('a11y-high-contrast', 'a11y-highlight-links', 'a11y-readable-font');
                    break;
            }
        });
    });

    // ==============================
    // Navbar scroll effect
    // ==============================
    const handleScroll = () => {
        if (navbar) {
            if (window.scrollY > 80) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    // ==============================
    // Mobile navigation toggle
    // ==============================
    const navToggle = document.getElementById('navToggle');
    const navLinks = document.getElementById('navLinks');

    if (navToggle && navLinks) {
        navToggle.addEventListener('click', () => {
            const isOpen = navLinks.classList.contains('active');
            navToggle.classList.toggle('active');
            navLinks.classList.toggle('active');
            navToggle.setAttribute('aria-expanded', !isOpen);
            navToggle.setAttribute('aria-label', isOpen ? 'פתח תפריט ניווט' : 'סגור תפריט ניווט');
            document.body.style.overflow = navLinks.classList.contains('active') ? 'hidden' : '';
        });

        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                navToggle.classList.remove('active');
                navLinks.classList.remove('active');
                document.body.style.overflow = '';
            });
        });
    }

    // ==============================
    // Smooth scroll for anchor links
    // ==============================
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                const offset = 80;
                const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - offset;
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });

    // ==============================
    // Counter animation
    // ==============================
    const animateCounters = () => {
        const counters = document.querySelectorAll('[data-target]');

        counters.forEach(counter => {
            if (counter.dataset.animated) return;

            const rect = counter.getBoundingClientRect();
            if (rect.top < window.innerHeight * 0.85) {
                counter.dataset.animated = 'true';
                const target = parseInt(counter.dataset.target);
                const duration = 2000;
                const startTime = performance.now();

                const updateCounter = (currentTime) => {
                    const elapsed = currentTime - startTime;
                    const progress = Math.min(elapsed / duration, 1);
                    const easeOut = 1 - Math.pow(1 - progress, 3);
                    counter.textContent = Math.floor(target * easeOut);

                    if (progress < 1) {
                        requestAnimationFrame(updateCounter);
                    } else {
                        counter.textContent = target;
                    }
                };

                requestAnimationFrame(updateCounter);
            }
        });
    };

    window.addEventListener('scroll', animateCounters, { passive: true });
    animateCounters();

    // ==============================
    // Testimonials slider
    // ==============================
    const track = document.getElementById('testimonialsTrack');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const dotsContainer = document.getElementById('sliderDots');
    const cards = track ? track.querySelectorAll('.testimonial-card') : [];
    let currentSlide = 0;
    const totalCards = cards.length;
    let autoSlideInterval;

    if (track && prevBtn && nextBtn && dotsContainer && totalCards > 0) {
    function getVisibleCards() {
        if (window.innerWidth <= 600) return 1;
        if (window.innerWidth <= 992) return 2;
        return 3;
    }

    function getGap() {
        if (window.innerWidth <= 600) return 0;
        return 24;
    }

    function getTotalPositions() {
        return Math.max(1, totalCards - getVisibleCards() + 1);
    }

    function buildDots() {
        dotsContainer.innerHTML = '';
        const positions = getTotalPositions();
        for (let i = 0; i < positions; i++) {
            const dot = document.createElement('button');
            dot.type = 'button';
            dot.classList.add('slider-dot');
            dot.setAttribute('role', 'tab');
            dot.setAttribute('aria-label', `המלצה ${i + 1} מתוך ${positions}`);
            dot.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
            if (i === 0) dot.classList.add('active');
            dot.addEventListener('click', () => goToSlide(i));
            dotsContainer.appendChild(dot);
        }
    }

    const updateSlider = () => {
        const visible = getVisibleCards();
        const gap = getGap();
        const cardWidth = (track.offsetWidth - gap * (visible - 1)) / visible;
        const offset = currentSlide * (cardWidth + gap);
        track.style.transform = `translateX(${offset}px)`;
        dotsContainer.querySelectorAll('.slider-dot').forEach((dot, i) => {
            dot.classList.toggle('active', i === currentSlide);
            dot.setAttribute('aria-selected', i === currentSlide ? 'true' : 'false');
        });
    };

    const goToSlide = (index) => {
        const maxPos = getTotalPositions() - 1;
        currentSlide = Math.min(index, maxPos);
        updateSlider();
        resetAutoSlide();
    };

    const nextSlide = () => {
        const maxPos = getTotalPositions() - 1;
        currentSlide = currentSlide >= maxPos ? 0 : currentSlide + 1;
        updateSlider();
    };

    const prevSlide = () => {
        const maxPos = getTotalPositions() - 1;
        currentSlide = currentSlide <= 0 ? maxPos : currentSlide - 1;
        updateSlider();
    };

    nextBtn.addEventListener('click', () => { nextSlide(); resetAutoSlide(); });
    prevBtn.addEventListener('click', () => { prevSlide(); resetAutoSlide(); });

    const startAutoSlide = () => { autoSlideInterval = setInterval(nextSlide, 12000); };
    const resetAutoSlide = () => { clearInterval(autoSlideInterval); startAutoSlide(); };

    buildDots();
    startAutoSlide();

    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            currentSlide = Math.min(currentSlide, getTotalPositions() - 1);
            buildDots();
            updateSlider();
        }, 200);
    });

    let touchStartX = 0;
    track.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    track.addEventListener('touchend', (e) => {
        const diff = touchStartX - e.changedTouches[0].screenX;
        if (Math.abs(diff) > 50) {
            diff < 0 ? nextSlide() : prevSlide();
            resetAutoSlide();
        }
    }, { passive: true });
    }

    // ==============================
    // Scroll reveal animation
    // ==============================
    const revealElements = () => {
        const elements = document.querySelectorAll(
            '.service-card, .location-card, .pricing-card, .pricing-table-wrap, .contact-item, .about-content, .consult-step, .faq-item, .calc-card, .consultation-cta-card, .gallery-item, .why-me-item, .target-card'
        );

        elements.forEach(el => {
            if (!el.classList.contains('reveal')) {
                el.classList.add('reveal');
            }
            const rect = el.getBoundingClientRect();
            if (rect.top < window.innerHeight * 0.88) {
                el.classList.add('visible');
            }
        });
    };

    window.addEventListener('scroll', revealElements, { passive: true });
    setTimeout(revealElements, 100);

    // ==============================
    // Hero particles
    // ==============================
    const particlesContainer = document.getElementById('particles');

    for (let i = 0; i < 25; i++) {
        const particle = document.createElement('div');
        const size = Math.random() * 4 + 1;
        particle.style.cssText = `
            position: absolute;
            width: ${size}px;
            height: ${size}px;
            background: rgba(255, 107, 53, ${Math.random() * 0.25 + 0.05});
            border-radius: 50%;
            top: ${Math.random() * 100}%;
            left: ${Math.random() * 100}%;
            animation: float ${Math.random() * 8 + 6}s ease-in-out infinite;
            animation-delay: ${Math.random() * 5}s;
        `;
        particlesContainer.appendChild(particle);
    }

    // ==============================
    // BMI Calculator
    // ==============================
    const calcBtn = document.getElementById('calcBtn');
    const calcResult = document.getElementById('calcResult');
    const bmiValue = document.getElementById('bmiValue');
    const bmiCategory = document.getElementById('bmiCategory');
    const bmiNote = document.getElementById('bmiNote');

    calcBtn.addEventListener('click', () => {
        const height = parseFloat(document.getElementById('calcHeight').value);
        const weight = parseFloat(document.getElementById('calcWeight').value);

        if (!height || !weight || height < 100 || height > 250 || weight < 30 || weight > 300) {
            calcResult.style.display = 'none';
            return;
        }

        const heightM = height / 100;
        const bmi = weight / (heightM * heightM);
        const bmiRounded = Math.round(bmi * 10) / 10;

        bmiValue.textContent = bmiRounded;
        calcResult.style.display = 'block';

        bmiCategory.className = 'result-category';

        if (bmi < 18.5) {
            bmiCategory.textContent = 'תת משקל';
            bmiCategory.classList.add('underweight');
            bmiNote.textContent = 'מומלץ להתייעץ עם מאמן ותזונאי לגבי העלאת משקל בריאה.';
        } else if (bmi < 25) {
            bmiCategory.textContent = 'משקל תקין';
            bmiCategory.classList.add('normal');
            bmiNote.textContent = 'מעולה! אתה בטווח הבריא. בוא נשמור על זה ונשפר את הכושר!';
        } else if (bmi < 30) {
            bmiCategory.textContent = 'עודף משקל';
            bmiCategory.classList.add('overweight');
            bmiNote.textContent = 'אל דאגה - עם תוכנית מותאמת אפשר להגיע ליעד. בוא נתחיל!';
        } else {
            bmiCategory.textContent = 'השמנה';
            bmiCategory.classList.add('obese');
            bmiNote.textContent = 'הצעד הראשון הוא החשוב ביותר. בוא נבנה תוכנית שתעבוד בשבילך.';
        }

        calcResult.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });

    // ==============================
    // FAQ Accordion
    // ==============================
    document.querySelectorAll('.faq-question').forEach(question => {
        question.addEventListener('click', () => {
            const item = question.parentElement;
            const answer = item?.querySelector('.faq-answer');
            if (!answer) return;
            const isActive = item.classList.contains('active');

            document.querySelectorAll('.faq-item').forEach(otherItem => {
                otherItem.classList.remove('active');
                const otherAnswer = otherItem.querySelector('.faq-answer');
                const otherQuestion = otherItem.querySelector('.faq-question');
                if (otherAnswer) otherAnswer.style.maxHeight = '0';
                if (otherQuestion) otherQuestion.setAttribute('aria-expanded', 'false');
            });

            if (!isActive) {
                item.classList.add('active');
                answer.style.maxHeight = answer.scrollHeight + 'px';
                question.setAttribute('aria-expanded', 'true');
            }
        });
    });

    // ==============================
    // Contact form handling
    // ==============================
    const contactForm = document.getElementById('contactForm');

    if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const submitBtn = contactForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> שולח...';
        submitBtn.disabled = true;

        const formData = new FormData(contactForm);

        const locationMap = {
            'krayot': 'סטודיו קריית ביאליק',
            'afula': 'חדר כושר עפולה',
            'both': 'שניהם'
        };

        const goalMap = {
            'weight-loss': 'ירידה במשקל',
            'muscle': 'בניית שריר',
            'fitness': 'שיפור כושר',
            'health': 'בריאות כללית',
            'post-birth': 'חזרה אחרי לידה',
            'other': 'אחר'
        };

        const location = formData.get('location');
        const goal = formData.get('goal');
        if (location) formData.set('location', locationMap[location] || location);
        if (goal) formData.set('goal', goalMap[goal] || goal);
        formData.append('subject', 'פנייה חדשה מהאתר - NIRFIT');

        const accessKey = formData.get('access_key');
        if (!accessKey || accessKey === 'YOUR_ACCESS_KEY_HERE') {
            submitBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> יש להגדיר מפתח גישה';
            submitBtn.style.background = '#e74c3c';
            submitBtn.style.borderColor = '#e74c3c';
            submitBtn.disabled = false;
            setTimeout(() => {
                submitBtn.innerHTML = originalText;
                submitBtn.style.background = '';
                submitBtn.style.borderColor = '';
            }, 3000);
            return;
        }

        fetch(contactForm.action, {
            method: 'POST',
            body: formData,
            headers: { 'Accept': 'application/json' }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                contactForm.reset();
                // GA4 + Google Ads conversion tracking - fires on successful form submission
                if (typeof gtag === 'function') {
                    // Enhanced Conversions for Leads - normalized phone (E.164) for cookieless matching
                    try {
                        var _phone = (formData.get('phone') || '').toString();
                        var _e164 = _phone.replace(/\D/g, '');
                        if (_e164.indexOf('972') === 0) { _e164 = '+' + _e164; }
                        else if (_e164.charAt(0) === '0') { _e164 = '+972' + _e164.slice(1); }
                        else if (_e164) { _e164 = '+972' + _e164; }
                        if (_e164.length >= 12) { gtag('set', 'user_data', { 'phone_number': _e164 }); }
                    } catch (e) {}
                    gtag('event', 'close_convert_lead', {
                        'event_category': 'lead',
                        'event_label': 'contact_form',
                        'send_to': ['G-F41R697N61', 'AW-933342010']
                    });
                    // Google Ads generate_lead event - standard event for lead forms
                    gtag('event', 'generate_lead', {
                        'event_category': 'lead',
                        'event_label': 'contact_form',
                        'send_to': ['G-F41R697N61', 'AW-933342010']
                    });
                    // Google Ads Specific Conversion
                    gtag('event', 'conversion', {
                        'send_to': 'AW-933342010/' + '1pMZCKfLr5EcELrWhr0D',
                        'value': 40.0,
                        'currency': 'ILS'
                    });
                }
                contactForm.classList.add('hidden');
                const successMsg = document.getElementById('formSuccessMessage');
                if (successMsg) {
                    successMsg.classList.add('visible');
                    successMsg.setAttribute('aria-hidden', 'false');
                }
                submitBtn.innerHTML = '<i class="fas fa-check"></i> נשלח בהצלחה!';
                submitBtn.style.background = '#25d366';
                submitBtn.style.borderColor = '#25d366';
            } else {
                submitBtn.innerHTML = '<i class="fas fa-times"></i> שגיאה, נסו שוב';
                submitBtn.style.background = '#e74c3c';
                submitBtn.style.borderColor = '#e74c3c';
            }
        })
        .catch(() => {
            submitBtn.innerHTML = '<i class="fas fa-times"></i> שגיאה, נסו שוב';
            submitBtn.style.background = '#e74c3c';
            submitBtn.style.borderColor = '#e74c3c';
        })
        .finally(() => {
            submitBtn.disabled = false;
            setTimeout(() => {
                submitBtn.innerHTML = originalText;
                submitBtn.style.background = '';
                submitBtn.style.borderColor = '';
            }, 3000);
        });
    });
    }

    // ==============================
    // Active nav link on scroll
    // ==============================
    const sections = document.querySelectorAll('section[id]');

    const updateActiveNav = () => {
        if (!navLinks) return;
        const scrollPos = window.scrollY + 150;

        sections.forEach(section => {
            const top = section.offsetTop;
            const height = section.offsetHeight;
            const id = section.getAttribute('id');

            if (scrollPos >= top && scrollPos < top + height) {
                navLinks.querySelectorAll('a').forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === `#${id}`) {
                        link.classList.add('active');
                    }
                });
            }
        });
    };

    window.addEventListener('scroll', updateActiveNav, { passive: true });

    // ==============================
    // Promo bar hide on scroll
    // ==============================
    let lastScroll = 0;
    window.addEventListener('scroll', () => {
        if (window.scrollY > 200 && promoBar) {
            promoBar.style.transform = 'translateY(-100%)';
            promoBar.style.transition = 'transform 0.3s ease';
            navbar.classList.remove('has-promo');
        } else if (promoBar) {
            promoBar.style.transform = '';
            if (!navbar.classList.contains('scrolled')) {
                navbar.classList.add('has-promo');
            }
        }
        lastScroll = window.scrollY;
    }, { passive: true });


    // ==============================
    // WhatsApp click tracking
    // ==============================
    document.querySelectorAll('a[href*="wa.me"]').forEach(link => {
        link.addEventListener('click', function (e) {
            if (typeof gtag !== 'function') return;
            // Wrap navigation so the conversion beacon is sent before the page unloads
            e.preventDefault();
            var _url = this.href;
            var _done = false;
            var _go = function () { if (_done) return; _done = true; window.location.href = _url; };
            var _src = this.classList.contains('whatsapp-float') ? 'wa_float'
                     : this.classList.contains('sticky-cta-wa') ? 'wa_sticky'
                     : 'wa_section';
            gtag('event', 'close_convert_lead', {
                'event_category': 'lead',
                'event_label': _src,
                'send_to': ['G-F41R697N61', 'AW-933342010']
            });
            // Google Ads Specific Conversion (WhatsApp Click)
            gtag('event', 'conversion', {
                'send_to': 'AW-933342010/' + 'V4FuCNuUsJEcELrWhr0D',
                'value': 30.0,
                'currency': 'ILS',
                'transport_type': 'beacon',
                'event_callback': _go
            });
            setTimeout(_go, 900);
        });
    });

    // ==============================
    // Phone click tracking
    // ==============================
    document.querySelectorAll('a[href^="tel:"]').forEach(link => {
        link.addEventListener('click', function (e) {
            if (typeof gtag !== 'function') return;
            // Wrap navigation so the conversion beacon is sent before the page unloads (mobile dialer)
            e.preventDefault();
            var _url = this.href;
            var _done = false;
            var _go = function () { if (_done) return; _done = true; window.location.href = _url; };
            gtag('event', 'close_convert_lead', {
                'event_category': 'lead',
                'event_label': 'phone_click',
                'send_to': ['G-F41R697N61', 'AW-933342010']
            });
            // Google Ads Specific Conversion (Phone Click)
            gtag('event', 'conversion', {
                'send_to': 'AW-933342010/' + 'nnPNCKTBu78cELrWhr0D',
                'value': 25.0,
                'currency': 'ILS',
                'transport_type': 'beacon',
                'event_callback': _go
            });
            setTimeout(_go, 900);
        });
    });
});
