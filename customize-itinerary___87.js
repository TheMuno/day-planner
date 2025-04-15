import { initializeApp } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, 
    getDocs, updateDoc, deleteField, collection,
    arrayUnion, arrayRemove, serverTimestamp,
    query, where } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-firestore.js";

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

let addedAttractions = localStorage['ak-addedAttractions-count'] 
                       ? Number(localStorage['ak-addedAttractions-count']) 
                       : 0;

window.addEventListener('load', async () => {
  await Clerk.load();
  
  const $loginBtn = document.querySelector('[data-ak="clerk-login"]');
  const $saveBtn = document.querySelector('[data-ak="save-itinerary"]');

  if (Clerk.user) {
    $saveBtn.closest('.ak-save-wrap').classList.remove('hidden');
  }
  else {
    $loginBtn.classList.remove('hidden');
  }

  $loginBtn.addEventListener('click', e => {
    if (Clerk.user) return;
    Clerk.openSignUp({
      redirectUrl: window.location.pathname,
    });
  });

  if (localStorage['ak-referred']) {
    const userMail = localStorage['ak-userMail'];
    await retrieveReferrerAttractions(userMail);
    localStorage.removeItem('ak-referred');
  }
  else {
    if (Clerk.user) { // logged-in user retrieve from DB
      const userMail = localStorage['ak-userMail'];
      const data = await retrieveDBData(userMail); 
      if (!data) return;
      const { tripName, travelDates, savedAttractions } = data;
      restoreSavedAttractions(savedAttractions);
    }
    else if (localStorage['ak-attractions-saved']) { // unlogged-in user retrieve from cache
      const savedAttractions = JSON.parse(localStorage['ak-attractions-saved']);
      restoreSavedAttractions(savedAttractions);
    }
  }
});

const $secondaryMailWrap = document.querySelector('[data-ak="secondary-email-wrap"]');
const $addMailInp = $secondaryMailWrap.querySelector('.ak-add-mail-input-wrap');
const $addMailBtn = $secondaryMailWrap.querySelector('.ak-mail-btn.ak-add-mail');
const $saveMailBtn = $secondaryMailWrap.querySelector('.ak-mail-btn.ak-save-mail');
const $btnsWrap = $secondaryMailWrap.querySelector('.ak-add-mail-btns');
const saveMailBtnText = $saveMailBtn.textContent;

$secondaryMailWrap.addEventListener('click', e => {
  if (!e.target.closest('.ak-remove-inp')) return;
  const $removeBtn = e.target.closest('.ak-remove-inp');
  $removeBtn.closest('.ak-add-mail-input-wrap').remove();
});

$addMailBtn.addEventListener('click', e => {
  const $input = $addMailInp.cloneNode(true);
  $input.querySelector('.ak-add-mail-input').removeAttribute('id');
  $input.querySelector('.ak-add-mail-input').value = '';
  $input.querySelector('.ak-remove-inp').classList.remove('hidden');
  $secondaryMailWrap.insertBefore($input, $btnsWrap);
});

$saveMailBtn.addEventListener('click', async e => {
  $saveMailBtn.textContent = 'Saving...';
  const mailArr = [...$secondaryMailWrap.querySelectorAll('.ak-add-mail-input')].reduce((arr, inp) => {
    const mail = inp.value.trim();
    if (mail) arr.push(mail);
    return arr;
  }, []);

  await saveMailsDB(mailArr);
  $saveMailBtn.textContent = saveMailBtnText;
});

async function saveMailsDB(mailArr) {  
  const userMail = localStorage['ak-userMail'];
  const userRef = doc(db, 'locationsData', `user-${userMail}`);
  const userSnap = await getDoc(userRef);

  const dayObj = { secondaryMail: mailArr };

  if (userSnap.exists()) {
    dayObj.ModifiedAt = serverTimestamp();
    await updateDoc(userRef, dayObj);
  }
  else {
    dayObj.CreatedAt = serverTimestamp();
    await setDoc(userRef, dayObj);
  }
}

async function retrieveDBData(userMail) {
  const userRef = doc(db, 'locationsData', `user-${userMail}`);
  const docSnap = await getDoc(userRef);

  if (!docSnap.exists()) {
      // docSnap.data() will be undefined in this case
      console.log('No user with such email!', userMail);
      return; 
  } 

  return docSnap.data(); 
}

