// PAYAMAKE Main JavaScript

document.addEventListener("DOMContentLoaded", function () {

    // index.html currently includes main.js twice. Guard the initializer so
    // the contact form can never register duplicate handlers.
    if (window.__PAYAMAKE_MAIN_INITIALIZED__) return;
    window.__PAYAMAKE_MAIN_INITIALIZED__ = true;

    /* =========================================================
       PRICING CALCULATOR
    ========================================================= */

    const volumeRange = document.getElementById("volumeRange");
    const volumeValue = document.getElementById("volumeValue");
    const customerLevel = document.getElementById("customerLevel");
    const priceValue = document.getElementById("priceValue");
    const pricingBox = document.querySelector(".premium-pricing-box");
    const pricingButton = document.querySelector(".pricing-benefits .primary-button");
    const pricingControl = document.querySelector(".pricing-control");
    const originalButtonParent = pricingButton ? pricingButton.parentElement : null;

    if (
        volumeRange && volumeValue && customerLevel && priceValue &&
        pricingBox && pricingButton && pricingControl && originalButtonParent
    ) {
        const benefitsBox = pricingBox.querySelector(".pricing-benefits");
        const mobileMediaQuery = window.matchMedia("(max-width: 768px)");

        function updatePricing() {
            const volume = Number(volumeRange.value);

            volumeValue.innerText = volume.toLocaleString("fa-IR") + " پیامک";

            const min = Number(volumeRange.min);
            const max = Number(volumeRange.max);
            const percentage = ((volume - min) / (max - min)) * 100;

            volumeRange.style.background = `linear-gradient(
                to left,
                #00e0e6 0%,
                #00e0e6 ${percentage}%,
                #e2e8f0 ${percentage}%,
                #e2e8f0 100%
            )`;

            if (volume <= 100000) {
                customerLevel.innerText = "مشتری عادی";
                priceValue.innerText = "270 تومان";
            } else if (volume <= 500000) {
                customerLevel.innerText = "VIP";
                priceValue.innerText = "240 تومان";
            } else if (volume < 1000000) {
                customerLevel.innerText = "VIP حجیم";
                priceValue.innerText = "220 تومان";
            } else {
                customerLevel.innerText = "سازمانی";
                priceValue.innerText = "تعرفه اختصاصی";
            }

            const isEnterprise = volume >= 1000000;

            if (isEnterprise) {
                pricingBox.classList.add("enterprise-mode");
                if (benefitsBox) benefitsBox.classList.add("enterprise-mode");

                pricingButton.innerText = "درخواست مشاوره سازمانی";

                if (mobileMediaQuery.matches && pricingButton.parentElement !== pricingControl) {
                    pricingControl.appendChild(pricingButton);
                }

                if (!mobileMediaQuery.matches && pricingButton.parentElement !== originalButtonParent) {
                    originalButtonParent.appendChild(pricingButton);
                }

                pricingButton.classList.add("enterprise-button");
            } else {
                pricingBox.classList.remove("enterprise-mode");
                if (benefitsBox) benefitsBox.classList.remove("enterprise-mode");

                pricingButton.innerText = "دریافت تعرفه اختصاصی";

                if (pricingButton.parentElement !== originalButtonParent) {
                    originalButtonParent.appendChild(pricingButton);
                }

                pricingButton.classList.remove("enterprise-button");
            }
        }

        volumeRange.addEventListener("input", updatePricing);
        mobileMediaQuery.addEventListener("change", updatePricing);
        updatePricing();
    }

    /* =========================================================
       CONTACT MODAL
    ========================================================= */

    const contactModal = document.getElementById("contactModal");
    const contactModalClose = document.getElementById("contactModalClose");
    const contactModalOverlay = contactModal
        ? contactModal.querySelector(".contact-modal-overlay")
        : null;
    const contactForm = document.getElementById("contactForm");
    const contactFormMessage = document.getElementById("contactFormMessage");

    if (contactModal) {

        let contactModalTrigger = null;

        function resetContactFormState() {
            if (contactForm) {
                contactForm.reset();
            }

            const contactType = document.getElementById("contactType");
            const customNeedField = document.getElementById("contactCustomNeedGroup");
            const messageTextarea = document.getElementById("contactMessage");

            if (contactType) contactType.value = "";
            if (customNeedField) customNeedField.hidden = true;
            if (messageTextarea) messageTextarea.value = "";

            document.querySelectorAll(".contact-field-limit-message").forEach(function (message) {
                message.style.display = "none";
                message.classList.remove("is-visible");
            });

            if (contactFormMessage) {
                contactFormMessage.innerText = "";
                contactFormMessage.classList.remove("is-visible");
            }
        }

        function addOptionalContactFields() {
            if (!contactForm || document.getElementById("contactBrand")) return;

            const messageField = document.getElementById("contactMessage");
            const messageGroup = messageField
                ? messageField.closest(".contact-form-group")
                : null;

            if (!messageGroup) return;

            const brandGroup = document.createElement("div");
            brandGroup.className = "contact-form-group";
            brandGroup.innerHTML = `
                <label for="contactBrand" title="حداکثر ۲۵ کاراکتر">
                    نام برند / کسب‌وکار
                    <span>(اختیاری)</span>
                </label>
                <input
                    type="text"
                    id="contactBrand"
                    name="brand"
                    placeholder="نام برند یا کسب‌وکار"
                    autocomplete="organization"
                    maxlength="25"
                    title="حداکثر ۲۵ کاراکتر"
                >
            `;

            const typeGroup = document.createElement("div");
            typeGroup.className = "contact-form-group";
            typeGroup.innerHTML = `
                <label for="contactType">
                    نیاز شما
                    <span>(اختیاری)</span>
                </label>
                <select id="contactType" name="type">
                    <option value="" selected disabled>انتخاب کنید</option>
                    <option value="مشاوره پیامکی">مشاوره پیامکی</option>
                    <option value="بانک شماره">بانک شماره</option>
                    <option value="تعرفه و قیمت">تعرفه و قیمت</option>
                    <option value="اجرای کمپین">اجرای کمپین</option>
                    <option value="سایر">سایر</option>
                </select>
            `;

            // Reuse the existing description textarea as the ONLY custom-need field.
            // It stays optional and is hidden until "سایر" is selected.
            messageGroup.id = "contactCustomNeedGroup";

            const messageLabel = messageGroup.querySelector("label");
            const messageTextarea = messageGroup.querySelector("textarea");

            if (messageLabel) {
                messageLabel.textContent = "نیاز خود را توضیح دهید (اختیاری)";
                messageLabel.setAttribute("for", "contactMessage");
                messageLabel.title = "حداکثر ۲۵ کاراکتر";
            }

            if (messageTextarea) {
                messageTextarea.placeholder = "نیاز خود را توضیح دهید...";
                messageTextarea.maxLength = 25;
                messageTextarea.title = "حداکثر ۲۵ کاراکتر";
            }

            // Hide the single existing textarea until "سایر" is selected.
            messageGroup.hidden = true;

            contactForm.insertBefore(brandGroup, messageGroup);
            contactForm.insertBefore(typeGroup, messageGroup);

            function setupPatternLimit(field, group) {
                if (!field || !group) return;

                field.maxLength = 25;
                field.title = "حداکثر ۲۵ کاراکتر";

                const limitMessage = document.createElement("div");
                limitMessage.className = "contact-field-limit-message";
                limitMessage.textContent = "حداکثر ۲۵ کاراکتر مجاز است.";
                limitMessage.setAttribute("role", "status");
                limitMessage.style.cssText = [
                    "display:none",
                    "margin-top:4px",
                    "font-size:11px",
                    "line-height:1.5",
                    "color:#dc2626"
                ].join(";");

                group.appendChild(limitMessage);

                function showLimitMessage() {
                    limitMessage.style.display = "block";
                    limitMessage.classList.add("is-visible");
                }

                function hideLimitMessage() {
                    limitMessage.style.display = "none";
                    limitMessage.classList.remove("is-visible");
                }

                field.addEventListener("input", function () {
                    if (field.value.length < 25) {
                        hideLimitMessage();
                    }
                });

                field.addEventListener("keydown", function (event) {
                    if (field.value.length < 25) return;

                    const allowedKeys = [
                        "Backspace",
                        "Delete",
                        "ArrowLeft",
                        "ArrowRight",
                        "ArrowUp",
                        "ArrowDown",
                        "Home",
                        "End",
                        "Tab"
                    ];

                    if (
                        !allowedKeys.includes(event.key) &&
                        !event.ctrlKey &&
                        !event.metaKey
                    ) {
                        event.preventDefault();
                        showLimitMessage();
                    }
                });

                field.addEventListener("paste", function (event) {
                    const pastedText = event.clipboardData
                        ? event.clipboardData.getData("text")
                        : "";

                    if (field.value.length + pastedText.length > 25) {
                        event.preventDefault();
                        showLimitMessage();
                    }
                });
            }

            const fullNameField =
                contactForm.elements.namedItem("name") ||
                contactForm.elements.namedItem("fullName") ||
                contactForm.elements.namedItem("fullname") ||
                contactForm.elements.namedItem("full_name") ||
                document.getElementById("contactName") ||
                document.getElementById("fullName");

            const fullNameGroup = fullNameField
                ? fullNameField.closest(".contact-form-group")
                : null;

            if (fullNameField && fullNameGroup) {
                setupPatternLimit(fullNameField, fullNameGroup);
            }

            setupPatternLimit(
                document.getElementById("contactBrand"),
                brandGroup
            );

            setupPatternLimit(
                messageTextarea,
                messageGroup
            );

            const contactType = document.getElementById("contactType");

            if (contactType) {
                contactType.addEventListener("change", function () {
                    const isOther = contactType.value === "سایر";

                    messageGroup.hidden = !isOther;

                    if (!isOther && messageTextarea) {
                        messageTextarea.value = "";
                    }

                    if (!isOther) {
                        const limitMessage = messageGroup.querySelector(
                            ".contact-field-limit-message"
                        );

                        if (limitMessage) {
                            limitMessage.style.display = "none";
                            limitMessage.classList.remove("is-visible");
                        }
                    }
                });
            }
        }

        addOptionalContactFields();

        function getModalFocusableElements() {
            return Array.from(
                contactModal.querySelectorAll(
                    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
                )
            ).filter(function (element) {
                return !element.hidden && element.getClientRects().length > 0;
            });
        }

        function openContactModal(trigger) {
            contactModalTrigger = trigger || document.activeElement;
            resetContactFormState();

            contactModal.classList.add("is-open");
            contactModal.setAttribute("aria-hidden", "false");
            document.body.classList.add("modal-open");

            const firstInput = contactModal.querySelector(
                "input, select, textarea"
            );

            if (firstInput) {
                setTimeout(function () {
                    firstInput.focus();
                }, 100);
            }
        }

        function closeContactModal() {
            contactModal.classList.remove("is-open");
            contactModal.setAttribute("aria-hidden", "true");
            document.body.classList.remove("modal-open");

            if (
                contactModalTrigger &&
                document.contains(contactModalTrigger) &&
                typeof contactModalTrigger.focus === "function"
            ) {
                setTimeout(function () {
                    contactModalTrigger.focus();
                }, 0);
            }

            contactModalTrigger = null;
        }

        const contactButtons = document.querySelectorAll('a[href="#"]');

        contactButtons.forEach(function (button) {
            const buttonText = button.innerText.trim();

            const isContactButton =
                buttonText.includes("مشاوره") ||
                buttonText.includes("شروع همکاری") ||
                buttonText.includes("درخواست مشاوره") ||
                buttonText.includes("تعرفه");

            if (!isContactButton) return;

            button.addEventListener("click", function (event) {
                event.preventDefault();
                openContactModal(button);
            });
        });

        if (contactModalClose) {
            contactModalClose.addEventListener("click", function () {
                closeContactModal();
            });
        }

        if (contactModalOverlay) {
            contactModalOverlay.addEventListener("click", function () {
                closeContactModal();
            });
        }

        document.addEventListener("keydown", function (event) {
            if (!contactModal.classList.contains("is-open")) return;

            if (event.key === "Escape") {
                closeContactModal();
                return;
            }

            if (event.key !== "Tab") return;

            const focusableElements = getModalFocusableElements();

            if (!focusableElements.length) return;

            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            if (event.shiftKey && document.activeElement === firstElement) {
                event.preventDefault();
                lastElement.focus();
            } else if (!event.shiftKey && document.activeElement === lastElement) {
                event.preventDefault();
                firstElement.focus();
            }
        });

        /* =====================================================
           CONTACT FORM → CLOUDFLARE WORKER
        ========================================================= */

        if (contactForm) {
            contactForm.addEventListener("submit", async function (event) {
                event.preventDefault();

                const submitButton = contactForm.querySelector(
                    'button[type="submit"], input[type="submit"]'
                );

                const originalButtonText = submitButton
                    ? (submitButton.innerText || submitButton.value)
                    : "";

                function readField(names) {
                    for (const name of names) {
                        const byName = contactForm.elements.namedItem(name);

                        if (byName) {
                            return String(byName.value || "").trim();
                        }

                        const byId = document.getElementById(name);

                        if (byId && contactForm.contains(byId)) {
                            return String(byId.value || "").trim();
                        }
                    }

                    return "";
                }

                const fullName = readField([
                    "fullName",
                    "fullname",
                    "full_name",
                    "name",
                    "contactName"
                ]);

                const phone = readField([
                    "phone",
                    "mobile",
                    "mobileNumber",
                    "phoneNumber",
                    "tel",
                    "contactPhone"
                ]);

                const brand = readField([
                    "brand",
                    "company",
                    "companyName",
                    "business"
                ]);

                const type = readField([
                    "type",
                    "requestType",
                    "request_type",
                    "need",
                    "subject"
                ]);

                const description = readField([
                    "description",
                    "message",
                    "details",
                    "text",
                    "contactMessage"
                ]);

                if (!fullName || !phone) {
                    if (contactFormMessage) {
                        contactFormMessage.innerText =
                            "لطفاً نام و شماره موبایل خود را وارد کنید.";

                        contactFormMessage.classList.add("is-visible");
                    }

                    return;
                }

                if (fullName.length > 25) {
                    if (contactFormMessage) {
                        contactFormMessage.innerText =
                            "نام و نام خانوادگی نمی‌تواند بیشتر از ۲۵ کاراکتر باشد.";

                        contactFormMessage.classList.add("is-visible");
                    }

                    return;
                }

                if (brand.length > 25) {
                    if (contactFormMessage) {
                        contactFormMessage.innerText =
                            "نام برند نمی‌تواند بیشتر از ۲۵ کاراکتر باشد.";

                        contactFormMessage.classList.add("is-visible");
                    }

                    return;
                }

                if (description.length > 25) {
                    if (contactFormMessage) {
                        contactFormMessage.innerText =
                            "توضیحات نیاز نمی‌تواند بیشتر از ۲۵ کاراکتر باشد.";

                        contactFormMessage.classList.add("is-visible");
                    }

                    return;
                }

                if (submitButton) {
                    submitButton.disabled = true;

                    if ("value" in submitButton) {
                        submitButton.value = "در حال ارسال...";
                    } else {
                        submitButton.innerText = "در حال ارسال...";
                    }
                }

                if (contactFormMessage) {
                    contactFormMessage.innerText =
                        "در حال ثبت درخواست...";

                    contactFormMessage.classList.add("is-visible");
                }

                try {
                    const response = await fetch(
                        "https://payamake-contact.sgexir.workers.dev/",
                        {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify({
                                fullName,
                                phone,
                                brand,
                                type,
                                description,
                                source: "homepage"
                            })
                        }
                    );

                    let result;

                    try {
                        result = await response.json();
                    } catch {
                        result = {
                            success: false,
                            error: "پاسخ نامعتبر از سرور دریافت شد."
                        };
                    }

                    if (!response.ok || !result.success) {
                        throw new Error(
                            result.error ||
                            "ثبت درخواست انجام نشد. لطفاً دوباره تلاش کنید."
                        );
                    }

                    if (contactFormMessage) {
                        contactFormMessage.innerText =
                            "درخواست شما با موفقیت دریافت شد. به‌زودی با شما تماس می‌گیریم.";

                        contactFormMessage.classList.add("is-visible");
                    }

                    contactForm.reset();

                } catch (error) {
                    console.error("Contact form error:", error);

                    if (contactFormMessage) {
                        contactFormMessage.innerText =
                            error instanceof Error
                                ? error.message
                                : "ارسال درخواست انجام نشد. لطفاً دوباره تلاش کنید.";

                        contactFormMessage.classList.add("is-visible");
                    }

                } finally {
                    if (submitButton) {
                        submitButton.disabled = false;

                        if ("value" in submitButton) {
                            submitButton.value = originalButtonText;
                        } else {
                            submitButton.innerText = originalButtonText;
                        }
                    }
                }
            });
        }
    }

    /* =========================================================
       FOOTER
       Stage 3: compact glass contact card with phone only.
    ========================================================= */

    const footer = document.querySelector(".footer");

    if (footer) {
        const path = window.location.pathname;
        const isBlogPage = path.includes("/blog/");
        const isArticlePage = isBlogPage && path !== "/blog/" && !path.endsWith("/blog/index.html");
        const homePrefix = isArticlePage ? "../../" : (isBlogPage ? "../" : "");

        if (!document.getElementById("payamake-footer-contact-style")) {
            const footerContactStyle = document.createElement("style");
            footerContactStyle.id = "payamake-footer-contact-style";
            footerContactStyle.textContent = `
                .footer-contact-card {
                    margin-top: 10px;
                    padding: 11px 13px;
                    border: 1px solid rgba(0, 224, 230, 0.18);
                    border-radius: 14px;
                    background: rgba(255, 255, 255, 0.045);
                    box-shadow: inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 24px rgba(0,0,0,0.06);
                    backdrop-filter: blur(10px);
                    -webkit-backdrop-filter: blur(10px);
                    box-sizing: border-box;
                }
                .footer-contact-label {
                    display: flex;
                    align-items: center;
                    gap: 7px;
                    margin-bottom: 6px;
                    font-size: 12px;
                    font-weight: 700;
                }
                .footer-contact-status {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background: #00e0e6;
                    box-shadow: 0 0 8px rgba(0,224,230,0.45);
                    flex: 0 0 auto;
                }
                .footer-contact-card p {
                    margin: 0 0 8px;
                    font-size: 11px;
                    line-height: 1.8;
                    opacity: 0.72;
                }
                .footer-contact-phone {
                    display: inline-block;
                    direction: ltr;
                    unicode-bidi: isolate;
                    font-size: 15px;
                    font-weight: 800;
                    letter-spacing: 0.2px;
                    color: inherit;
                    text-decoration: none;
                    transition: color 0.2s ease, transform 0.2s ease;
                }
                .footer-contact-phone:hover {
                    color: #00e0e6;
                    transform: translateY(-1px);
                }
                .footer-bottom-sgex {
                    color: inherit;
                    text-decoration: none;
                }
                .footer-bottom-sgex:hover,
                .footer-bottom-sgex:visited,
                .footer-bottom-sgex:active {
                    color: inherit;
                    text-decoration: none;
                }
                @media (max-width: 768px) {
                    .footer-contact-card {
                        margin-top: 8px;
                        padding: 10px 12px;
                        border-radius: 12px;
                    }
                    .footer-contact-card p {
                        margin-bottom: 6px;
                    }
                    .footer-contact-phone {
                        font-size: 14px;
                    }
                }
            `;
            document.head.appendChild(footerContactStyle);
        }

        // Extract only the Persian calendar year so the Persian era suffix (AP)
        // is never rendered. The Gregorian year naturally rolls over each year.
        const persianYearParts = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", {
            year: "numeric"
        }).formatToParts(new Date());
        const persianYearPart = persianYearParts.find(function (part) {
            return part.type === "year";
        });
        const persianYear = persianYearPart ? persianYearPart.value : "1405";
        const gregorianYear = new Date().getFullYear();
        const footerYear = `${persianYear}/${gregorianYear}`;

        footer.innerHTML = `
            <div class="container">
                <div class="footer-grid">
                    <div class="footer-brand">
                        <h3>PAYAMAKE</h3>
                        <p>پیامی که می‌فرستید، نتیجه‌ای که می‌سازید.</p>
                    </div>
                    <div class="footer-links">
                        <h4>خدمات</h4>
                        <ul>
                            <li><a href="${homePrefix}#advantages">پنل پیامکی</a></li>
                            <li><a href="${homePrefix}#database">بانک شماره تخصصی</a></li>
                            <li><a href="${homePrefix}#solutions">اجرای کمپین</a></li>
                            <li><a href="${homePrefix}#features">API پیامکی</a></li>
                            <li><a href="${homePrefix}#pricing">تعرفه سازمانی</a></li>
                        </ul>
                    </div>
                    <div class="footer-links">
                        <h4>ارتباط با ما</h4>
                        <div class="footer-contact-card">
                            <div class="footer-contact-label">
                                <span class="footer-contact-status" aria-hidden="true"></span>
                                <span>مشاوره و پشتیبانی</span>
                            </div>
                            <p>برای مشاوره یا پشتیبانی تلفنی می‌توانید با ما تماس بگیرید.</p>
                            <a class="footer-contact-phone" href="tel:09129858384" aria-label="تماس با PAYAMAKE با شماره 09129858384">0912.9.85.83.84</a>
                        </div>
                    </div>
                </div>
                <div class="footer-bottom">© ${footerYear} PAYAMAKE — تمامی حقوق متعلق به <a class="footer-bottom-sgex" href="https://sgex.ir" target="_blank" rel="noopener noreferrer">SGEX</a> است.</div>
            </div>
        `;
    }
});
