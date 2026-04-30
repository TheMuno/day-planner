import { initializeApp } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, 
    getDocs, updateDoc, deleteField, collection,
    arrayUnion, arrayRemove, serverTimestamp,
    query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBQPqbtlfHPLpB-JYbyxDZiugu4NqwpSeM",
    authDomain: "askkhonsu-map.firebaseapp.com",
    projectId: "askkhonsu-map",
    storageBucket: "askkhonsu-map.appspot.com",
    messagingSenderId: "266031876218",
    appId: "1:266031876218:web:ec93411f1c13d9731e93c3",
    measurementId: "G-Z7F4NJ4PHW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
const db = getFirestore(app);  

// let map;
let infoWindow;
let placesService;

const locationNYC = { lat: 40.7580, lng: -73.9855 };
const firebaseUrl = 'https://getspreadsheetdata-qqhcjhxuda-uc.a.run.app';

const $titleInfoSkeletonWrap = document.querySelector('.ak-skeleton-wrap');
const $tripTitleInfo = document.querySelector('.ak-trip-info');
const $tripTitle = $tripTitleInfo.querySelector('[data-ak="trip-title"]');
const $saveItineraryBtn = document.querySelector('[data-ak="save-itinerary"]');
const $unsavedChanges = document.querySelector('[data-ak="slider-locations-changes"]');
const $mapPinsRadios = document.querySelectorAll('.ak-map-pins-wrap input[type=radio]');
const $travelDetails = document.querySelector('[data-ak="travel-details"]');
const currentPage = window.location.pathname || '/customize-itinerary-page-2';
const nonCountDays = 2;

const locations = {
  new_york: { lat: 40.7580, lng: -73.9855 },
  washington_dc: { lat: 38.89511, lng: -77.03637 },
  los_angeles: { lat: 34.052235, lng: -118.243683 },
  las_vegas: { lat: 36.175, lng: -115.136 },
  miami: { lat: 25.7743, lng: -80.1937 },
};

let mapCenter = locationNYC;
if (localStorage['ak-user-destination']) {
  const locationName = localStorage['ak-user-destination']; 
  mapCenter = locations[locationName];
}