async function retrieveReferrerAttractions(userMail) {
  const data = await retrieveDBData(userMail); 
  if (!data) return;

  const { referrerMail } = data;
  const referrerData = await retrieveDBData(referrerMail); 
  if (!referrerData) return;

  let { secondaryMail, tripName, travelDates, savedAttractions } = referrerData;

  if (tripName) {
    const $tripTitleInfo = document.querySelector('.ak-trip-info');
    const $tripTitle = $tripTitleInfo.querySelector('[data-ak="trip-title"]');

    tripName = tripName.split(/\s+/)[0];
    $tripTitle.querySelector('[data-ak=""]').textContent = `${tripName}'s`;
    $tripTitleInfo.classList.remove('hidden');

    localStorage['ak-user-name'] = tripName;
  }

  if (travelDates) {
    const { flatpickrDate } = JSON.parse(travelDates);
    setupTravelDates(flatpickrDate); 

    localStorage['ak-travel-days'] = travelDates;
  }

  if (!savedAttractions) {
    console.log('No saved attractions!');
    return;
  }

  savedAttractions = JSON.parse(savedAttractions);
  restoreSavedAttractions(savedAttractions);

  console.log('tripName:', tripName)
  console.log('travelDates:', travelDates)
  console.log('Main Email:', userMail)
  console.log('Referrer Email:', referrerMail)

  // console.log('secondaryMail', secondaryMail)
  // console.log('savedAttractions', savedAttractions)

}
 
















let map, infoWindow;
const locatonNYC = { lat: 40.7580, lng: -73.9855 };
const markerPinUrl = 'https://cdn.prod.website-files.com/671ae7755af1656d8b2ea93c/677cc99549bcbb38edad633e_pin24.png';
const directionsUrlBase = 'https://www.google.com/maps/search/';
const mapFetchFields = ['displayName', 'location', 'editorialSummary', 'formattedAddress', 'photos', 'rating', 'reviews'];
// const $timeslots = document.querySelectorAll('[data-ak-timeslots]');
const $titleInfoSkeletonWrap = document.querySelector('.ak-skeleton-wrap');
const $tripTitleInfo = document.querySelector('.ak-trip-info');
const $tripTitle = $tripTitleInfo.querySelector('[data-ak="trip-title"]');
const $attractionsSlider = document.querySelector('[data-ak="locations-slider"]');
const $attractionsSliderMask = $attractionsSlider.querySelector('.w-slider-mask');
const $saveItineraryBtn = document.querySelector('[data-ak="save-itinerary"]');
const markerArr = [];
const attractionslimit = 7;

document.addEventListener('DOMContentLoaded', () => {
  saveAttractionsDB();
});

$saveItineraryBtn.addEventListener('click', e => {
    e.preventDefault();
    saveAttractionsDB();
    console.log('Saved to DB')
});

async function saveAttractionsDB() {  
    if (!localStorage['ak-userMail']) return;
    // const savedAttractions = localStorage['ak-attractions-saved'];
    const userMail = localStorage['ak-userMail'];

    const userRef = doc(db, 'locationsData', `user-${userMail}`);
    const userSnap = await getDoc(userRef);

    let tripName, travelDates, savedAttractions;
    if (localStorage['ak-user-name']) tripName = localStorage['ak-user-name'];
    if (localStorage['ak-travel-days']) travelDates = localStorage['ak-travel-days'];
    if (localStorage['ak-attractions-saved']) savedAttractions = localStorage['ak-attractions-saved'];

    const dayObj = { tripName, travelDates, savedAttractions };

    console.log('dayObj', dayObj)

    if (userSnap.exists()) {
      dayObj.ModifiedAt = serverTimestamp();
      await updateDoc(userRef, dayObj);
    }
    else {
      dayObj.CreatedAt = serverTimestamp();
      await setDoc(userRef, dayObj);
    }
}

async function createUserInFirebase(userMail) {
  const userRef = doc(db, 'locationsData', `user-${userMail}`);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists() || !userMail) return;
  await setDoc(userRef, { CreatedAt: serverTimestamp() }); 
}

// $titleInfoSkeletonWrap.classList.remove('hidden');

