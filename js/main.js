const volumeSlider = document.querySelector(
    '.pricing-slider input[type="range"]'
);


const volumeNumber = document.querySelector(
    '.volume-number'
);


const priceNumber = document.querySelector(
    '.price-card h3'
);



function updatePricing(){


    let volume = Number(volumeSlider.value);


    let formattedVolume = volume.toLocaleString('fa-IR');


    volumeNumber.innerHTML =
        formattedVolume + " پیامک";



    let price;



    if(volume < 100000){

        price = 270;

    }


    else if(volume < 300000){

        price = 240;

    }


    else if(volume < 1000000){

        price = 220;

    }


    else {

        price = "اختصاصی";

    }



    priceNumber.innerHTML = price;


}



volumeSlider.addEventListener(
    "input",
    updatePricing
);



updatePricing();