window.addEventListener('load', async () => {

  await Clerk.load();

  hideShowLoginNSavebtn();

  function hideShowLoginNSavebtn() {
    // const $loginBtn = document.querySelector('[data-ak="clerk-login"]');
    const $saveBtn = document.querySelector('[data-ak="save-itinerary"]');
    const $loginToPrintItineraryBtn = document.querySelector('[data-ak="login-to-get-text-file"]');
    const $printItineraryBtn = document.querySelector('[data-ak="generate-text-file"]');
    const $loginToCalculatePassesBtn = document.querySelector('[data-ak="login-to-calc-pass"]');
    const $calculatePassesBtn = document.querySelector('[data-ak="calculate-passes"]');

    if (Clerk.user) {
      $saveBtn.closest('.ak-save-wrap').classList.remove('hidden');
      processPrintItinerary();
      processCalcPass(); 
    }
    else {
      // processLogin($loginBtn);
      processLogin($loginToPrintItineraryBtn);
      processLogin($loginToCalculatePassesBtn);
    }

    function processPrintItinerary() {
      $printItineraryBtn.removeAttribute('data-ak-hidden');
      $printItineraryBtn.addEventListener('click', e => {
        const userMail = localStorage['ak-userMail'];
        let userId;
        if (userMail) userId = encodeURIComponent(userMail);
        window.location.href = `/itinerary-list?id=${userId || ''}`;
      });
    }

    function processCalcPass() {
      $calculatePassesBtn.removeAttribute('data-ak-hidden');
    }

    function processLogin($btn) {
      $btn.classList.remove('hidden');
      $btn.removeAttribute('data-ak-hidden');
      $btn.addEventListener('click', e => {
        if (!Clerk.user) {
          Clerk.openSignUp({
            redirectUrl: currentPage,
          });
        }
      });
    }
  }

  if (Clerk.user) { // logged-in user retrieve from DB
    console.log('Logged-in')

    const userMail = localStorage['ak-userMail']; // this is set in webflow site settings once user logs-in
    const data = await retrieveDBData(userMail); 
    
    if (!data) {  // user has no saved record in the db
      handleUserNotSavedInDB();
      createUserInFirebase(userMail);

      // Get any previously stored data in the localStorage
      // This is in cases where the user began interacting
      // with the tool before logging in to save
      const savedAttractions = localStorage['ak-attractions-saved'];
      const tripName = Clerk?.user?.externalAccounts?.[0]?.firstName || '';
      const travelDates = localStorage['ak-travel-days'];

      const hotel = localStorage['ak-hotel'];
      const arrivalAirport = localStorage['ak-arrival-airport'];
      const departureAirport = localStorage['ak-departure-airport'];

      setupUserInfo(savedAttractions, tripName, travelDates, hotel, arrivalAirport, departureAirport);

      await saveAttractionsDB();
      removeUnsavedChangesFlag(); 

      function handleUserNotSavedInDB() {
        console.log('::::Found no data --- Absolutely new user!')

        // remove travel-days in case someone else had logged in with other account & selected dates
        // username & email already removed every time a user logs out in site settings
        // travel-days can't be removed on log-out to accommodate non-logged in users
        // ....
        // 'ak-update-travel-days' shows user has just selected dates from /free-trip-planner page
        if (!localStorage['ak-update-travel-days']) {
          localStorage.removeItem('ak-travel-days'); 
        }

        if (localStorage['ak-referred']) {
          handleReferredUserNotSavedInDB();
          return;
        }

        showTripInfoHeader(); 
        // redirectToPlannerPage();

        function handleReferredUserNotSavedInDB() {
          localStorage.removeItem('ak-referred');
          console.log('::::No data but ak-referred found')
          showErrorAlertNRedirect(userMail); 
        }
      }
    }
    else {
      const { referrerMail } = data;
      if (referrerMail) {
        console.log('Referred user!')

        if (localStorage['ak-update-merge-local']) {
          localStorage['ak-update-merge-db'] = true;
        }

        localStorage['ak-referrer-mail'] = referrerMail;

        const referrerData = await retrieveReferrerData(referrerMail);

        const { 
          tripName, 
          travelDates, 
          hotel, 
          arrivalAirport, 
          departureAirport, 
          savedAttractions, 
        } = referrerData;

        console.log('tripName', tripName) 

        const {
          userTravelDates, 
          userHotel, 
          userArrivalAirport, 
          userDepartureAirport, 
          userAttractions
        } = processSetupInfoData(travelDates, hotel, arrivalAirport, departureAirport, savedAttractions);   

        localStorage['ak-hotel'] = userHotel;
        localStorage['ak-arrival-airport'] = userArrivalAirport;
        localStorage['ak-departure-airport'] = userDepartureAirport;
              
        setupUserInfo(userAttractions, tripName, userTravelDates, userHotel, userArrivalAirport, userDepartureAirport);
        localStorage.removeItem('ak-referred');

        handleSeverTiesToReferrer();
        // handleSelectPlanToView();
      }
      else {

        if (!referrerMail && localStorage['ak-referred']) {
          console.log('Referred user but not connected to any plan!')

          localStorage.removeItem('ak-referred');

          const name = localStorage['ak-user-name'] ? localStorage['ak-user-name'].split(/\s+/)[0] : '';
          const displayMsg = `${name ? `Hi ${name}\n` : ''}The email address: ${userMail}\nis not connected to another plan\nHere's your current plan`;
          alert(displayMsg);
        }

        console.log('Regular user!')

        if (localStorage['ak-update-merge-local']) {
          localStorage['ak-update-merge-db'] = true;
        }
        
        const { 
          tripName, 
          travelDates, 
          hotel, 
          arrivalAirport, 
          departureAirport, 
          savedAttractions, 
        } = data;

        const userName = Clerk?.user?.externalAccounts?.[0]?.firstName;
        const userTripName = tripName ? tripName : userName;

        // localStorage['sample-saved'] = savedAttractions;

        const {
          userTravelDates, 
          userHotel, 
          userArrivalAirport, 
          userDepartureAirport, 
          userAttractions
        } = processSetupInfoData(travelDates, hotel, arrivalAirport, departureAirport, savedAttractions);   

        localStorage['ak-hotel'] = userHotel;
        localStorage['ak-arrival-airport'] = userArrivalAirport;
        localStorage['ak-departure-airport'] = userDepartureAirport;

        setupUserInfo(userAttractions, userTripName, userTravelDates, userHotel, userArrivalAirport, userDepartureAirport);
      }
    }
  }  
  // end of logged-in user code
  else if (localStorage['ak-attractions-saved']) { // unlogged-in user retrieve from cache
    const savedAttractions = localStorage['ak-attractions-saved'];

    console.log('Logged out user')

    const travelDates = localStorage['ak-travel-days'];

    const hotel = localStorage['ak-hotel'];
    const arrivalAirport = localStorage['ak-arrival-airport'];
    const departureAirport = localStorage['ak-departure-airport'];

    setupUserInfo(savedAttractions, undefined, travelDates, hotel, arrivalAirport, departureAirport);
    localStorage['ak-update-merge-local'] = true;
  }
  else {
    const travelDates = localStorage['ak-travel-days'];

    const hotel = localStorage['ak-hotel'];
    const arrivalAirport = localStorage['ak-arrival-airport'];
    const departureAirport = localStorage['ak-departure-airport'];
    setupUserInfo(undefined, undefined, travelDates, hotel, arrivalAirport, departureAirport);
    
    showTripInfoHeader(); 
  }

  function processSetupInfoData(travelDates, hotel, arrivalAirport, departureAirport, savedAttractions) {
    let userTravelDates, userHotel, userArrivalAirport, userDepartureAirport, userAttractions;
    if (localStorage['ak-update-travel-days']) {
      userTravelDates = localStorage['ak-travel-days'];
    }
    else {
      userTravelDates = travelDates;
    }

    if (localStorage['ak-update-hotel']) {
      userHotel = localStorage['ak-hotel'];
    }
    else {
      userHotel = hotel;
    }

    if (localStorage['ak-update-arrival-airport']) {
      userArrivalAirport = localStorage['ak-arrival-airport'];
    }
    else {
      userArrivalAirport = arrivalAirport;
    }

    if (localStorage['ak-update-departure-airport']) {
      userDepartureAirport = localStorage['ak-departure-airport'];
    }
    else {
      userDepartureAirport = departureAirport;
    }

    if (localStorage['ak-update-attractions']) {
      if (localStorage['ak-update-merge-local'] && localStorage['ak-update-merge-db']) {
        mergelocalNDBAttractions(savedAttractions); 
      }
      userAttractions = localStorage['ak-attractions-saved'];
    }
    else {
      userAttractions = savedAttractions;
    }
    
    return { userTravelDates, userHotel, userArrivalAirport, userDepartureAirport, userAttractions };
  }

  function mergelocalNDBAttractions(savedAttractionsDB) {
    const localSavedAttractions = JSON.parse(localStorage['ak-attractions-saved']);
    const savedAttractions = JSON.parse(savedAttractionsDB); 

    localStorage['ak-attractions-saved'] = JSON.stringify(savedAttractions);
    localStorage.removeItem('ak-update-merge-local');
    localStorage.removeItem('ak-update-merge-db');

    function combineArrays(savedArr, localArr) {
      return [
        ...new Map(
          [...savedArr, ...localArr].map(obj => [obj.displayName, obj])
        ).values()
      ];
    }
  }

  const $secondaryEmailWrap = document.querySelector('[data-ak="add-secondary-email-section"]');
  if (Clerk.user && !localStorage['ak-referrer-mail']) {
    $secondaryEmailWrap?.removeAttribute('data-ak-hidden');
  }

  function showErrorAlertNRedirect(userMail) {
    displayErrMsg(userMail);
    redirectToPlannerPage();
  }

  function displayErrMsg(userMail) {
    const name = localStorage['ak-user-name'] ? localStorage['ak-user-name'].split(/\s+/)[0] : '';
    const displayMsg = `${name ? `Hi ${name}\n` : ''}The email address: ${userMail}\nis not connected to another plan\nPlease ask your friend to add you to their plan\nor\nCreate your own plan`;
    alert(displayMsg);
  }

  function redirectToPlannerPage() {
    window.location.href = '/free-trip-planner';
  }
  


  async function handleSeverTiesToReferrer() {
    const $currentPlanWrap = document.querySelector('.ak-current-plan-wrap');
    $currentPlanWrap.classList.remove('hide');

    const $createOwnPlanBtn = document.querySelector('[data-ak="create-own-plan"]');
    $createOwnPlanBtn.addEventListener('click', async e => {
      const btnTxt = $createOwnPlanBtn.textContent;
      $createOwnPlanBtn.textContent = 'Processing...';
      await severTiesToReferrer();
      $createOwnPlanBtn.textContent = btnTxt;
    });
    $createOwnPlanBtn.classList.remove('hide'); 

    async function severTiesToReferrer() {
      const currentPlanName = localStorage['ak-user-name'];
      const msg = `Sever ties to ${currentPlanName}'s plan\nProceed?`; 
      if (!confirm(msg)) return;

      await removeReferrerMailReference();
      await removeSecondaryEmailFromReferrer();

      for (let key of Object.keys(localStorage)) {
        if (!key.startsWith('ak-')) continue;
        if (key.includes('ak-userMail')) continue; 
        localStorage.removeItem(key);
      }

      // localStorage.removeItem('ak-referrer-mail');
      // localStorage.removeItem('ak-travel-days');
      // localStorage.removeItem('ak-user-name');

      localStorage['ak-user-name'] = Clerk?.user?.externalAccounts?.[0]?.firstName || '';

      redirectToPlannerPage();
    }

    async function removeReferrerMailReference() {
      const userMail = localStorage['ak-userMail'];
      const userRef = doc(db, 'locationsData', `user-${userMail}`);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) return;

      const userMailSaveObj = {
        ModifiedAt: serverTimestamp(),
        referrerMail: deleteField(),
      };
      await updateDoc(userRef, userMailSaveObj);
    }

    async function removeSecondaryEmailFromReferrer() {
      const referrerMail = localStorage['ak-referrer-mail'];
      const userRef = doc(db, 'locationsData', `user-${referrerMail}`);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) return;

      const data = userSnap.data();
      const { secondaryMail } = data;

      secondaryMail.splice(secondaryMail.indexOf(referrerMail), 1); 

      const userMailSaveObj = {
        ModifiedAt: serverTimestamp(),
        secondaryMail,
      };
      await updateDoc(userRef, userMailSaveObj);
    }
  }