!async function initMap() {
  const $map = document.querySelector('.map');
  const { Map, InfoWindow  } = await google.maps.importLibrary('maps');
  const { AdvancedMarkerElement } = await google.maps.importLibrary('marker');
  map = new google.maps.Map($map, {
    zoom: 12,
    center: locatonNYC,
    mapId: 'DEMO_MAP_ID',
    mapTypeControl: false,
  }); 

  infoWindow = new InfoWindow();
}(); 

function addAttractionToList(name, $listName, marker=null) {
  name = format(name); 
  const $location = $listName.querySelector('[data-ak="attraction-location"]').cloneNode(true);
  $location.classList.remove('hidden');
  $location.querySelector('[data-ak="location-title"]').textContent = name; 
  $location.querySelector('[data-ak="location-link-text"]').textContent = name;
  $location.marker = marker;
  $listName.append($location);
}

function createMarker(title, position, editorialSummary=title) {
  const markerPinImg = document.createElement('img');
  markerPinImg.src = markerPinUrl;
  const marker = new google.maps.marker.AdvancedMarkerElement({
      map,
      position,
      title,
      content: markerPinImg,
      gmpClickable: true,
  });
  
  const content = 
  `<div class="marker-popup-title">${title}</div>
  <div class="marker-popup-desc">${editorialSummary || title}</div>`;

  marker.addListener('gmp-click', ({ domEvent, latLng }) => {    
    infoWindow.close();
    infoWindow.setContent(content); // (marker.title);
    infoWindow.open(marker.map, marker);
  });

  return marker;
} 

if (localStorage['ak-user-name'] && !localStorage['ak-referred']) {
  let name = localStorage['ak-user-name'];
  name = name.split(/\s+/)[0];
  const occasion = localStorage['ak-occasion'] ? format(localStorage['ak-occasion']) : '';
  $tripTitle.textContent = `${name}'s ${occasion ? occasion : ''}${occasion.toLowerCase().slice(-4).includes('trip') ? '' : ' Trip'}`;

  showTripTitleInfo();
}
else if (!localStorage['ak-user-name'] && localStorage['ak-occasion']) {
  const occasion = format(localStorage['ak-occasion']); 
  $tripTitle.textContent = `${occasion}${occasion.toLowerCase().slice(-4).includes('trip') ? '' : ' Trip'}`;

  showTripTitleInfo(); 
}
// $tripTitle.classList.remove('hidden');
else {
  showTripTitleInfo(); 
}

function showTripTitleInfo() {
  // $titleInfoSkeletonWrap.classList.add('hidden'); 
  $tripTitleInfo.classList.remove('hidden');
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
      // types: ['lodging,restaurant,room,food,tourist_attraction'],
  });

  const $autocompleteWrap = document.querySelector('[data-ak="hotel-autocomplete"]');
  $autocompleteWrap?.appendChild(placeAutocomplete);

  const placeholderText = 'Search for hotel...'; 
  if (placeAutocomplete.Eg) {
    placeAutocomplete.Eg.setAttribute('placeholder', placeholderText);
  }

  // Add the gmp-placeselect listener, and display the results.
  placeAutocomplete.addEventListener('gmp-select', async (res) => {
    const { placePrediction } = res;
    const place = placePrediction.toPlace();
    await place.fetchFields({ fields: ['displayName', 'location', 'editorialSummary'] });
    const placeObj = place.toJSON(); 

    resetUserInputField();
    function resetUserInputField() {
      if (!res.srcElement?.Eg) return;
      const $userInput = res.srcElement?.Eg;
      $userInput.value = '';
      $userInput.setAttribute('placeholder', placeholderText);
    }
    
    const { 
      displayName, 
      location: { lat, lng },
      editorialSummary,
    } = placeObj; 

    const marker = createMarker(displayName, {lat, lng}, editorialSummary); 
    markerArr.push(marker); 
});
}(); 

