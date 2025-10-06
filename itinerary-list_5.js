import { initializeApp } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-app.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-functions.js";

// --- Firebase config ---
const firebaseConfig = {
  apiKey: "AIzaSyBQPqbtlfHPLpB-JYbyxDZiugu4NqwpSeM",
  authDomain: "askkhonsu-map.firebaseapp.com",
  projectId: "askkhonsu-map",
  storageBucket: "askkhonsu-map.appspot.com",
  messagingSenderId: "266031876218",
  appId: "1:266031876218:web:ec93411f1c13d9731e93c3",
  measurementId: "G-Z7F4NJ4PHW"
};

const app = initializeApp(firebaseConfig);
const functions = getFunctions(app);

const $itineraryWrap = document.querySelector('[data-ak="itinerary-list"]');
const $downloadBtn = document.querySelector('[data-ak="download-btn"]');

let itineraryText = "";

// --- Callable function wrapper ---
async function getDataById(userId) {
  const getUserData = httpsCallable(functions, "getUserData");
  try {
    const res = await getUserData({ userId });
    const { data } = res;
    return data.user;
  } catch (err) {
    if (err.code && err.message) {
      console.error(`❌ Firebase error [${err.code}]: ${err.message}`);
      showError(`Error: ${err.message}`);
    } else {
      console.error("❌ Unexpected error:", err);
      showError("Something went wrong while fetching user data.");
    }
    return null;
  }
}

// --- Helpers ---
function showLoading(msg = "Loading itinerary...") {
  $itineraryWrap.classList.add("loading");
  $itineraryWrap.classList.remove("error");
  $downloadBtn.classList.add("disable");

  // Clear content first
  $itineraryWrap.textContent = "";

  // Spinner element
  const spinner = document.createElement("div");
  spinner.className = "ak-spinner";

  const text = document.createElement("span");
  text.textContent = msg;

  $itineraryWrap.appendChild(spinner);
  $itineraryWrap.appendChild(text);
}

function showError(msg) {
  console.error("❌", msg);
  $itineraryWrap.textContent = msg;
  $itineraryWrap.classList.add("error");
  $itineraryWrap.classList.remove("loading");
  $downloadBtn.classList.add("disable");

  // Retry button
  const retryBtn = document.createElement("button");
  retryBtn.textContent = "Retry";
  retryBtn.className = "ak-retry-btn";
  retryBtn.onclick = () => {
    retryBtn.remove();
    renderData();
  };
  $itineraryWrap.appendChild(document.createElement("br"));
  $itineraryWrap.appendChild(retryBtn);
}

const sectionMap = {
  morning: "Attractions",
  afternoon: "Restaurants",
  evening: "Local Experiences"
};

function renderTxtStyle(data, preliminaryStr='') {
  let output = "";
  if (preliminaryStr.length) output += preliminaryStr + '\n';
  let slideNum = 1;

  for (const slide in data) {
    const sections = data[slide];
    let dayOutput = `Day${slideNum}\n\n`;
    let hasContent = false;

    for (const key of ["morning", "afternoon", "evening"]) {
      if (sections[key] && sections[key].length > 0) {
        hasContent = true;
        dayOutput += `${sectionMap[key]}\n\n`;
        sections[key].forEach(item => {
          if (item.displayName) {
            dayOutput += `${item.displayName}\n`;
          }
        });
        dayOutput += `\n`;
      }
    }

    if (hasContent) {
      output += dayOutput + `\n`;
    }

    slideNum++;
  }

  itineraryText = output.trim();
  $itineraryWrap.textContent = itineraryText || "Itinerary is empty.";
  $itineraryWrap.classList.remove("error", "loading");
  $downloadBtn.classList.remove("disable");
}

// --- Main ---
async function renderData() {
  showLoading();

  const params = new URLSearchParams(window.location.search);
  const encodedEmail = params.get("id") || params.get("userId");
  const userEmail = encodedEmail ? decodeURIComponent(encodedEmail) : null;

  if (!userEmail) {
    showError("No user id detected in URL.");
    return;
  }

  const userObj = await getDataById(`user-${userEmail}`);
  if (!userObj) {
    showError(`No data found for ${userEmail}`);
    return;
  }

  if (!userObj.savedAttractions) {
    showError(`No saved itinerary found for ${userEmail}`);
    return;
  }

  let attractionLocations, hotelName, arrival, departure, preliminaryStr = '';
  try {
    const { tripName,
    				travelDates,
    				hotel, 
            arrivalAirport, 
            departureAirport, 
            savedAttractions } = userObj;
		
    preliminaryStr += `${tripName}'s Trip To N.Y.C.\n`;
    localStorage['ak-tripName'] = tripName;
    const titleDatesStr = processTitleDates(travelDates);
    preliminaryStr += `${titleDatesStr ? titleDatesStr + '\n\n' : ''}`;
    
    if (hotel) {
      hotelName = parseJSON(hotel)?.displayName;
      preliminaryStr += `Hotel\n${hotelName || ''}\n\n`;
    }
    if (arrivalAirport) {
      arrival = parseJSON(arrivalAirport)?.displayName;
      preliminaryStr += `Arrival Location\n${arrival || ''}\n\n`;
    }
    if (departureAirport) {
      departure = parseJSON(departureAirport)?.displayName;
      preliminaryStr += `Departure Location\n${departure || ''}\n\n`;
    }
            
    attractionLocations = parseJSON(savedAttractions);
  } catch (err) {
    console.error("Error parsing savedAttractions JSON:", err);
    showError(`Itinerary data for ${userEmail} is invalid or corrupted.`);
    return;
  }

  if (!attractionLocations || typeof attractionLocations !== "object" || Object.keys(attractionLocations).length === 0) {
    showError(`Itinerary for ${userEmail} is empty.`);
    return;
  }

  renderTxtStyle(attractionLocations, preliminaryStr);
}

// --- Auto-run ---
renderData();

// --- Download as TXT ---
$downloadBtn.addEventListener("click", () => {
  if (!itineraryText) return;

  const tagline = "\n\n\n\n| www.askkhonsu.com |"; // Local Tips | Maximized Trips";
  const fullText = itineraryText + tagline;

  const blob = new Blob([fullText], { type: "text/plain" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  const downloadName = localStorage['ak-tripName'] ? `${localStorage['ak-tripName']}'s Trip` : 'itinerary.txt';
  a.download = downloadName;
  a.click();

  URL.revokeObjectURL(url);
});

function processTitleDates(date) {
  const theDate = parseJSON(date);
  if (!theDate) return;
  const { dateStr, flatpickrDate } = theDate;
  const dateToExtractFrom = dateStr ? dateStr : flatpickrDate;
  const [ startDate, endDate ] = dateToExtractFrom.split(/\s+to\s+/);
  return getTitleDates(startDate, endDate);
}

function getTitleDates(startDate, endDate) {
  const monthArr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
  let titleStartDate = new Date(startDate);
  let titleEndDate = new Date(endDate);
  titleStartDate = `${monthArr[titleStartDate.getMonth()]} ${titleStartDate.getDate()}`;
  titleEndDate = `${monthArr[titleEndDate.getMonth()]} ${titleEndDate.getDate()}`;

  const sameDay = titleStartDate === titleEndDate;
  const titleDates = sameDay ? titleStartDate : `${titleStartDate} - ${titleEndDate}`;
  return titleDates;
}

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

