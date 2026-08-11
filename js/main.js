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

const pricingButton = document.querySelector(".pricing-benefits .primary-button");



if (
    volumeRange &&
    volumeValue &&
    customerLevel &&
    priceValue
) {



function updatePricing(){


    let volume = Number(volumeRange.value);



    volumeValue.innerText =
        volume.toLocaleString("fa-IR") + " پیامک";



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



    // حالت ظاهری سازمانی


    if (volume >= 1000000) {


        pricingBox.querySelector(".pricing-benefits").classList.add(
    "enterprise-mode"
);


        if(pricingButton){

            pricingButton.innerText =
            "درخواست مشاوره سازمانی";

        }


    }


    else {


        pricingBox.querySelector(".pricing-benefits").classList.remove(
    "enterprise-mode"
);


        if(pricingButton){

            pricingButton.innerText =
            "دریافت تعرفه اختصاصی";

        }


    }


}



volumeRange.addEventListener(
    "input",
    updatePricing
);



updatePricing();



}




});