!async function setupAirportAutocomplete() {
  await google.maps.importLibrary('places');

  // Create the input HTML element, and append it.
  const placeAutocomplete = new google.maps.places.PlaceAutocompleteElement({
      componentRestrictions: {country: ['us']},
      types: ['airport'],
  });
  
  const $autocompleteWrap = document.querySelector('[data-ak="airport-autocomplete"]');
  $autocompleteWrap?.appendChild(placeAutocomplete);

  const placeholderText = 'Search for airport...'; 
  if (placeAutocomplete.Eg) {
    placeAutocomplete.Eg.setAttribute('placeholder', placeholderText);
  }

  // Add the gmp-placeselect listener, and display the results.
  placeAutocomplete.addEventListener('gmp-select', async (res) => {
    const { placePrediction } = res;
    const place = placePrediction.toPlace();
    await place.fetchFields({ fields: ['displayName', 'location', 'editorialSummary'] });
    const placeObj = place.toJSON(); 

    resetUserInputField();
    function resetUserInputField() {
      if (!res.srcElement?.Eg) return;
      const $userInput = res.srcElement?.Eg;
      $userInput.value = '';
      $userInput.setAttribute('placeholder', placeholderText);
    }
    
    const { 
      displayName, 
      location: { lat, lng },
      editorialSummary,
    } = placeObj; 

    const marker = createMarker(displayName, {lat, lng}, editorialSummary); 
    markerArr.push(marker); 
});
}(); 

!async function setupAutocompleteInp() {
  await google.maps.importLibrary('places');

  // Create the input HTML element, and append it.
  const placeAutocomplete = new google.maps.places.PlaceAutocompleteElement({
      componentRestrictions: { country: ['us'] },
  });

  const $autocompleteWrap = document.querySelector('.ak-autocomplete');
  $autocompleteWrap.appendChild(placeAutocomplete);

  const searchAttractionsPlaceholderTxt = 'Add an activity...';

  if (placeAutocomplete.Eg) {
    placeAutocomplete.Eg.setAttribute('placeholder', searchAttractionsPlaceholderTxt);
  } 

  // Add the gmp-placeselect listener, and display the results.
  placeAutocomplete.addEventListener('gmp-select', async (res) => {
      if (!localStorage['ak-userMail'] && addedAttractions >= attractionslimit) {
        alert('Max Limit Reached. Login To Add More');
        resetUserInputField();
        return;
      }

      addedAttractions += 1;
      localStorage['ak-addedAttractions-count'] = addedAttractions; 

      resetUserInputField();
      function resetUserInputField() {
        if (!res.srcElement?.Eg) return;
        const $userInput = res.srcElement?.Eg;
        $userInput.value = '';
        $userInput.setAttribute('placeholder', searchAttractionsPlaceholderTxt);
      }

      const { placePrediction } = res;
      const place = placePrediction.toPlace();
      await place.fetchFields({ fields: ['displayName', 'location', 'editorialSummary'] });

      if (place.viewport) {
        map.fitBounds(place.viewport);
      }
      else {
        map.setCenter(place.location);
        // map.setZoom(17);
      }

      const placeObj = place.toJSON(); 
      
      const { 
        displayName, 
        location: { lat, lng },
        editorialSummary,
      } = placeObj; 

      const marker = createMarker(displayName, {lat, lng}, editorialSummary); 
      markerArr.push(marker); 

      const { $currentSlide, slideIndex } = getCurrentSlideInfo();

      const saveObj = {
        // marker,
        location: { lat, lng }, 
        displayName,
        editorialSummary,
      };

      const addNSaveObj = { slideIndex, displayName, marker, saveObj };
      processAttractionSave($currentSlide, addNSaveObj);
  });

  function processAttractionSave($currentSlide, addNSaveObj) {
    const $activeTimeslot = $currentSlide.querySelector('[data-ak-timeslots].active'); 
    const $morningTimeslot = $currentSlide.querySelector('[data-ak-timeslot="morning"]'); 
    let $timeslot = $activeTimeslot ? $activeTimeslot : $morningTimeslot;
    expandContentWrap($timeslot);
    addNSaveAttraction($timeslot, addNSaveObj);
  }

  function expandContentWrap($timeslot) {
    if ($timeslot.querySelector('[data-ak-timeslot-content]').style.height === '0px') {
      $timeslot.querySelector('[data-ak-timeslot-title]').click(); 
    }
  }

  function addNSaveAttraction($timeslot, addNSaveObj) {
    const { slideIndex, displayName, marker, saveObj } = addNSaveObj;
    const $timeslotWrap = $timeslot.querySelector('[data-ak-timeslot-wrap]'); 
    const timeslotName = $timeslot.getAttribute('data-ak-timeslot'); // .querySelector('[data-ak-timeslot-title]').textContent.trim().toLowerCase(); 
    if (attractionExists($timeslotWrap, displayName)) {
      alert('Sorry, Already Added!');
      return;
    }
    addAttractionToList(displayName, $timeslotWrap, marker);
    saveAttractionLocal(timeslotName, slideIndex, saveObj); 
  }
}();   