function setUnsavedChangesFlag() {
  $unsavedChanges.classList.remove('hide');
  // localStorage['ak-attractions-saved'] = "{}"; // set ak-attractions-saved as an unsaved changes flag
  localStorage['ak-unsaved-changes'] = true;
}

function removeUnsavedChangesFlag() {
  $unsavedChanges.classList.add('hide');
  // localStorage.removeItem('ak-attractions-saved'); // remove unsaved changes flag
  localStorage.removeItem('ak-unsaved-changes'); 
}



async function retrieveDBData(userMail) {
  const userRef = doc(db, 'locationsData', `user-${userMail}`);
  const docSnap = await getDoc(userRef);

  if (!docSnap.exists()) {
      // docSnap.data() will be undefined in this case
      console.log('No user with such email!', userMail);
      // return; 
  } 

  return docSnap.data(); 
}
 
function setupUserInfo(savedAttractions=undefined, 
                      tripName=undefined, 
                      travelDates=undefined, 
                      hotel=undefined, 
                      arrivalAirport=undefined, 
                      departureAirport=undefined) {
  processTripInfoHeader(tripName, travelDates);
  setupHotelNAirports(hotel, arrivalAirport, departureAirport);
}

function processTripInfoHeader(tripName, travelDates) {
  setupTripNameNTravelDates(tripName, travelDates); 
  showTripInfoHeader(); 
}

function setupTripNameNTravelDates(tripName, travelDates) {
  if (tripName) {
    tripName = tripName.split(/\s+/)[0];
    setupTripName(tripName);
    localStorage['ak-user-name'] = tripName;
  }

  if (travelDates) {
    const { flatpickrDate } = JSON.parse(travelDates);
    setupTravelDates(flatpickrDate); 

    localStorage['ak-travel-days'] = travelDates;
  }
}

function setupTripName(tripName) {
  const $tripTitleInfo = document.querySelector('.ak-trip-info');
  const $tripTitle = $tripTitleInfo.querySelector('[data-ak="trip-title"]');
  $tripTitle.querySelector('[data-ak="trip-user-name"]').textContent = `${tripName}'s`;
}

function showTripInfoHeader() {
  const $tripTitleInfo = document.querySelector('.ak-trip-info');
  $tripTitleInfo.classList.remove('hidden');
}

