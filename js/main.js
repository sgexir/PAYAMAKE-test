// PAYAMAKE Main JavaScript


document.addEventListener("DOMContentLoaded", function () {


/* ==========================
   Pricing Calculator
========================== */


const volumeRange = document.getElementById("volumeRange");

const volumeValue = document.getElementById("volumeValue");

const customerLevel = document.getElementById("customerLevel");

const priceValue = document.getElementById("priceValue");

const pricingBox = document.querySelector(".premium-pricing-box");

const pricingButton = document.querySelector(
    ".pricing-benefits .primary-button"
);


/* ==========================
   Enterprise Button
========================== */

const pricingControl = document.querySelector(
    ".pricing-control"
);

const customerLevelBox = document.querySelector(
    ".customer-level"
);

const originalButtonParent = pricingButton
    ? pricingButton.parentElement
    : null;


/* ==========================
   Safety Check
========================== */

if (
    volumeRange &&
    volumeValue &&
    customerLevel &&
    priceValue &&
    pricingBox &&
    pricingButton &&
    pricingControl &&
    customerLevelBox
) {


    function updatePricing(){


        let volume = Number(volumeRange.value);


        /* ==========================
           Volume Text
        ========================== */

        volumeValue.innerText =
            volume.toLocaleString("fa-IR") + " پیامک";


        /* ==========================
           Premium Slider Progress
        ========================== */

        let min = Number(volumeRange.min);

        let max = Number(volumeRange.max);

        let percentage =
            ((volume - min) / (max - min)) * 100;


        volumeRange.style.background =
            `linear-gradient(
                to left,
                #00e0e6 0%,
                #00e0e6 ${percentage}%,
                #e2e8f0 ${percentage}%,
                #e2e8f0 100%
            )`;


        /* ==========================
           Pricing Levels
        ========================== */


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


        /* ==========================
           Enterprise Mode
        ========================== */


        const benefitsBox =
            pricingBox.querySelector(
                ".pricing-benefits"
            );


        if (volume >= 1000000) {


            /* حالت سازمانی */

            benefitsBox.classList.add(
                "enterprise-mode"
            );


            pricingBox.classList.add(
                "enterprise-mode"
            );


            /* متن دکمه */

            pricingButton.innerText =
                "درخواست مشاوره سازمانی";


            /*
             * انتقال دکمه:
             * از باکس مزایا
             * به زیر باکس های سطح همکاری
             */

            if (
                pricingButton.parentElement !==
                pricingControl
            ) {

                pricingControl.appendChild(
                    pricingButton
                );

            }


            /* ظاهر دکمه در محل جدید */

            pricingButton.style.display =
                "flex";

            pricingButton.style.alignItems =
                "center";

            pricingButton.style.justifyContent =
                "center";

            pricingButton.style.width =
                "100%";

            pricingButton.style.marginTop =
                "20px";

            pricingButton.style.boxSizing =
                "border-box";

            pricingButton.style.textAlign =
                "center";


        }


        else {


            /* خروج از حالت سازمانی */

            benefitsBox.classList.remove(
                "enterprise-mode"
            );


            pricingBox.classList.remove(
                "enterprise-mode"
            );


            /* متن اصلی دکمه */

            pricingButton.innerText =
                "دریافت تعرفه اختصاصی";


            /*
             * برگرداندن دکمه
             * به باکس مزایا
             */

            if (
                originalButtonParent &&
                pricingButton.parentElement !==
                originalButtonParent
            ) {

                originalButtonParent.appendChild(
                    pricingButton
                );

            }


            /* پاک کردن استایل های موقت */

            pricingButton.style.display = "";

            pricingButton.style.alignItems = "";

            pricingButton.style.justifyContent = "";

            pricingButton.style.width = "";

            pricingButton.style.marginTop = "";

            pricingButton.style.boxSizing = "";

            pricingButton.style.textAlign = "";


        }


    }


    /* ==========================
       Slider Event
    ========================== */

    volumeRange.addEventListener(
        "input",
        updatePricing
    );


    /* ==========================
       Initial State
    ========================== */

    updatePricing();


}


});