function attractionExists(wrap, name) {
  const match = [...wrap.querySelectorAll('[data-ak="attraction-location"]:not(.hidden) [data-ak="location-title"]')].filter(attraction => {
    const attractionName = attraction.textContent.toLowerCase().trim();
    return attractionName === name.toLowerCase().trim();
  });
  // console.log('match:::', match)
  // console.log(':::', match[0])
  return match.length; 
}

function saveAttractionLocal(currentTimeslotName, slideIndex, saveObj) {
  const savedAttractions = localStorage['ak-attractions-saved'] ? JSON.parse(localStorage['ak-attractions-saved']) : {};
  savedAttractions[`slide${slideIndex}`] = savedAttractions[`slide${slideIndex}`] || {};
  savedAttractions[`slide${slideIndex}`][currentTimeslotName] = savedAttractions[`slide${slideIndex}`][currentTimeslotName] || [];
  savedAttractions[`slide${slideIndex}`][currentTimeslotName].push(saveObj);
  
  localStorage['ak-attractions-saved'] = JSON.stringify(savedAttractions);
}

$attractionsSlider.addEventListener('click', e => {
  if (!e.target.closest('[data-ak-timeslot-title]')) return;
  const $currentSlide = e.target.closest('.w-slide');
  $currentSlide.querySelector('[data-ak-timeslots].active')?.classList.remove('active');
  const $timeslot = e.target.closest('[data-ak-timeslots]');
  $timeslot.classList.add('active');
});

document.body.addEventListener('dragstart', e => {
  if (!e.target.closest('[data-ak="attraction-location"]')) return;
  const $dragEl = e.target.closest('[data-ak="attraction-location"]'); 
  const attractionName = $dragEl.querySelector('[data-ak="location-title"]').textContent.toLowerCase().trim();
  const fromTimeslot = e.target.closest('[data-ak-timeslot-wrap]').getAttribute('data-ak-timeslot-wrap').toLowerCase().trim(); 
  const data = JSON.stringify({ attractionName, fromTimeslot });
  e.dataTransfer.setData('text/plain', data);
  e.dataTransfer.dropEffect = 'move';
});

document.body.addEventListener('dragover', e => {
  if (!e.target.closest('[data-ak="allow-drop"]')) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
});

document.body.addEventListener('dragover', e => {
  if (!e.target.closest('[data-ak-timeslot-title]')) return;
  const $title = e.target.closest('[data-ak-timeslot-title]');
  const $contentWrap = e.target.closest('[data-ak-timeslots]').querySelector('[data-ak-timeslot-content]');
  if ($contentWrap.style.height !== '0px') return;
  $title.click(); 
});

