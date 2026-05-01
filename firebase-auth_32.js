// ============================================================
// FIREBASE AUTH FOR WEBFLOW
// Add element IDs in Webflow Designer > Element Settings panel:
//
//   google-btn       → Google button
//   facebook-btn     → Facebook button
//   login-email      → Email input
//   login-password   → Password input
//   login-submit     → Login / Sign Up submit button
//   signup-link      → "Not registered? Sign Up" link/text
//   auth-error       → A text element to show error messages
//   auth-mode-label  → (optional) element that shows "Login" or "Sign Up"
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, setDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  linkWithCredential,
  fetchSignInMethodsForEmail,
  sendPasswordResetEmail,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ── 1. YOUR FIREBASE CONFIG ─────────────────────────────────
// Replace these values with your project's config from:
// Firebase Console → Project Settings → Your Apps → SDK setup
const firebaseConfig = {
    apiKey: "AIzaSyBQPqbtlfHPLpB-JYbyxDZiugu4NqwpSeM",
    authDomain: "askkhonsu-map.firebaseapp.com",
    projectId: "askkhonsu-map",
    storageBucket: "askkhonsu-map.appspot.com",
    messagingSenderId: "266031876218",
    appId: "1:266031876218:web:ec93411f1c13d9731e93c3",
    measurementId: "G-Z7F4NJ4PHW"
};

// ── 2. WHERE TO SEND THE USER AFTER LOGIN ───────────────────
const REDIRECT_AFTER_LOGIN = "/"; // change to your post-login page

// ── 3. INIT ─────────────────────────────────────────────────
const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ── 4. ELEMENT REFS ─────────────────────────────────────────
const googleBtn            = document.getElementById("google-btn");
const facebookBtn          = document.getElementById("facebook-btn");
const emailInput           = document.getElementById("login-email");
const passwordInput        = document.getElementById("login-password");
const confirmPasswordInput = document.getElementById("confirm-password");
const confirmPasswordWrap  = document.getElementById("confirm-password-wrap");
const submitBtn            = document.getElementById("login-submit");
const signupLink           = document.getElementById("signup-link");
const errorEl              = document.getElementById("auth-error");
const modeLabel            = document.getElementById("auth-mode-label");
const forgotLink           = document.getElementById("forgot-password-link");
const forgotWrap           = document.getElementById("forgot-password-wrap");
const loginFormWrap        = document.getElementById("login-form-wrap");
const forgotEmailInput     = document.getElementById("forgot-email");
const forgotSubmitBtn      = document.getElementById("forgot-submit");
const forgotBackLink       = document.getElementById("forgot-back");
const successEl            = document.getElementById("auth-success");

let isSignUpMode = false;
let pendingCredential = null; // saved when account-exists conflict is detected

// ── 5. HELPERS ───────────────────────────────────────────────
function showError(msg) {
  if (!errorEl) return;
  errorEl.textContent = msg;
  errorEl.classList.remove("hide");
}

function clearError() {
  if (!errorEl) return;
  errorEl.textContent = "";
  errorEl.classList.add("hide");
}

function showSuccess(msg) {
  if (!successEl) return;
  successEl.textContent = msg;
  successEl.classList.remove("hide");
}

function setMode(signUp) {
  isSignUpMode = signUp;
  if (submitBtn)           submitBtn.value              = signUp ? "Sign Up" : "Login";
  if (modeLabel)           modeLabel.textContent        = signUp ? "Sign Up" : "Login";
  if (signupLink)          signupLink.textContent       = signUp ? "Already registered? Login" : "Not registered? Sign Up";
  if (confirmPasswordWrap) confirmPasswordWrap.classList.toggle("hide", !signUp);
  if (confirmPasswordInput) confirmPasswordInput.value = "";
  if (forgotLink) forgotLink.classList.toggle("hide", signUp);
  clearError();
}

async function handleAuthError(err) {
  if (err.code === "auth/account-exists-with-different-credential") {
    // Save the credential the user just tried (e.g. Facebook)
    pendingCredential =
      FacebookAuthProvider.credentialFromError(err) ||
      GoogleAuthProvider.credentialFromError(err);

    // Work out which provider they originally signed up with by checking the email domain.
    // Firebase won't tell us directly (fetchSignInMethodsForEmail is deprecated), so we
    // ask them to sign in with the other provider to prove ownership, then link.
    const isFacebookPending = pendingCredential?.providerId === "facebook.com";
    const providerName = isFacebookPending ? "Google" : "Facebook";

    showError(
      `This email is already linked to ${providerName}. ` +
      `Click the ${providerName} button to sign in and automatically connect both accounts.`
    );
    return;
  }

  const messages = {
    "auth/user-not-found":       "No account found with that email.",
    "auth/wrong-password":       "Incorrect password.",
    "auth/invalid-email":        "Please enter a valid email address.",
    "auth/email-already-in-use": "An account with this email already exists.",
    "auth/weak-password":        "Password must be at least 6 characters.",
    "auth/popup-closed-by-user": "Sign-in popup was closed before completing.",
  };
  showError(messages[err.code] || "Something went wrong. Please try again.");
}

async function saveUserProvider(user) {
  const provider = user.providerData[0]?.providerId || "password";
  await setDoc(doc(db, "users", user.uid), {
    email:    user.email,
    provider,
    displayName: user.displayName || null,
  }, { merge: true });
}

