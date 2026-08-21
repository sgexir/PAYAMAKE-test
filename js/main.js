// PAYAMAKE Main JavaScript

document.addEventListener("DOMContentLoaded", function () {


    /* =========================================================
       PRICING CALCULATOR
    ========================================================= */

    const volumeRange =
        document.getElementById("volumeRange");

    const volumeValue =
        document.getElementById("volumeValue");

    const customerLevel =
        document.getElementById("customerLevel");

    const priceValue =
        document.getElementById("priceValue");

    const pricingBox =
        document.querySelector(".premium-pricing-box");

    const pricingButton =
        document.querySelector(
            ".pricing-benefits .primary-button"
        );

    const pricingControl =
        document.querySelector(".pricing-control");

    const originalButtonParent =
        pricingButton
            ? pricingButton.parentElement
            : null;


    /* =========================================================
       PRICING INITIALIZATION
    ========================================================= */

    if (
        volumeRange &&
        volumeValue &&
        customerLevel &&
        priceValue &&
        pricingBox &&
        pricingButton &&
        pricingControl &&
        originalButtonParent
    ) {

        const benefitsBox =
            pricingBox.querySelector(
                ".pricing-benefits"
            );


        /*
         * فقط موبایل اجازه دارد دکمه را
         * به بخش pricing-control منتقل کند.
         *
         * دسکتاپ همیشه جای اصلی دکمه را حفظ می‌کند.
         */

        const mobileMediaQuery =
            window.matchMedia(
                "(max-width: 768px)"
            );


        function updatePricing() {

            const volume =
                Number(volumeRange.value);


            /* =====================================================
               Volume Text
            ===================================================== */

            volumeValue.innerText =
                volume.toLocaleString("fa-IR") +
                " پیامک";


            /* =====================================================
               Slider Progress
            ===================================================== */

            const min =
                Number(volumeRange.min);

            const max =
                Number(volumeRange.max);

            const percentage =
                ((volume - min) / (max - min)) * 100;


            volumeRange.style.background =
                `linear-gradient(
                    to left,
                    #00e0e6 0%,
                    #00e0e6 ${percentage}%,
                    #e2e8f0 ${percentage}%,
                    #e2e8f0 100%
                )`;


            /* =====================================================
               Pricing Levels
            ===================================================== */

            if (volume <= 100000) {

                customerLevel.innerText =
                    "مشتری عادی";

                priceValue.innerText =
                    "270 تومان";

            }

            else if (volume <= 500000) {

                customerLevel.innerText =
                    "VIP";

                priceValue.innerText =
                    "240 تومان";

            }

            else if (volume < 1000000) {

                customerLevel.innerText =
                    "VIP حجیم";

                priceValue.innerText =
                    "220 تومان";

            }

            else {

                customerLevel.innerText =
                    "سازمانی";

                priceValue.innerText =
                    "تعرفه اختصاصی";

            }


            /* =====================================================
               Enterprise Mode
            ===================================================== */

            const isEnterprise =
                volume >= 1000000;


            if (isEnterprise) {

                pricingBox.classList.add(
                    "enterprise-mode"
                );

                if (benefitsBox) {

                    benefitsBox.classList.add(
                        "enterprise-mode"
                    );

                }


                pricingButton.innerText =
                    "درخواست مشاوره سازمانی";


                /*
                 * نکته مهم:
                 *
                 * فقط در موبایل دکمه را از
                 * pricing-benefits خارج می‌کنیم.
                 *
                 * در دسکتاپ دکمه سر جای اصلی خودش
                 * باقی می‌ماند.
                 */

                if (
                    mobileMediaQuery.matches &&
                    pricingButton.parentElement !==
                    pricingControl
                ) {

                    pricingControl.appendChild(
                        pricingButton
                    );

                }


                /*
                 * اگر دسکتاپ است،
                 * دکمه را حتماً به جای اصلی برگردان.
                 */

                if (
                    !mobileMediaQuery.matches &&
                    pricingButton.parentElement !==
                    originalButtonParent
                ) {

                    originalButtonParent.appendChild(
                        pricingButton
                    );

                }


                /*
                 * کلاس اختصاصی برای حالت سازمانی
                 */

                pricingButton.classList.add(
                    "enterprise-button"
                );

            }

            else {

                pricingBox.classList.remove(
                    "enterprise-mode"
                );

                if (benefitsBox) {

                    benefitsBox.classList.remove(
                        "enterprise-mode"
                    );

                }


                /* =================================================
                   Normal Button
                ================================================= */

                pricingButton.innerText =
                    "دریافت تعرفه اختصاصی";


                /*
                 * در حالت عادی همیشه دکمه
                 * به محل اصلی خودش برمی‌گردد.
                 */

                if (
                    pricingButton.parentElement !==
                    originalButtonParent
                ) {

                    originalButtonParent.appendChild(
                        pricingButton
                    );

                }


                pricingButton.classList.remove(
                    "enterprise-button"
                );

            }

        }


        /* =========================================================
           Slider Event
        ========================================================= */

        volumeRange.addEventListener(
            "input",
            updatePricing
        );


        /* =========================================================
           Responsive Event
           
           اگر کاربر بین موبایل و دسکتاپ
           تغییر اندازه بدهد، جای دکمه اصلاح می‌شود.
        ========================================================= */

        mobileMediaQuery.addEventListener(
            "change",
            updatePricing
        );


        /* =========================================================
           Initial State
        ========================================================= */

        updatePricing();

    }


    /* =========================================================
       CONTACT MODAL
    ========================================================= */

    const contactModal =
        document.getElementById("contactModal");

    const contactModalClose =
        document.getElementById(
            "contactModalClose"
        );

    const contactModalOverlay =
        contactModal
            ? contactModal.querySelector(
                ".contact-modal-overlay"
            )
            : null;

    const contactForm =
        document.getElementById(
            "contactForm"
        );

    const contactFormMessage =
        document.getElementById(
            "contactFormMessage"
        );


    /*
     * اگر Modal وجود نداشت،
     * فقط بخش Modal متوقف شود.
     *
     * Pricing همچنان کار می‌کند.
     */

    if (contactModal) {


        /* =====================================================
           Open Modal
        ===================================================== */

        function openContactModal() {

            contactModal.classList.add(
                "is-open"
            );

            contactModal.setAttribute(
                "aria-hidden",
                "false"
            );

            document.body.classList.add(
                "modal-open"
            );


            /*
             * Focus روی اولین فیلد فرم
             */

            const firstInput =
                contactModal.querySelector(
                    "input"
                );

            if (firstInput) {

                setTimeout(
                    function () {

                        firstInput.focus();

                    },
                    100
                );

            }

        }


        /* =====================================================
           Close Modal
        ===================================================== */

        function closeContactModal() {

            contactModal.classList.remove(
                "is-open"
            );

            contactModal.setAttribute(
                "aria-hidden",
                "true"
            );

            document.body.classList.remove(
                "modal-open"
            );

        }


        /* =====================================================
           Contact Buttons
        ===================================================== */

        const contactButtons =
            document.querySelectorAll(
                'a[href="#"]'
            );


        contactButtons.forEach(
            function (button) {

                const buttonText =
                    button.innerText.trim();


                const isContactButton =
                    buttonText.includes(
                        "مشاوره"
                    ) ||
                    buttonText.includes(
                        "شروع همکاری"
                    ) ||
                    buttonText.includes(
                        "درخواست مشاوره"
                    );


                if (!isContactButton) {
                    return;
                }


                button.addEventListener(
                    "click",
                    function (event) {

                        event.preventDefault();

                        openContactModal();

                    }
                );

            }
        );


        /* =====================================================
           Close Button
        ===================================================== */

        if (contactModalClose) {

            contactModalClose.addEventListener(
                "click",
                function () {

                    closeContactModal();

                }
            );

        }


        /* =====================================================
           Overlay Click
        ===================================================== */

        if (contactModalOverlay) {

            contactModalOverlay.addEventListener(
                "click",
                function () {

                    closeContactModal();

                }
            );

        }


        /* =====================================================
           ESC Key
        ===================================================== */

        document.addEventListener(
            "keydown",
            function (event) {

                if (
                    event.key === "Escape" &&
                    contactModal.classList.contains(
                        "is-open"
                    )
                ) {

                    closeContactModal();

                }

            }
        );


        /* =====================================================
           Prevent Form Submit
           Temporary Frontend
        ===================================================== */

        if (contactForm) {

            contactForm.addEventListener(
                "submit",
                function (event) {

                    event.preventDefault();


                    if (contactFormMessage) {

                        contactFormMessage.innerText =
                            "درخواست شما ثبت شد. کارشناسان PAYAMAKE با شما تماس خواهند گرفت.";

                        contactFormMessage.classList.add(
                            "is-visible"
                        );

                    }

                }
            );

        }

    }

});