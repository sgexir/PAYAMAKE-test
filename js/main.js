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
                <label for="contactBrand">
                    نام برند / کسب‌وکار
                    <span>(اختیاری)</span>
                </label>
                <input
                    type="text"
                    id="contactBrand"
                    name="brand"
                    placeholder="نام برند یا کسب‌وکار"
                    autocomplete="organization"
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
                    <option value="" selected></option>
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
            }

            if (messageTextarea) {
                messageTextarea.placeholder = "نیاز خود را توضیح دهید...";
            }

            // Hide the single existing textarea until "سایر" is selected.
            messageGroup.hidden = true;

            contactForm.insertBefore(brandGroup, messageGroup);
            contactForm.insertBefore(typeGroup, messageGroup);

            const contactType = document.getElementById("contactType");

            if (contactType) {
                contactType.addEventListener("change", function () {
                    const isOther = contactType.value === "سایر";

                    messageGroup.hidden = !isOther;

                    if (!isOther && messageTextarea) {
                        messageTextarea.value = "";
                    }
                });
            }
        }

        addOptionalContactFields();

        function openContactModal() {
            resetContactFormState();

            contactModal.classList.add("is-open");
            contactModal.setAttribute("aria-hidden", "false");
            document.body.classList.add("modal-open");

            const firstInput = contactModal.querySelector("input, select, textarea");
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
        }

        const contactButtons = document.querySelectorAll('a[href="#"]');

        contactButtons.forEach(function (button) {
            const buttonText = button.innerText.trim();

            const isContactButton =
                buttonText.includes("مشاوره") ||
                buttonText.includes("شروع همکاری") ||
                buttonText.includes("درخواست مشاوره");

            if (!isContactButton) return;

            button.addEventListener("click", function (event) {
                event.preventDefault();
                openContactModal();
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
            if (
                event.key === "Escape" &&
                contactModal.classList.contains("is-open")
            ) {
                closeContactModal();
            }
        });

        /* =====================================================
           CONTACT FORM → CLOUDFLARE WORKER
        ===================================================== */

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
                        if (byName) return String(byName.value || "").trim();

                        const byId = document.getElementById(name);
                        if (byId && contactForm.contains(byId)) {
                            return String(byId.value || "").trim();
                        }
                    }
                    return "";
                }

                const fullName = readField(["fullName", "fullname", "full_name", "name"]);
                const phone = readField(["phone", "mobile", "mobileNumber", "phoneNumber", "tel"]);
                const brand = readField(["brand", "company", "companyName", "business"]);
                const type = readField(["type", "requestType", "request_type", "need", "subject"]);
                const description = readField(["description", "message", "details", "text"]);

                if (!fullName || !phone) {
                    if (contactFormMessage) {
                        contactFormMessage.innerText = "لطفاً نام و شماره موبایل خود را وارد کنید.";
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
                    contactFormMessage.innerText = "در حال ثبت درخواست...";
                    contactFormMessage.classList.add("is-visible");
                }

                try {
                    const response = await fetch(
                        "https://payamake-contact.sgexir.workers.dev/",
                        {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
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
                        result = { success: false, error: "پاسخ نامعتبر از سرور دریافت شد." };
                    }

                    if (!response.ok || !result.success) {
                        throw new Error(result.error || "ثبت درخواست انجام نشد. لطفاً دوباره تلاش کنید.");
                    }

                    if (contactFormMessage) {
                        contactFormMessage.innerText = "درخواست شما با موفقیت دریافت شد. به‌زودی با شما تماس می‌گیریم.";
                        contactFormMessage.classList.add("is-visible");
                    }

                    contactForm.reset();
                } catch (error) {
                    console.error("Contact form error:", error);

                    if (contactFormMessage) {
                        contactFormMessage.innerText = error instanceof Error
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
});