document.body.addEventListener('drop', e => {
  if (!e.target.closest('[data-ak="allow-drop"]')) return;
  const $dropZone = e.target.closest('[data-ak="allow-drop"]'); 
  e.preventDefault();
  // Get the id of the target and add the moved element to the target's DOM
  const data = e.dataTransfer.getData('text/plain');
  const { attractionName, fromTimeslot } = JSON.parse(data);

  const { $currentSlide, slideIndex } = getCurrentSlideInfo();
  const $activeTimeslot = $currentSlide.querySelector('[data-ak-timeslots].active'); 
  const $morningTimeslot = $currentSlide.querySelector('[data-ak-timeslot="morning"]'); 
  const $timeslot = $activeTimeslot ? $activeTimeslot : $morningTimeslot;
  const $timeslotWrap = $timeslot.querySelector('[data-ak-timeslot-wrap]'); 

  /*if (attractionExists($timeslotWrap, attractionName)) {
    alert('Sorry, Already Added!');
    return; 
  }*/

  const matchingAttraction = [...document.querySelectorAll('[data-ak="attraction-location"]:not(.hidden)')].filter(attraction => {
    const text = attraction.querySelector('[data-ak="location-title"]').textContent.toLowerCase().trim();
    return attractionName.includes(text);
  })[0];

  if (matchingAttraction) {
    $dropZone.appendChild(matchingAttraction);
  }
  else {
    console.log('No matching attraction to move!');
  }

  const currentTimeslot = e.target.closest('[data-ak-timeslot-wrap]').getAttribute('data-ak-timeslot-wrap').toLowerCase().trim(); 
  const savedAttractions = localStorage['ak-attractions-saved'] ? JSON.parse(localStorage['ak-attractions-saved']) : {};
  const savedtimeslotAttractions = savedAttractions[`slide${slideIndex}`][fromTimeslot];
  
  if (savedtimeslotAttractions) {
    const savedAttr = savedtimeslotAttractions.filter(attr => data.includes(attr.displayName.toLowerCase().trim()))[0];
    if (savedAttr) {
      const draggedAttr = savedAttractions[`slide${slideIndex}`][fromTimeslot].splice(savedtimeslotAttractions.indexOf(savedAttr), 1)[0];
      savedAttractions[`slide${slideIndex}`][currentTimeslot] = savedAttractions[`slide${slideIndex}`][currentTimeslot] || [];
      savedAttractions[`slide${slideIndex}`][currentTimeslot].push(draggedAttr);
      localStorage['ak-attractions-saved'] = JSON.stringify(savedAttractions);
    }
  }
});

function getCurrentSlideInfo() {
  const $currentSlide = document.querySelector('.w-slide:not([aria-hidden="true"])');
  const slideIndex = [...$attractionsSliderMask.querySelectorAll('.w-slide')].indexOf($currentSlide) + 1;
  return { $currentSlide, slideIndex }; 
}

document.body.addEventListener('click', e => {
  if (e.target.closest('[data-ak="locations-slider-wrap"]')) return;
  const $currentSlide = document.querySelector('.w-slide:not([aria-hidden="true"])');
  if ($currentSlide) $currentSlide.querySelector('[data-ak-timeslots].active')?.classList.remove('active');
});

document.body.addEventListener('click', e => {
  if (!e.target.closest('[data-ak="remove-location"]')) return;
  const $attraction = e.target.closest('[data-ak="attraction-location"]');
  const attrName = $attraction.querySelector('[data-ak="location-title"]').textContent.toLowerCase().trim();

  const { slideIndex } = getCurrentSlideInfo();
  const savedAttractions = JSON.parse(localStorage['ak-attractions-saved']);
  if (!savedAttractions || !Object.keys(savedAttractions).length) return;
  
  const timeslot = e.target.closest('[data-ak-timeslot-wrap]').getAttribute('data-ak-timeslot-wrap').toLowerCase().trim(); 
  const timeslotArr = savedAttractions[`slide${slideIndex}`][timeslot];
  const attrMatch = timeslotArr?.filter(attr => attrName.includes(attr.displayName.toLowerCase().trim()))[0];
  if (attrMatch) timeslotArr.splice(timeslotArr.indexOf(attrMatch),1);
  localStorage['ak-attractions-saved'] = JSON.stringify(savedAttractions);

  if ($attraction.marker) {
    $attraction.marker.setMap(null); 
    markerArr.splice(markerArr.indexOf($attraction.marker), 1);   
  }
  $attraction.remove();

  addedAttractions -= 1;
  localStorage['ak-addedAttractions-count'] = addedAttractions; 
});

document.body.addEventListener('click', e => {
  if (!e.target.closest('[data-ak="location-link"]')) return;
  const $location = e.target.closest('[data-ak="attraction-location"]');
  const $prevLocation = $location.previousElementSibling;

  if (!$location.marker) {
    console.log('Sorry! No location marker info.');
    return; 
  }

  const lat = $location.marker?.position.lat || null;
  const lng = $location.marker?.position.lng || null; 

  if (!lat) {
    console.log('Sorry! No location marker info.');
    return; 
  }

  const url = `${directionsUrlBase}?api=1&query=${lat}%2C${lng}`;  
  window.open(url); 
});

