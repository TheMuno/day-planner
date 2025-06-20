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


let map, infoWindow;
const locationNYC = { lat: 40.7580, lng: -73.9855 };
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
const $unsavedChanges = document.querySelector('[data-ak="slider-locations-changes"]');

const markerArr = [];
const attractionslimit = 7;


let addedAttractions = localStorage['ak-addedAttractions-count'] 
                       ? Number(localStorage['ak-addedAttractions-count']) 
                       : 0;

            
!async function initMap() {
  const $map = document.querySelector('.map');
  const { Map, InfoWindow  } = await google.maps.importLibrary('maps');
  const { AdvancedMarkerElement } = await google.maps.importLibrary('marker');
  map = new google.maps.Map($map, {
    zoom: 12,
    center: locationNYC,
    mapId: 'DEMO_MAP_ID',
    mapTypeControl: false,
  }); 

  infoWindow = new InfoWindow();
}(); 


window.addEventListener('load', async () => {
  await Clerk.load();

  updateSavedChangesFlag();
  hideShowLoginNSavebtn();

  function updateSavedChangesFlag() {
    if (localStorage['ak-unsaved-changes']) {
      setUnsavedChangesFlag();
    }
  }

  function hideShowLoginNSavebtn() {
    const $loginBtn = document.querySelector('[data-ak="clerk-login"]');
    const $saveBtn = document.querySelector('[data-ak="save-itinerary"]');

    if (Clerk.user) {
      $saveBtn.closest('.ak-save-wrap').classList.remove('hidden');
      // saveAttractionsDB();
    }
    else {
      $loginBtn.classList.remove('hidden');
      $loginBtn.addEventListener('click', e => {
        if (Clerk.user) return;
        Clerk.openSignUp({
          redirectUrl: window.location.pathname,
        });
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

      return;
    }

    function handleUserNotSavedInDB() {
      console.log('::::Found no data --- Absolutely new user!')

      // remove travel-days in case someone else had logged in with other account & selected dates
      // username & email already removed every time a user logs out in site settings
      // travel-days can't be removed on log-out to accommodate non-logged in users
      if (!localStorage['ak-travel-days-update']) {
        localStorage.removeItem('ak-travel-days'); 
      }

      // remove potential remainders in case someone else had logged in with other account
      // localStorage.removeItem('ak-hotel');
      // localStorage.removeItem('ak-arrival-airport');
      // localStorage.removeItem('ak-departure-airport');
      // localStorage.removeItem('ak-attractions-saved');
      // localStorage.removeItem('ak-addedAttractions-count');

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

    const { referrerMail } = data;
    if (referrerMail) {
      console.log('Referred user!')
      const referrerData = await retrieveReferrerData(referrerMail);
      localStorage['ak-referrer-mail'] = referrerMail;

      const { 
        secondaryMail, 
        tripName, 
        travelDates, 
        hotel, 
        arrivalAirport, 
        departureAirport, 
        savedAttractions, 
        ModifiedAt 
      } = referrerData;

      console.log('tripName:', tripName)
      console.log('travelDates:', travelDates)
      console.log('secondaryMail', secondaryMail)
      // console.log('savedAttractions', savedAttractions)
      console.log('hotel', hotel)
      console.log('arrivalAirport', arrivalAirport)
      console.log('departureAirport', departureAirport)

      let userTravelDates;
      if (localStorage['ak-travel-days-update']) {
        userTravelDates = localStorage['ak-travel-days']; 
        localStorage.removeItem('ak-travel-days-update');
        // $unsavedDateChanges.classList.remove('hide'); 
      }
      else {
        userTravelDates = travelDates;
      }

      // userTravelDates = localStorage['ak-travel-days-update'] ? localStorage['ak-travel-days'] : travelDates;
      // localStorage.removeItem('ak-travel-days-update');

      // if (hotel) localStorage['ak-hotel'] = hotel;
      // if (arrivalAirport) localStorage['ak-arrival-airport'] = arrivalAirport;
      // if (departureAirport) localStorage['ak-departure-airport'] = departureAirport;

      setupUserInfo(savedAttractions, tripName, userTravelDates, hotel, arrivalAirport, departureAirport);

      const $selectPlanList = document.querySelector('[data-ak="select-plan-list"]');
      const $currentPlanData = document.querySelector('[data-ak="current-plan-data"]');
      $currentPlanData.textContent = referrerMail;

      $selectPlanList.addEventListener('click', e => {
        if (!e.target.closest('.w-dropdown-link')) return;
        const text = e.target.textContent;
        $currentPlanData.textContent = text;
      });
      
      processSelectPlanList(data, userMail, $selectPlanList);
      processSelectPlanList(referrerData, referrerMail, $selectPlanList);
      
      const $currentPlanWrap = document.querySelector('.ak-current-plan-wrap');
      $currentPlanWrap.classList.remove('hide');

      localStorage.removeItem('ak-referred');

      const $createOwnPlanBtn = document.querySelector('[data-ak="create-own-plan"]');
      $createOwnPlanBtn.addEventListener('click', async e => {
        $createOwnPlanBtn.textContent = 'Processing...';
        await severTiesToReferrer();
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
        // localStorage.removeItem('ak-numberOfWeeks');

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

      function processSelectPlanList(data, mail, $selectPlanList) {
        let { tripName } = data;
        const theMail = `${mail}${mail === userMail ? ' (me)' : ''}`;
        const linkName = tripName ? `${tripName.split(/\s+/)[0]} - ${theMail}` : theMail;
        setupSelectPlanList($selectPlanList, linkName);
      }

      function setupSelectPlanList($selectPlanList, linkName) {
        const $navLink = $selectPlanList.querySelector('.w-dropdown-link');
        const $navLinkClone = $navLink.cloneNode(true); 
        $navLinkClone.textContent = linkName;
        $navLinkClone.classList.remove('hide');
        $selectPlanList.append($navLinkClone);
      }
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
      
      const { 
        tripName, 
        travelDates, 
        savedAttractions,
        hotel, 
        arrivalAirport, 
        departureAirport 
       } = data;

      const userName = Clerk?.user?.externalAccounts?.[0]?.firstName;
      const userTripName = userName ? userName : tripName;

      let userTravelDates, userAttractions, userHotel, userArrivalAirport, userDepartureAirport;

      if (localStorage['ak-travel-days-update']) {
        userTravelDates = localStorage['ak-travel-days']; 
        localStorage.removeItem('ak-travel-days-update');
        // $unsavedDateChanges.classList.remove('hide'); 
      }
      else {
        userTravelDates = travelDates;
      }

      // userTravelDates = localStorage['ak-travel-days-update'] ? localStorage['ak-travel-days'] : travelDates;
      // localStorage.removeItem('ak-travel-days-update');

      // if (hotel) localStorage['ak-hotel'] = hotel;
      // if (arrivalAirport) localStorage['ak-arrival-airport'] = arrivalAirport;
      // if (departureAirport) localStorage['ak-departure-airport'] = departureAirport;

      if (localStorage['ak-attractions-update']) {
        userAttractions = localStorage['ak-attractions-saved'];
        localStorage.removeItem('ak-attractions-update');
      }
      // if (localStorage['ak-attractions-saved']) {
      //   userAttractions = localStorage['ak-attractions-saved'];
      // }
      else {
        userAttractions = savedAttractions;
      }

      if (localStorage['ak-hotel-update']) {
        userHotel = localStorage['ak-hotel'];
        localStorage.removeItem('ak-hotel-update');
      }
      else {
        userHotel = hotel;
      }

      if (localStorage['ak-arrival-airport-update']) {
        userArrivalAirport = localStorage['ak-arrival-airport'];
        localStorage.removeItem('ak-arrival-airport-update');
      }
      else {
        userArrivalAirport = arrivalAirport;
      }

      if (localStorage['ak-departure-airport-update']) {
        userDepartureAirport = localStorage['ak-departure-airport'];
        localStorage.removeItem('ak-departure-airport-update');
      }
      else {
        userDepartureAirport = departureAirport;
      }

      // const userHotel = localStorage['ak-hotel'] ? localStorage['ak-hotel'] : hotel;
      // const userArrivalAirport = localStorage['ak-arrival-airport'] ? localStorage['ak-arrival-airport'] : arrivalAirport;
      // const userDepartureAirport = localStorage['ak-departure-airport'] ? localStorage['ak-departure-airport'] : departureAirport;

      setupUserInfo(userAttractions, userTripName, userTravelDates, userHotel, userArrivalAirport, userDepartureAirport);

      // saveAttractionsDB(); 

      /*if (localStorage['ak-travel-days-update']
        || localStorage['ak-attractions-saved']
        || localStorage['ak-hotel']
        || localStorage['ak-arrival-airport']
        || localStorage['ak-departure-airport']
      ) {
        setUnsavedChangesFlag(); 
      }*/
    }
  }
  else if (localStorage['ak-attractions-saved']) { // unlogged-in user retrieve from cache
    // const savedAttractions = JSON.parse(localStorage['ak-attractions-saved']);
    const savedAttractions = localStorage['ak-attractions-saved'];

    // console.log('savedAttractions ----------->', savedAttractions) 
    console.log('Logged out user')

    const travelDates = localStorage['ak-travel-days'];
    const hotel = localStorage['ak-hotel'];
    const arrivalAirport = localStorage['ak-arrival-airport'];
    const departureAirport = localStorage['ak-departure-airport'];

    setupUserInfo(savedAttractions, undefined, travelDates, hotel, arrivalAirport, departureAirport);
  }
  else {
    const travelDates = localStorage['ak-travel-days'];
    const hotel = localStorage['ak-hotel'];
    const arrivalAirport = localStorage['ak-arrival-airport'];
    const departureAirport = localStorage['ak-departure-airport'];
    setupUserInfo(undefined, undefined, travelDates, hotel, arrivalAirport, departureAirport);
    
    showTripInfoHeader(); 
  }

  const $secondaryEmailWrap = document.querySelector('[data-ak="add-secondary-email-section"]');
  if (!localStorage['ak-referrer-mail']) {
    $secondaryEmailWrap.removeAttribute('data-ak-hidden');
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
  //}

  document.body.addEventListener('click', e => {
    handleRemoveLocation(e);
  });

  document.body.addEventListener('dragstart', e => {
    handleDragStart(e);
  });

  document.body.addEventListener('dragover', e => {
    handleDragOver(e);
  });

  document.body.addEventListener('dragover', e => {
    expandContentWrap(e);
  });

  document.body.addEventListener('drop', e => {
    handleDrop(e);
  });

  function handleRemoveLocation(e) {
    if (!e.target.closest('[data-ak="remove-location"]')) return;
    console.log('e.target::::::', e.target)

    const $removeBtn = e.target.closest('[data-ak="remove-location"]');
    const $attraction = $removeBtn.closest('[data-ak="attraction-location"]');

    console.log('$removeBtn', $removeBtn)
    console.log('$attraction', $attraction)

    // if (Clerk.user) {
    //   setUnsavedChangesFlag(); 
    // }
    // else {
      const attrName = $attraction.querySelector('[data-ak="location-title"]').textContent.toLowerCase().trim();
      const { slideIndex } = getCurrentSlideInfo();
      const savedAttractions = localStorage['ak-attractions-saved'];
      if (!savedAttractions || !Object.keys(savedAttractions).length) return;
      const savedAttractionsParsed = JSON.parse(savedAttractions);
      
      const timeslot = $removeBtn.closest('[data-ak-timeslot-wrap]').getAttribute('data-ak-timeslot-wrap').toLowerCase().trim(); 
      const timeslotArr = savedAttractionsParsed[`slide${slideIndex}`][timeslot];
      const attrMatch = timeslotArr?.filter(attr => attrName.includes(attr.displayName.toLowerCase().trim()))[0];
      if (attrMatch) timeslotArr.splice(timeslotArr.indexOf(attrMatch),1);
      localStorage['ak-attractions-saved'] = JSON.stringify(savedAttractionsParsed);
      localStorage['ak-attractions-update'] = true;
      setUnsavedChangesFlag(); 
    // }

    if ($attraction.marker) {
      $attraction.marker.setMap(null); 
      markerArr.splice(markerArr.indexOf($attraction.marker), 1);   
    }
    $attraction.remove();
  
    addedAttractions -= 1;
    localStorage['ak-addedAttractions-count'] = addedAttractions; 
  }

  function handleDragStart(e) {
    if (!e.target.closest('[data-ak="attraction-location"]')) return;
    const $dragEl = e.target.closest('[data-ak="attraction-location"]'); 
    const attractionName = $dragEl.querySelector('[data-ak="location-title"]').textContent.toLowerCase().trim();
    const fromTimeslot = e.target.closest('[data-ak-timeslot-wrap]').getAttribute('data-ak-timeslot-wrap').toLowerCase().trim(); 
    const data = JSON.stringify({ attractionName, fromTimeslot });
    e.dataTransfer.setData('text/plain', data);
    e.dataTransfer.dropEffect = 'move';
  }

  function handleDragOver(e) {
    if (!e.target.closest('[data-ak="allow-drop"]')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function expandContentWrap(e) {
    if (!e.target.closest('[data-ak-timeslot-title]')) return;
    const $title = e.target.closest('[data-ak-timeslot-title]');
    const $contentWrap = e.target.closest('[data-ak-timeslots]').querySelector('[data-ak-timeslot-content]');
    if ($contentWrap.style.height !== '0px') return;
    $title.click(); 
  }

  function handleDrop(e) {
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

    // if (Clerk.user) {
    //   setUnsavedChangesFlag(); 
    // }
    // else {
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
          localStorage['ak-attractions-update'] = true; 
        }
      }
      setUnsavedChangesFlag(); 
    // }
  }

// });




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

  for (const mail of mailArr) {
    const mailRef = doc(db, 'locationsData', `user-${mail}`);
    const saveObj = { 
      CreatedAt: serverTimestamp(),
      referrerMail: userMail,
    };
    await setDoc(mailRef, saveObj);
  }
}

async function retrieveReferrerData(mail) {
  const referrerData = await retrieveDBData(mail); 
  if (!referrerData) return;
  // const { secondaryMail, tripName, travelDates, savedAttractions, hotel, arrivalAirport, departureAirport } = referrerData;
  // return { secondaryMail, tripName, travelDates, savedAttractions };
  return referrerData;
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
  processSavedAttractions(savedAttractions);
}

function processTripInfoHeader(tripName, travelDates) {
  setupTripNameNTravelDates(tripName, travelDates); 
  showTripInfoHeader(); 
}

function processSavedAttractions(savedAttractions) {
  if (savedAttractions) {
    const savedAttractionsParsed = JSON.parse(savedAttractions);
    restoreSavedAttractions(savedAttractionsParsed);
  }
  else {
    console.log('No saved attractions!');
  }
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
  
  function daysBetween(startDate, endDate) {
    var millisecondsPerDay = 24 * 60 * 60 * 1000;
    return (new Date(endDate) - new Date(startDate)) / millisecondsPerDay;
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

      const titleDates = `${titleStartDate} - ${titleEndDate}`;
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
  if (hotel) {
    processLocation(hotel, '[data-ak="hotel-search-result"]');
  }

  if (arrivalAirport) {
    processLocation(arrivalAirport, '[data-ak="airport-search-result"][data-ak-airport="arrival"]'); 
  }

  if (departureAirport) {
    processLocation(departureAirport, '[data-ak="airport-search-result"][data-ak-airport="departure"]'); 
  }

  function processLocation(location, $resultWrapName) {
    const locationDetails = JSON.parse(location);
    const $resultWrap = document.querySelector($resultWrapName);
    setupLocation(locationDetails, $resultWrap); 
  }

  function setupLocation(locationDetails, $resultWrap) {
    const { 
      displayName, 
      location: { lat, lng },
      editorialSummary,
    } = locationDetails;

    const marker = createMarker(displayName, {lat, lng}, editorialSummary); 
    // markerArr.push(marker); 
    addLocationToResultWrap(displayName, marker, $resultWrap); 
  }
}


/*
let map, infoWindow;
const locationNYC = { lat: 40.7580, lng: -73.9855 };
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
*/

/*document.addEventListener('DOMContentLoaded', () => {
  saveAttractionsDB();
});*/

/*const $clerkLoginBtn = document.querySelector('[data-ak="clerk-login"]');
$clerkLoginBtn.addEventListener('click', e => {
  e.preventDefault();
  saveAttractionsDB();
  console.log('Saved to DB')
  window.location.href = '/log-in';
});*/

$saveItineraryBtn.addEventListener('click', async e => {
    e.preventDefault();
    await saveAttractionsDB();
    console.log('============================');
    console.log('Saved to DB')
    // localStorage.removeItem('ak-attractions-saved');
    // $unsavedChanges.classList.add('hide');
    removeUnsavedChangesFlag(); 
});

async function saveAttractionsDB() {  
    if (!localStorage['ak-userMail']) return;
    // const savedAttractions = localStorage['ak-attractions-saved'];
    const userMail = localStorage['ak-referrer-mail'] ? localStorage['ak-referrer-mail'] : localStorage['ak-userMail'];

    const userRef = doc(db, 'locationsData', `user-${userMail}`);
    const userSnap = await getDoc(userRef);

    let hotel='', arrivalAirport='', departureAirport='', tripName='', travelDates='', savedAttractions;
    if (localStorage['ak-hotel']) hotel = localStorage['ak-hotel']; 
    if (localStorage['ak-arrival-airport']) arrivalAirport = localStorage['ak-arrival-airport'];
    if (localStorage['ak-departure-airport']) departureAirport = localStorage['ak-departure-airport'];
    if (localStorage['ak-user-name']) tripName = localStorage['ak-user-name'];
    if (localStorage['ak-travel-days']) travelDates = localStorage['ak-travel-days'];
    // if (localStorage['ak-attractions-saved']) savedAttractions = localStorage['ak-attractions-saved'];

    // if (!tripName || !travelDates) return;

    // const obj = {};
    savedAttractions = {};
    const $attractionsSlider = document.querySelector('[data-ak="locations-slider"]');
    $attractionsSlider.querySelectorAll('.w-slide').forEach((slide, n) => {
      savedAttractions[`slide${n+1}`] = {}; 
      const slideObj = savedAttractions[`slide${n+1}`];
        
      slide.querySelectorAll('[data-ak-timeslots] [data-ak-timeslot-content]').forEach(timeslotContent => {
        const timeslot = timeslotContent.querySelector('[data-ak-timeslot-wrap]').getAttribute('data-ak-timeslot-wrap');
        
        slideObj[timeslot] = [];
          
        timeslotContent.querySelectorAll('[data-ak="attraction-location"]:not(.hidden)').forEach(attraction => {
          const name = attraction.querySelector('[data-ak="location-title"]').textContent.trim();
          const { saveObj: { location, displayName, editorialSummary } } = attraction;
          
          // console.log('name::::', name)
          // console.log('location', location)
          // console.log('displayName', displayName)
          // console.log('editorialSummary', editorialSummary)
          
          slideObj[timeslot].push({ location, displayName, editorialSummary}); 
        });
      });
    });

    // console.log('savedAttractions:::', savedAttractions)

    savedAttractions = JSON.stringify(savedAttractions);

    const saveObj = { hotel, arrivalAirport, departureAirport, tripName, travelDates, savedAttractions };

    // console.log('saveObj', saveObj)

    if (userSnap.exists()) {
      // console.log('userSnap exists', userSnap.exists())
      saveObj.ModifiedAt = serverTimestamp();
      await updateDoc(userRef, saveObj);
    }
    else {
      // console.log('userSnap does not exist')
      saveObj.CreatedAt = serverTimestamp();
      await setDoc(userRef, saveObj);
    }
}

async function createUserInFirebase(userMail) {
  if (!userMail) return;
  const userRef = doc(db, 'locationsData', `user-${userMail}`);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) return;
  await setDoc(userRef, { CreatedAt: serverTimestamp() }); 
}

// $titleInfoSkeletonWrap.classList.remove('hidden');



function addAttractionToList(name, $listName, marker=null, saveObj={}) {
  name = format(name); 
  const $location = $listName.querySelector('[data-ak="attraction-location"]').cloneNode(true);
  $location.classList.remove('hidden');
  $location.querySelector('[data-ak="location-title"]').textContent = name; 
  $location.querySelector('[data-ak="location-link-text"]').textContent = name;
  $location.marker = marker;
  $location.saveObj = saveObj;
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



/*if (localStorage['ak-user-name'] && !localStorage['ak-referred']) {
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
}*/

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
        center: locationNYC,
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
    } = placeObj; 

    localStorage['ak-hotel'] = JSON.stringify(placeObj);
    localStorage['ak-hotel-update'] = true;

    const marker = createMarker(displayName, {lat, lng}, editorialSummary); 
    markerArr.push(marker); 

    const $resultWrap = document.querySelector('[data-ak="hotel-search-result"]');
    addLocationToResultWrap(displayName, marker, $resultWrap); 

    setUnsavedChangesFlag(); 
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
          center: locationNYC,
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
      await place.fetchFields({ fields: ['displayName', 'location', 'editorialSummary'] });
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
      } = placeObj; 

      const airportType = autocomplete.getAttribute('data-ak-airport');
      if (airportType.includes('arrival')) {
        localStorage['ak-arrival-airport'] = JSON.stringify(placeObj);
        localStorage['ak-arrival-airport-update'] = true;
      }
      else {
        localStorage['ak-departure-airport'] = JSON.stringify(placeObj);
        localStorage['ak-departure-airport-update'] = true; 
      }
      
      const marker = createMarker(displayName, {lat, lng}, editorialSummary); 
      markerArr.push(marker); 

      const $resultWrap = autocomplete.closest('.form_row').querySelector('[data-ak="airport-search-result"]');
      addLocationToResultWrap(displayName, marker, $resultWrap);

      setUnsavedChangesFlag(); 
    });
  });
}(); 

function addLocationToResultWrap(name, marker, $resultWrap) {
  const $location = document.querySelector('[data-ak="attraction-location"]').cloneNode(true);
  $location.classList.remove('hidden');
  $location.querySelector('[data-ak="location-title"]').textContent = name; 
  $location.querySelector('[data-ak="location-link-text"]').textContent = name;
  $location.marker = marker;
  // $location.saveObj = saveObj;
  $resultWrap.innerHTML = '';
  $resultWrap.append($location);
}

!async function setupAutocompleteInp() {
  await google.maps.importLibrary('places');

  // Create the input HTML element, and append it.
  const placeAutocomplete = new google.maps.places.PlaceAutocompleteElement({
      componentRestrictions: { country: ['us'] },
      includedRegionCodes: ['us'],
      locationBias: {
        radius: 5000.0,
        center: locationNYC,
      },
      // "locationBias": {
      //   "circle": {
      //     "center": {
      //       "latitude": 37.7937,
      //       "longitude": -122.3965
      //     },
      //     "radius": 500.0
      //   }
      // }, 
  }); 

  const $autocompleteWrap = document.querySelector('.ak-autocomplete');
  $autocompleteWrap.appendChild(placeAutocomplete);

  const searchAttractionsPlaceholderTxt = 'Add an activity...';

  // if (placeAutocomplete.target?.Zg) {
  //   const $userInputWrap = res.target?.Zg;
  //   const $userInput = $userInputWrap.querySelector('input');    
  //   $userInput.setAttribute('placeholder', searchAttractionsPlaceholderTxt);
  // }

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
        // if (!res.srcElement?.Eg) return;
        const $userInputWrap = res.target?.Zg;
        if (!$userInputWrap) return;
        const $userInput = $userInputWrap.querySelector('input');    
        if ($userInput) $userInput.value = '';
        // $userInput.setAttribute('placeholder', searchAttractionsPlaceholderTxt);
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

      // showHideUnsavedChangesMsg();
      setUnsavedChangesFlag(); 
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
      removeUnsavedChangesFlag(); 
      return;
    }
    addAttractionToList(displayName, $timeslotWrap, marker, saveObj);
    saveAttractionLocal(timeslotName, slideIndex, saveObj); 
    // saveAttractionsDB();
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
  localStorage['ak-attractions-update'] = true; 
}