function setupTravelDates(flatpickrDate) {
  let [ startDate, endDate ] = flatpickrDate.split(/\s+to\s+/);

  const daysArr = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthArr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  processTitleDates(); 
  reInitWebflow();

  function updateDayNDate($slide, { day, month, date, year }) {
    const $day = $slide.querySelector('[data-ak="timeslots-day"]');
    const $date = $slide.querySelector('[data-ak="timeslots-date"]');

    $day.textContent = day; 
    $date.textContent = `${month} ${date}, ${year}`;
  }

  function getDateDetails(theDate) {
    const day = daysArr[theDate.getDay()];
    const month = monthArr[theDate.getMonth()];
    const date = theDate.getDate();
    const year = theDate.getFullYear(); 

    return { day, month, date, year };
  }
  
  function daysBetween(startDate, endDate) {
    var millisecondsPerDay = 24 * 60 * 60 * 1000;
    const startDateTime = new Date(startDate).getTime();
    const endDateTime = new Date(endDate).getTime();
    return (endDateTime - startDateTime) / millisecondsPerDay;
  }

  function processTitleDates() {
    setTitleTravelDates(startDate, endDate);

    function setTitleTravelDates(startDate, endDate) { 
      const titleDates = getTitleTravelDates(startDate, endDate); 
      const $titleTravelDatesEl = document.querySelector('[data-ak="title-travel-dates"]');
      $titleTravelDatesEl.textContent = titleDates;
    }

    function getTitleTravelDates(startDate, endDate) {
      let titleStartDate = new Date(startDate);
      let titleEndDate = new Date(endDate);
      titleStartDate = `${monthArr[titleStartDate.getMonth()]} ${titleStartDate.getDate()}`;
      titleEndDate = `${monthArr[titleEndDate.getMonth()]} ${titleEndDate.getDate()}`;

      const sameDay = titleStartDate === titleEndDate;
      const titleDates = sameDay ? titleStartDate : `${titleStartDate} - ${titleEndDate}`;
      return titleDates;
    }
  }

  function reInitWebflow() {
    Webflow.destroy();
    Webflow.ready();
    Webflow.require('ix2').init(); 
    Webflow.require('slider').redraw();
  }
} 

function setupHotelNAirports(hotel, arrivalAirport, departureAirport) {
  if (hotel && hotel !== 'undefined') {
    processLocation(hotel, '[data-ak="hotel-search-result"]');
  }

  if (arrivalAirport && arrivalAirport !== 'undefined') {
    processLocation(arrivalAirport, '[data-ak="airport-search-result"][data-ak-airport="arrival"]'); 
  }

  if (departureAirport && departureAirport !== 'undefined') {
    processLocation(departureAirport, '[data-ak="airport-search-result"][data-ak-airport="departure"]'); 
  }

  function processLocation(location, $resultWrapName) {
    const locationDetails = JSON.parse(location);
    const $resultWrap = document.querySelector($resultWrapName);
    $resultWrap.saveObj = location;
    setupLocation(location, locationDetails, $resultWrap); 
  }

  function setupLocation(location, locationDetails, $resultWrap) {
    let { 
      displayName, 
      location: { lat, lng },
      editorialSummary,
      type,
    } = locationDetails;

    if (!type) {
      type = locationDetails.types;
    }

    // let marker;

    /*if (location === hotel) {
      marker = createMarker(displayName, {lat, lng}, editorialSummary, type, hotelMarkerPinUrl); 
      markerObj['hotel'] = marker;
    }
    else {
      const markerPinUrl = getCorrectTransportationPinUrl(type);
      marker = createMarker(displayName, {lat, lng}, editorialSummary, type, markerPinUrl); 
      if (location === arrivalAirport) {
        markerObj['airport-arrival'] = marker;
      }
      else {
        markerObj['airport-departure'] = marker;
      }
    }*/

    addLocationToResultWrap(displayName, $resultWrap); 
  }
}


async function createUserInFirebase(userMail) {
  if (!userMail) return;
  const userRef = doc(db, 'locationsData', `user-${userMail}`);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) return;
  await setDoc(userRef, { CreatedAt: serverTimestamp() }); 
}