// After a successful sign-in, link the pending credential if one was saved
async function linkPendingCredential(user) {
  if (!pendingCredential) return;
  try {
    await linkWithCredential(user, pendingCredential);
  } catch (_) {
    // Already linked or incompatible — safe to ignore
  } finally {
    pendingCredential = null;
  }
}

// ── 6. GOOGLE SIGN-IN ────────────────────────────────────────
if (googleBtn) {
  googleBtn.addEventListener("click", async () => {
    clearError();
    try {
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      await linkPendingCredential(result.user);
      await saveUserProvider(result.user);
      window.location.href = REDIRECT_AFTER_LOGIN;
    } catch (err) {
      handleAuthError(err);
    }
  });
}

// ── 7. FACEBOOK SIGN-IN ──────────────────────────────────────
if (facebookBtn) {
  facebookBtn.addEventListener("click", async () => {
    clearError();
    try {
      const result = await signInWithPopup(auth, new FacebookAuthProvider());
      await linkPendingCredential(result.user);
      await saveUserProvider(result.user);
      window.location.href = REDIRECT_AFTER_LOGIN;
    } catch (err) {
      handleAuthError(err);
    }
  });
}

// ── 8. EMAIL / PASSWORD ──────────────────────────────────────
if (submitBtn) {
  submitBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    clearError();

    console.log('Sign-Up Btn Clicked!!!')

    const email    = emailInput?.value.trim();
    const password = passwordInput?.value;

    if (!email || !password) {
      showError("Please enter your email and password.");
      return;
    }

    console.log('isSignUpMode::', isSignUpMode)

    if (isSignUpMode && confirmPasswordInput) {
      if (password !== confirmPasswordInput.value) {
        showError("Passwords do not match.");
        return;
      }
    }

    try {
      let result;
      if (isSignUpMode) {
        result = await createUserWithEmailAndPassword(auth, email, password);
      } 
      else {
        result = await signInWithEmailAndPassword(auth, email, password);
      }
      await linkPendingCredential(result.user);
      await saveUserProvider(result.user);
      window.location.href = REDIRECT_AFTER_LOGIN;
    }
    catch (err) {
      if (err.code === "auth/email-already-in-use") {
        setMode(false);
        try {
          const methods = await fetchSignInMethodsForEmail(auth, email);
          const providerNames = {
            "google.com":   "Google",
            "facebook.com": "Facebook",
            "password":     "email and password",
          };
          const provider = providerNames[methods[0]] || "another method";
          showError(`Account already exists with ${provider}. Please sign in using that.`);
        } catch (_) {
          showError("Account already exists. Try signing in with Google or Facebook.");
        }
        return;
      }
      handleAuthError(err);
    }
  });
}

// ── 9. TOGGLE LOGIN ↔ SIGN UP ────────────────────────────────
if (signupLink) {
  signupLink.addEventListener("click", (e) => {
    e.preventDefault();
    setMode(!isSignUpMode);
  });
}

// ── 11. LOGOUT ───────────────────────────────────────────────
const logoutBtn = document.getElementById("logout-btn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "/login";
  });
}

// ── 11. FORGOT PASSWORD ──────────────────────────────────────
function showForgotView() {
  if (loginFormWrap) loginFormWrap.classList.add("hide");
  if (forgotWrap)    forgotWrap.classList.remove("hide");
  clearError();
  if (successEl) successEl.classList.add("hide");
}

function showLoginView() {
  if (forgotWrap)    forgotWrap.classList.add("hide");
  if (loginFormWrap) loginFormWrap.classList.remove("hide");
  clearError();
  if (successEl) successEl.classList.add("hide");
}

if (forgotLink) {
  forgotLink.addEventListener("click", (e) => {
    e.preventDefault();
    showForgotView();
  });
}

if (forgotBackLink) {
  forgotBackLink.addEventListener("click", (e) => {
    e.preventDefault();
    showLoginView();
  });
}

if (forgotSubmitBtn) {
  forgotSubmitBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    clearError();
    if (successEl) successEl.classList.add("hide");

    const email = forgotEmailInput?.value.trim();
    if (!email) { showError("Please enter your email address."); return; }

    try {
      const snap = await getDocs(query(collection(db, "users"), where("email", "==", email)));
      if (!snap.empty) {
        const provider = snap.docs[0].data().provider;
        const providerNames = { "google.com": "Google", "facebook.com": "Facebook" };
        if (providerNames[provider]) {
          showError(`This account uses ${providerNames[provider]} to sign in. No password to reset.`);
          return;
        }
      }
      await sendPasswordResetEmail(auth, email);
      showSuccess("Reset email sent! Check your inbox.");
    } catch (err) {
      if (err.code === "auth/user-not-found") {
        showError("No account found with that email.");
      } else {
        showError("Something went wrong. Please try again.");
      }
    }
  });
}

// ── 12. REDIRECT ALREADY-LOGGED-IN USERS ────────────────────
onAuthStateChanged(auth, (user) => {
  if (user) {
    // window.location.href = REDIRECT_AFTER_LOGIN;
    console.log('Logged In!!')
  }
  console.log('user::', user)
  console.log('email::', user?.email)
  // console.log('user.providerData::', user?.providerData)
  // console.log('user.providerData[0]', user?.providerData[0])
  // for (let [x,y] of Object.entries(user)) {
  //   y = JSON.stringify(y)
  //   console.log(`${x}: ${y}`)
  // }
});