$attractionsSlider.addEventListener('click', e => {
  if (!e.target.closest('[data-ak-timeslot-title]')) return;
  const $currentSlide = e.target.closest('.w-slide');
  $currentSlide.querySelector('[data-ak-timeslots].active')?.classList.remove('active');
  const $timeslot = e.target.closest('[data-ak-timeslots]');
  $timeslot.classList.add('active');
});

// function showHideUnsavedChangesMsg() {
//   if (localStorage['ak-unsaved-changes']) {
//       $unsavedChanges.classList.remove('hide');
//   }
//   else {
//       $unsavedChanges.classList.add('hide');
//   }
// }



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

/*if (!localStorage['ak-referred']) {
  if (localStorage['ak-user-name']) {
    let tripName = localStorage['ak-user-name'];
    if (tripName) tripName = tripName.split(/\s+/)[0];
    setupTripName(tripName); 
  }
  
  if (localStorage['ak-travel-days']) {
    const { flatpickrDate } = JSON.parse(localStorage['ak-travel-days']);
    setupTravelDates(flatpickrDate); 
  }
}*/

  
function restoreSavedAttractions(savedAttractions) {
  const $attractionsSlider = document.querySelector('[data-ak="locations-slider"]');
  const $attractionsSliderMask = $attractionsSlider.querySelector('.w-slider-mask');

  for (const [slide, attractions] of Object.entries(savedAttractions)) {
    const slideNum = Number(slide.match(/\d+/)[0]);
    const $currentSlide = [...$attractionsSliderMask.querySelectorAll('.w-slide')][slideNum-1];
    const $morningWrap = $currentSlide.querySelector('[data-ak-timeslot-wrap="morning"]');
    const $afternoonWrap = $currentSlide.querySelector('[data-ak-timeslot-wrap="afternoon"]');
    const $eveningWrap = $currentSlide.querySelector('[data-ak-timeslot-wrap="evening"]');

    const { morning, afternoon, evening } = attractions;

    if (morning && morning.length) {
      processTimeslot(morning, $morningWrap);
    }
    if (afternoon && afternoon.length) {
      processTimeslot(afternoon, $afternoonWrap);
    }
    if (evening && evening.length) {
      processTimeslot(evening, $eveningWrap);
    }
  }

  $attractionsSliderMask.querySelector('.w-slide .active')?.classList.remove('active');

  function processTimeslot(timeslot, $sectionWrap) {
    timeslot.forEach(slot => {
      const { displayName, editorialSummary, location } = slot;
      const marker = createMarker(displayName, location, editorialSummary);
      const saveObj = { displayName, editorialSummary, location };
      addAttractionToList(displayName, $sectionWrap, marker, saveObj);
    });
    const $timeslotSec = $sectionWrap.closest('[data-ak-timeslots]');
    if ($timeslotSec.querySelector('[data-ak-timeslot-content]').style.height === '0px') {
      $timeslotSec.querySelector('[data-ak-timeslot-title]').click(); 
    }
  }
}   





});