if (localStorage['ak-travel-days'] && !localStorage['ak-referred']) {
  const { flatpickrDate } = JSON.parse(localStorage['ak-travel-days']);
  setupTravelDates(flatpickrDate); 
}

function setupTravelDates(flatpickrDate) {
  // const { flatpickrDate } = JSON.parse(localStorage['ak-travel-days']);
  let [ startDate, endDate ] = flatpickrDate.split(/\s+to\s+/);
  
  const daysArr = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthArr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  setupTitleTravelDates(); 

  function setupTitleTravelDates() {
    let titleStartDate = new Date(startDate);
    let titleEndDate = new Date(endDate);
    titleStartDate = `${monthArr[titleStartDate.getMonth()]} ${titleStartDate.getDate()}`;
    titleEndDate = `${monthArr[titleEndDate.getMonth()]} ${titleEndDate.getDate()}`;

    const titleDates = `${titleStartDate} - ${titleEndDate}`;
    const $titleTravelDates = document.querySelector('[data-ak="title-travel-dates"]');
    $titleTravelDates.textContent = titleDates;
  }

  setupSliderDates(); 
  reInitWebflow();

  function setupSliderDates() {
    const $firstSlide = $attractionsSlider.querySelector('.w-slide');
    const numberOfDays = daysBetween(startDate, endDate);

    const theStartDate = new Date(startDate);
    updateDayNDate($firstSlide, getDateDetails(theStartDate)); 
    
    for (let i = 0; i < numberOfDays; i++) {
      const newDate = new Date(theStartDate.setDate(theStartDate.getDate() + 1)); 
      const dateDetails = getDateDetails(newDate); 

      const $slideClone = $firstSlide.cloneNode(true); 

      updateDayNDate($slideClone, dateDetails); 

      $attractionsSliderMask.append($slideClone);
    } 
  }

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

  function getUTC(date) {
    var result = new Date(date);
    result.setMinutes(result.getMinutes() - result.getTimezoneOffset());
    return result;
  }
  
  function daysBetween(startDate, endDate) {
    var millisecondsPerDay = 24 * 60 * 60 * 1000;
    return (getUTC(endDate) - getUTC(startDate)) / millisecondsPerDay;
  }

  function reInitWebflow() {
    Webflow.destroy();
    Webflow.ready();
    Webflow.require('ix2').init(); 
  }
} 
  
function restoreSavedAttractions(savedAttractions) {
  // if (!localStorage['ak-userMail'] && addedAttractions >= attractionslimit) {
  //   alert('Max Limit Reached. Login To Add More');
  //   return;
  // }

  // if (!localStorage['ak-attractions-saved']) return;

  // addedAttractions += 1;
  // localStorage['ak-addedAttractions-count'] = addedAttractions; 
  
  // const savedAttractions = JSON.parse(localStorage['ak-attractions-saved']);
  for (const [slide, attractions] of Object.entries(savedAttractions)) {
    const slideNum = Number(slide.match(/\d+/)[0]);
    const $currentSlide = [...$attractionsSliderMask.querySelectorAll('.w-slide')][slideNum-1];
    const $morningWrap = $currentSlide.querySelector('[data-ak-timeslot-wrap="morning"]');
    const $afternoonWrap = $currentSlide.querySelector('[data-ak-timeslot-wrap="afternoon"]');
    const $eveningWrap = $currentSlide.querySelector('[data-ak-timeslot-wrap="evening"]');

    const { morning, afternoon, evening } = attractions;
    if (morning) {
      processTimeslot(morning, $morningWrap);
    }
    if (afternoon) {
      processTimeslot(afternoon, $afternoonWrap);
    }
    if (evening) {
      processTimeslot(evening, $eveningWrap);
    }
  }

  function processTimeslot(timeslot, $sectionWrap) {
    timeslot.forEach(slot => {
      const { displayName, editorialSummary, location } = slot;
      const marker = createMarker(displayName, location, editorialSummary);
      addAttractionToList(displayName, $sectionWrap, marker);
    });
    const $timeslotSec = $sectionWrap.closest('[data-ak-timeslots]');
    if ($timeslotSec.querySelector('[data-ak-timeslot-content]').style.height === '0px') {
      $timeslotSec.querySelector('[data-ak-timeslot-title]').click(); 
    }
  }
}   