function format(str) {
  if (!str) return; 
  return str = str.trim().split(/\s+/).map(w => capitalize(w)).join(' '); 
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

!async function setupHotelAutocomplete() {
  await google.maps.importLibrary('places');

  // Create the input HTML element, and append it.
  const placeAutocomplete = new google.maps.places.PlaceAutocompleteElement({
      componentRestrictions: {country: ['us']},
      includedRegionCodes: ['us'],
      locationBias: {
        radius: 5000.0,
        center: mapCenter,
      },
      includedPrimaryTypes: ['lodging', 'hotel'], 
  });

  const $autocompleteWrap = document.querySelector('[data-ak="hotel-autocomplete"]');
  $autocompleteWrap?.appendChild(placeAutocomplete);

  const placeholderText = 'Search for hotel...'; 
  // if (placeAutocomplete.Eg) {
  //   placeAutocomplete.Eg.setAttribute('placeholder', placeholderText);
  // }

  // Add the gmp-placeselect listener, and display the results.
  placeAutocomplete.addEventListener('gmp-select', async (res) => {
    const { placePrediction } = res;
    const place = placePrediction.toPlace();
    await place.fetchFields({ fields: ['displayName', 'location', 'editorialSummary'] });

    // if (place.viewport) {
    //   map.panTo(place.viewport);
    // }
    // else {
    //   map.panTo(place.location);
    // }

    const placeObj = place.toJSON(); 

    resetUserInputField();
    function resetUserInputField() {
      const $userInputWrap = res.target?.Zg;
      if (!$userInputWrap) return;
      const $userInput = $userInputWrap.querySelector('input');    
      if ($userInput) $userInput.value = '';
      // $userInput.setAttribute('placeholder', placeholderText);
    }
    
    const { 
      displayName, 
      location: { lat, lng },
      editorialSummary,
      types: type,
    } = placeObj; 

    // const marker = createMarker(displayName, {lat, lng}, editorialSummary, type, hotelMarkerPinUrl); 
    // // markerArr.push(marker); 
    // if (markerObj['hotel']) markerObj['hotel'].setMap(null);
    // markerObj['hotel'] = marker;
    
    // console.log('markerObj::', markerObj)

    const $hotelResultWrap = document.querySelector('[data-ak="hotel-search-result"]');
    addLocationToResultWrap(displayName, $hotelResultWrap); 

    setUnsavedChangesFlag(); 

    localStorage['ak-hotel'] = JSON.stringify(placeObj);
    localStorage['ak-update-hotel'] = true;
  });
}(); 

!async function setupAirportAutocomplete() {
  await google.maps.importLibrary('places');

  document.querySelectorAll('[data-ak="airport-autocomplete"]').forEach(autocomplete => {
    // Create the input HTML element, and append it.
    const placeAutocomplete = new google.maps.places.PlaceAutocompleteElement({
        componentRestrictions: {country: ['us']},
        includedRegionCodes: ['us'],
        locationBias: {
          radius: 5000.0,
          center: mapCenter,
        },
        includedPrimaryTypes: ['airport', 'ferry_terminal', 'international_airport', 'bus_station', 'train_station'], 
    });

    autocomplete.appendChild(placeAutocomplete);

    const placeholderText = 'Search for airport...'; 
    // if (placeAutocomplete.Eg) {
    //   placeAutocomplete.Eg.setAttribute('placeholder', placeholderText);
    // }
    
    // Add the gmp-placeselect listener, and display the results.
    placeAutocomplete.addEventListener('gmp-select', async (res) => {
      const { placePrediction } = res;
      const place = placePrediction.toPlace();
      await place.fetchFields({ fields: ['displayName', 'location', 'editorialSummary', 'types'] });

      // if (place.viewport) {
      //   map.panTo(place.viewport);
      // }
      // else {
      //   map.panTo(place.location);
      // }

      const placeObj = place.toJSON(); 

      resetUserInputField();
      function resetUserInputField() {
        const $userInputWrap = res.target?.Zg;
        if (!$userInputWrap) return;
        const $userInput = $userInputWrap.querySelector('input');    
        if ($userInput) $userInput.value = '';
        // $userInput.setAttribute('placeholder', placeholderText);
      }
      
      const { 
        displayName, 
        location: { lat, lng },
        editorialSummary,
        types: type,
      } = placeObj; 

      // console.log('type::', type)

      // const markerPinUrl = getCorrectTransportationPinUrl(type);

      // const marker = createMarker(displayName, {lat, lng}, editorialSummary, type, markerPinUrl); 
      // markerArr.push(marker);

      const airportType = autocomplete.getAttribute('data-ak-airport');
      if (airportType.includes('arrival')) {
        localStorage['ak-arrival-airport'] = JSON.stringify(placeObj);
        localStorage['ak-update-arrival-airport'] = true; 
        // if (markerObj['airport-arrival']) markerObj['airport-arrival'].setMap(null);
        // markerObj['airport-arrival'] = marker;
      }
      else {
        localStorage['ak-departure-airport'] = JSON.stringify(placeObj);
        localStorage['ak-update-departure-airport'] = true;  
        // if (markerObj['airport-departure']) markerObj['airport-departure'].setMap(null);
        // markerObj['airport-departure'] = marker;
      }

      // console.log('markerObj::', markerObj)

      const $resultWrap = autocomplete.closest('.form_row').querySelector('[data-ak="airport-search-result"]');
      addLocationToResultWrap(displayName, $resultWrap);
      
      setUnsavedChangesFlag(); 
    });
  });
}(); 

function addLocationToResultWrap(name, $resultWrap) {
  const $parent = $resultWrap.closest('.form_row'); 
  const $location = $parent.querySelector('[data-ak="attraction-location"]').cloneNode(true);
  $location.classList.remove('hidden');
  $location.querySelector('[data-ak="location-title"]').textContent = name; 
  $location.querySelector('[data-ak="location-link-text"]').textContent = name;
  // $location.marker = marker;
  // $location.saveObj = saveObj;
  $resultWrap.innerHTML = '';
  $resultWrap.append($location);
}


/**
 * Pass Calculator
*/

// let placeIds = JSON.parse(localStorage['ak-place-ids'] || '[]'); 
const { Attractions, Passes } = await logSheetData();
localStorage['ak-sheet-attractions'] = JSON.stringify(Attractions);

const $ticketsTotalPrice = document.querySelector('[data-ak="tickets-total-price"]');
const $ticketsNum = document.querySelector('[data-ak="tickets-num"]');
const $attractionSample = document.querySelector('[data-ak="attraction-sample"]');
const $individualResultsContainer = document.querySelector('[data-ak="results-container"][named="individual"]');
const $gocityResultsContainer = document.querySelector('[data-ak="results-container"][named="gocity"]');
const $citypassResultsContainer = document.querySelector('[data-ak="results-container"][named="citypass"]');

$individualResultsContainer.innerHTML = '';
let attractionsTotalCost = 0;

const $spacers = document.querySelectorAll('[data-ak-spacer]');
const $calculatePasses = document.querySelector('[data-ak="calculate-passes"]');  
$calculatePasses.addEventListener('click', async e => {
  e.preventDefault();

  const attractions = JSON.parse(localStorage['ak-sheet-attractions']);
  if (!attractions) {
    console.log('No saved sheet attractions!');
    return;
  }

  $individualResultsContainer.innerHTML = '';
  $gocityResultsContainer.innerHTML = '';
  $citypassResultsContainer.innerHTML = '';
  attractionsTotalCost = 0;

  const attractionAddedMap = new Map();

  const placeIds = JSON.parse(localStorage['ak-place-ids'] || '[]'); 
  const userAddedAttractions = Object.entries(getAllSliderAttractionNames()); // JSON.parse(localStorage['user-added-items'] || '[]');  
  const normalize = (str) => str?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';

  if (!placeIds.length && !userAddedAttractions.length) {
    console.log('No saved place IDs or user added attractions!');
    resetPassCalc();
    return;
  }

  for (const [id, passInfo] of Object.entries(attractions)) {
    const { place_id, on_pass, attraction_name } = passInfo;

    const isMatchedById = placeIds.includes(place_id);
    const normalizedAttractionName = normalize(attraction_name); 
    const isMatchedByName = userAddedAttractions.some(attraction => 
        attraction[0].includes(normalizedAttractionName) // attraction comes in already normalized
    );

    if ((!isMatchedById && !isMatchedByName) 
      || on_pass.trim().toLowerCase() !== 'true' 
      || attractionAddedMap.has(normalizedAttractionName)) {
      continue;
    }

    attractionAddedMap.set(normalizedAttractionName, true); 

    // if (!placeIds.includes(place_id) || on_pass.trim().toLowerCase() !== 'true' || place_id.trim() === '') continue;

    let { cost, passes, ticket_url } = passInfo;
    cost = cost.replace(/[^0-9.]/g, ''); 

    let $result = $attractionSample.cloneNode(true);
    $result.placeId = place_id; 
    $result.removeAttribute('data-ak'); // data-ak="attraction-sample"
    const $ticketName = $result.querySelector('[data-ak="ticket-name"]'); 
    $ticketName.innerHTML = `${attraction_name}<span class="attraction-cost"> - $${cost}</span>`;

    const $buyBtn = $result.querySelector('[data-ak="ticket-buy-btn"]');
    $buyBtn.setAttribute('buy-link', ticket_url); 

    $buyBtn.addEventListener('click', e => {
      const link = $buyBtn.getAttribute('buy-link');
      window.open(link);
    });

    $result.removeAttribute('data-ak-hidden');

    attractionsTotalCost += Number(cost); 
    $individualResultsContainer.append($result);

    if (on_pass.trim().toLowerCase() !== 'true' || place_id.trim() === '') continue;

    addattractionToPassList(passes, 'go city', $result, place_id, $gocityResultsContainer);
    addattractionToPassList(passes, 'citypass', $result, place_id, $citypassResultsContainer); 
  }
  $individualResultsContainer.removeAttribute('data-ak-hidden');

  const passData = Object.entries(Passes);

  const $gocityName = document.querySelector('[data-ak="pass-name"][named="gocity"]');
  const $gocityPrice = document.querySelector('[data-ak="pass-price"][named="gocity"]');
  const $citypassName = document.querySelector('[data-ak="pass-name"][named="citypass"]');
  const $citypassPrice = document.querySelector('[data-ak="pass-price"][named="citypass"]');


  
  $ticketsTotalPrice.textContent = `$${attractionsTotalCost}`;
  // $ticketsTotalPrice.classList.remove('hidden');
  
  const attractionsNum = $individualResultsContainer.children.length; // placeIds.length; 
  $ticketsNum.textContent = attractionsNum;
  // $ticketsNum.classList.remove('hidden');

  function addattractionToPassList(passes, passName, $resultEl, place_id, $passContainer) {
    const $result = $resultEl.cloneNode(true);
    $result.placeId = place_id; 
    const $ticketName = $result.querySelector('[data-ak="ticket-name"]');
    $ticketName.innerHTML = $ticketName.innerHTML.split('<span')[0].trim();

    $result.querySelector('[data-ak="ticket-buy-btn"]').remove(); 

    if (passes.toLowerCase().includes(passName)) {
      $result.classList.add('active');
      $passContainer.append($result);
      $passContainer.removeAttribute('data-ak-hidden');
    }
    else {
      $result.classList.remove('active');
      const name = $ticketName.textContent.trim();
      
      $ticketName.innerHTML = `<p class="crossed-out">${name}</p>`; 
      $ticketName.closest('.pcrn_list-item').classList.add('strikethrough');

      $passContainer.append($result);
      $passContainer.removeAttribute('data-ak-hidden');
    }
  }

  // GoCity & CityPass

  populateGoCityPasses(passData, 'gocity_explorer', $gocityName, $gocityPrice, $gocityResultsContainer); 
  populateCityPasses(passData, 'citypass', $citypassName, $citypassPrice, $citypassResultsContainer) //, 'citypass', $citypassName, $citypassPrice, $citypassResultsContainer); 

  function populateCityPasses(passData, passName, $passNameEl, $passPriceEl, $passContainer){ //, 'citypass', $citypassName, $citypassPrice, $citypassResultsContainer) {
    resetExtraPass($passNameEl); 
    const passAttractionsNum = $passContainer.querySelectorAll('.active').length;

    if (!passAttractionsNum) {
      $passNameEl.textContent = $passNameEl.textContent.replace(/\s\S+$/, ''); 
      $passPriceEl.textContent = '$0';
      return;
    }

    const passMatches = passData.filter(([id, data]) => data.pass_id.includes(passName));
    const sortedPasses = passMatches
      .sort((a, b) => Number(a[1].attraction_count) - Number(b[1].attraction_count));

    const exactPass = sortedPasses.find(([id, pass]) => {
      return Number(pass.attraction_count) === passAttractionsNum
    });

    // console.log('exactPass:', exactPass)

    const c5Eligible = citypass5EligibilityCheck();  
        
    if (c5Eligible) {
      if (exactPass) {
        const exactPassData = exactPass[1];
        const { pass_name:passName, pass_price:passPrice } = exactPassData;
        $passNameEl.textContent = passName;
        $passPriceEl.textContent = `$${passPrice}`;  
      }
      else {
        const upperLogic = ([id, pass]) => {
          return pass.attraction_count >= passAttractionsNum; 
        };
        const lowerLogic = ([id, pass]) => {
          return pass.attraction_count <= passAttractionsNum; 
        };

        workoutLowerNUpperPass(sortedPasses, upperLogic, lowerLogic, $passNameEl, $passPriceEl); 
      }
    }
    else {
      if (exactPass) {
        const exactPassData = exactPass[1];
        const { pass_name:passName, pass_price:passPrice } = exactPassData;
        if (passName.toLowerCase().includes('c5')) {
          runUpperLowerCalcForIneligibleC5(sortedPasses, passAttractionsNum, $passNameEl, $passPriceEl); 
        }
        else {
          $passNameEl.textContent = passName;
          $passPriceEl.textContent = `$${passPrice}`;  
        } 
      }
      else {
        runUpperLowerCalcForIneligibleC5(sortedPasses, passAttractionsNum, $passNameEl, $passPriceEl); 
      }
    }
  } 

  function runUpperLowerCalcForIneligibleC5(sortedPasses, passAttractionsNum, $passNameEl, $passPriceEl) {
    const upperLogic = ([id, pass]) => {
      return pass.attraction_count >= passAttractionsNum && !pass.pass_name.toLowerCase().includes('c5')
    };
    const lowerLogic = ([id, pass]) => {
      return pass.attraction_count <= passAttractionsNum && !pass.pass_name.toLowerCase().includes('c5')
    }; 

    workoutLowerNUpperPass(sortedPasses, upperLogic, lowerLogic, $passNameEl, $passPriceEl); 
  }

  function workoutLowerNUpperPass(sortedPasses,  upperLogic, lowerLogic, $passNameEl, $passPriceEl) {
    const passUpperLimit = sortedPasses.find(upperLogic);
    const passLowerLimit = [...sortedPasses].reverse().find(lowerLogic);

    let lowerLimitExists;
    if (passLowerLimit && passLowerLimit.length) {
      const lowerLimitPassData = passLowerLimit[1];
      $passNameEl.textContent = lowerLimitPassData.pass_name;
      $passPriceEl.textContent = `$${lowerLimitPassData.pass_price}`; 
      lowerLimitExists = true; 
    }
    
    showExtraPass($passNameEl, $passPriceEl, passUpperLimit, lowerLimitExists);
  }

  function populateGoCityPasses(passData, passName, $passNameEl, $passPriceEl, $passContainer) {
    resetExtraPass($passNameEl); 
    const passAttractionsNum = $passContainer.querySelectorAll('.active').length;
    
    if (!passAttractionsNum) {
      $passNameEl.textContent = $passNameEl.textContent.replace(/\s\S+$/, ''); 
      $passPriceEl.textContent = '$0';
      return;
    }

    const passMatches = passData.filter(([id, data]) => data.pass_id.includes(passName));
    const sortedPasses = passMatches
      .sort((a, b) => Number(a[1].attraction_count) - Number(b[1].attraction_count));

    const exactPass = sortedPasses.find(([id, pass]) => {
      return Number(pass.attraction_count) === passAttractionsNum
    });

    // console.log('exactPass:', exactPass)
    
    if (exactPass) {
      $passNameEl.textContent = exactPass[1].pass_name;
      $passPriceEl.textContent = `$${exactPass[1].pass_price}`;  
    }
    else {
      const passUpperLimit = sortedPasses.find(([id, pass]) => pass.attraction_count >= passAttractionsNum);
      const passLowerLimit = [...sortedPasses].reverse().find(([id, pass]) => pass.attraction_count <= passAttractionsNum);

      // console.log('passUpperLimit:', passUpperLimit)
      // console.log('passLowerLimit:', passLowerLimit)

      let lowerLimitExists;
      if (passLowerLimit && passLowerLimit.length) {
        $passNameEl.textContent = passLowerLimit[1].pass_name;
        $passPriceEl.textContent = `$${passLowerLimit[1].pass_price}`; 
        lowerLimitExists = true; 
      }
      
      showExtraPass($passNameEl, $passPriceEl, passUpperLimit, lowerLimitExists);
    }

    $passNameEl.closest('[data-ak="pass-info"]').classList.remove('hidden');

  }

  function citypass5EligibilityCheck() {
    const addedAttractions = $citypassResultsContainer.querySelectorAll('.active');
    const empireStateBuilding = 'ChIJaXQRs6lZwokRY6EFpJnhNNE';
    const amnh = 'ChIJCXoPsPRYwokRsV1MYnKBfaI';
    const edge = 'ChIJ3aqq5Q1ZwokRb9hLO7Gyxgw';
    const moma = 'ChIJKxDbe_lYwokRVf__s8CPn-o';
    const requiredArr = []; 
    const excludedArr = [];
    
    for (const attraction of addedAttractions) {
        const id = attraction.placeId;
        const name = attraction.querySelector('[data-ak="ticket-name"]').textContent;
        
        if (id.includes(empireStateBuilding) || id.includes(amnh)) {
            requiredArr.push(name);
        }
        else if (id.includes(edge) || id.includes(moma)) {
            excludedArr.push(name);
        }
    }

    // console.log('requiredArr:', requiredArr)
    // console.log('excludedArr:', excludedArr)
    
    if (excludedArr.length > 0 || requiredArr.length < 2) {
        return false;
    }
    
    return true; 
  }

  const gocityNum = $gocityResultsContainer.children.length; 
  if (gocityNum > 10) {
    const daysNum = document.querySelectorAll('.w-slider .w-slide').length;
    const travelDays = daysNum - nonCountDays;

    const passMatches = passData.filter(([id, data]) => data.pass_id.includes('gocity_allinc'));
    const sortedPasses = passMatches
      .sort((a, b) => Number(a[1].attraction_count) - Number(b[1].attraction_count));

    const exactPass = sortedPasses.find(([id, pass]) => {
      // console.log('pass.attraction_count:', pass.attraction_count)
      return Number(pass.trip_days) === travelDays
    });
 
    if (exactPass) {
      // $gocityName.textContent = exactPass[1].pass_name;
      // $gocityPrice.textContent = `$${exactPass[1].pass_price}`;
      
      showExtraPass($gocityName, $gocityPrice, exactPass, true);
    }
    else {
      // const passUpperLimit = sortedPasses.find(([id, pass]) => pass.trip_days >= travelDays); 
      const passLowerLimit = [...sortedPasses].reverse().find(([id, pass]) => pass.trip_days <= travelDays);

      let lowerLimitExists;
      if (passLowerLimit && passLowerLimit.length) {
        // $gocityName.textContent = passLowerLimit[1].pass_name;
        // $gocityPrice.textContent = `$${passLowerLimit[1].pass_price}`; 
        
        lowerLimitExists = true; 
        showExtraPass($gocityName, $gocityPrice, passLowerLimit, lowerLimitExists);
      }
    }
  }



  function showExtraPass($passName, $passPrice, passUpperLimit, lowerLimitExists) {
    if (!passUpperLimit || !passUpperLimit.length) return;
    const $passInfo = $passName.closest('[data-ak="pass-info"]');
    const $or = $passInfo.parentElement.querySelector('.ak-pass-or');
    const $passUpper = $passInfo.parentElement.querySelector('.pass-upper'); 

    resetExtraPass($passName); 

    if (lowerLimitExists) {
      const $passInfoClone = $passInfo.cloneNode(true); 
      $passInfoClone.classList.add('pass-upper'); 
      $passInfoClone.querySelector(`[data-ak="pass-name"]`).textContent = passUpperLimit[1].pass_name;
      $passInfoClone.querySelector(`[data-ak="pass-price"]`).textContent = `$${passUpperLimit[1].pass_price}`; 
      $passInfoClone.classList.remove('hidden');

      $or.classList.remove('hide');
      $or.removeAttribute('data-ak-hidden');
      // if ($passUpper) $passUpper.remove(); 
      $or.insertAdjacentElement('afterend', $passInfoClone);
      
      // const $passUpper = $passInfo.parentElement.querySelector('.pass-upper'); 
      // console.log('First $passUpper', $passUpper)
      // activateSpacers(); 
    } 
    else {
      $passName.textContent = passUpperLimit[1].pass_name;
      $passPrice.textContent = `$${passUpperLimit[1].pass_price}`; 
    }
  } 


  function resetExtraPass($passName) {
    const $passInfo = $passName.closest('[data-ak="pass-info"]');
    const $or = $passInfo.parentElement.querySelector('.ak-pass-or');
    const $passUpper = $passInfo.parentElement.querySelector('.pass-upper'); 
    // console.log('resetExtraPass')
    // console.log('$passName', $passName)
    if ($or) {
      // console.log('$or', $or)
      $or.classList.add('hide');
      $or.setAttribute('data-ak-hidden', true);
    }
    if ($passUpper) $passUpper.remove(); 
  }

  function resetPassCalc() {
    // document.querySelectorAll('[data-ak="pass-info"]').forEach(passInfo => {
    //   const $passName = passInfo.querySelector('[data-ak="pass-name"]');
    //   $passName.textContent = $passName.textContent.replace(/\s\S+$/, ''); 
    //   passInfo.querySelector('[data-ak="pass-price"]').textContent = '$0';
    // }); 

    document.querySelectorAll('.ak-pass-or').forEach(or => {
      const $passInfo = or.parentElement.querySelector('[data-ak="pass-info"]');
      const $passName = $passInfo.querySelector('[data-ak="pass-name"]'); 
      const $passPrice = $passInfo.querySelector('[data-ak="pass-price"]');
      resetExtraPass($passName); 
      $passName.textContent = $passName.textContent.replace(/\s\S+$/, ''); 
      $passPrice.textContent = '$0';
    });

    document.querySelector('[data-ak="tickets-total-price"]').textContent = '$0';
    document.querySelector('[data-ak="tickets-num"]').textContent = '0';

    $individualResultsContainer.innerHTML = '';
    $gocityResultsContainer.innerHTML = '';
    $citypassResultsContainer.innerHTML = '';
  }

  activateSpacers(); 

  function activateSpacers() {
    const $spacers = document.querySelectorAll('[data-ak-spacer]');
    const $orSpacers = document.querySelectorAll('.ak-pass-or:not([data-ak-spacer])');
    const allOrsHidden  =[...$orSpacers].every(el => el.classList.contains('hide'));
    $spacers.forEach(el => {    
      // console.log('el:', el)  
      // console.log("el.parentElement.querySelector('.pass-upper')", el.parentElement.querySelector('.pass-upper'))
      const $parent = el.parentElement;
      const $or = $parent.querySelector('.ak-pass-or');
      if ($parent.querySelector('.pass-upper') || allOrsHidden) {
        el.classList.add('hide');
        el.setAttribute('data-ak-hidden', true);  
        el.classList.remove('non-visible');

        if (allOrsHidden && el.getAttribute('data-ak-center')) {
          el.classList.remove('hide');
          el.removeAttribute('data-ak-hidden'); 
          el.classList.add('non-visible');
        }
      }
      else {
        el.classList.remove('hide');
        el.removeAttribute('data-ak-hidden');  
        el.classList.add('non-visible');
      }
    }); 
  }
});


async function logSheetData() {
  const res = await fetch(firebaseUrl);
  const data = await res.json();
  // console.log('Data:', data);
  return data;
} 



$travelDetails.addEventListener('click', e => {
  handleTravelResultsRemoveLocation(e);
});

function handleTravelResultsRemoveLocation(e) {
  if (!e.target.closest('[data-ak="remove-location"]')) return;
  const $removeBtn = e.target.closest('[data-ak="remove-location"]');
  const $attraction = $removeBtn.closest('[data-ak="attraction-location"]');
  const $resultWrap = $removeBtn.closest('[data-ak-search-result]');

  if ($attraction.marker) {
    $attraction.marker.setMap(null); 
    // markerArr.splice(markerArr.indexOf($attraction.marker), 1);   
  }

  const dataAk = $resultWrap.getAttribute('data-ak');
  const airportType = $resultWrap.getAttribute('data-ak-airport');
  if (airportType) {
    if (airportType.includes('arrival')) {
      localStorage.removeItem('ak-arrival-airport');
      delete markerObj['airport-arrival'];
    }
    else {
      localStorage.removeItem('ak-departure-airport');
      delete markerObj['airport-departure'];
    }
  }
  else if (dataAk.includes('hotel')) {
    localStorage.removeItem('ak-hotel');
    delete markerObj['hotel'];
  }

  $attraction.remove();
  setUnsavedChangesFlag();
}
});

function parseJSON(jsonStr) {
  let jsonObj = null;

  try {
    jsonObj = JSON.parse(jsonStr);
  }
  catch (e) {
      return null;
  }

  return jsonObj;
}

