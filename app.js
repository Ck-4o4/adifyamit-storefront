// Adifyamit Storefront - Hybrid Storefront Script (Static + Render Backend)
// Frontend hosted on Hostinger Shared Hosting, Backend hosted on Render (Free)

// Configure your backend Render URL here (e.g. "https://adifyamit.onrender.com")
// Leave empty "" when testing locally on localhost:3000
const BACKEND_URL = ""; 

let allBundles = [];
let activeBundle = null;
let paymentGateway = 'sandbox';

async function fetchPaymentConfig() {
  try {
    const base = BACKEND_URL || window.location.origin;
    const response = await fetch(`${base}/api/payment/config`);
    if (response.ok) {
      const data = await response.json();
      paymentGateway = data.gateway;
    }
  } catch (error) {
    console.error("Error fetching payment config:", error);
  }
}

// DOM Elements
const selectorBar = document.getElementById('bundle-selector-bar');
const bundleTitle = document.getElementById('box-title');
const bundleDesc = null;
const displayPrice = document.getElementById('sticker-price');
const originalPrice = document.getElementById('sticker-original');
const discountPercentage = null;
const cardCover = document.getElementById('bundle-cover');
const flankLeftList = document.getElementById('flank-left-list');
const flankRightList = document.getElementById('flank-right-list');
const buyBtn = document.getElementById('buy-btn');
const mainShowcase = document.getElementById('hero');

// Checkout Modal Elements
const checkoutModal = document.getElementById('checkout-modal');
const modalClose = document.getElementById('close-modal-btn');
const stepDetails = document.getElementById('step-details');
const stepPayment = document.getElementById('step-payment');
const stepProcessing = document.getElementById('step-processing');
const stepSuccess = document.getElementById('step-success');

const inputEmail = document.getElementById('customer-email');
const inputName = document.getElementById('customer-name');
const nextBtn = document.getElementById('proceed-payment-btn');
const paySubmitBtn = document.getElementById('pay-submit-btn');

const inputCardNum = document.getElementById('card-number');
const inputCardExpiry = document.getElementById('card-expiry');
const inputCardCvc = document.getElementById('card-cvc');
const inputUpiId = document.getElementById('upi-id');

const tabCard = document.getElementById('tab-card');
const tabUpi = document.getElementById('tab-upi');
const methodCard = document.getElementById('payment-method-card');
const methodUpi = document.getElementById('payment-method-upi');

const directDownloadBtn = document.getElementById('direct-download-btn');

let currentPaymentMethod = 'card';

// Fetch course bundles from backend
async function fetchBundles() {
  try {
    const base = BACKEND_URL || window.location.origin;
    const response = await fetch(`${base}/api/bundles`);
    if (!response.ok) throw new Error('Failed to load courses.');
    
    allBundles = await response.json();
    if (allBundles.length > 0) {
      activeBundle = allBundles[0];
      renderTabs();
      displayBundle(activeBundle);
    } else {
      showEmptyState();
    }
  } catch (error) {
    console.error(error);
    showToast("Error connecting to server. Please try again.", "error");
  }
}

// Render course category tabs
function renderTabs() {
  selectorBar.innerHTML = '';
  const icons = ['🎨', '👔', '📊', '📦'];
  
  allBundles.forEach((bundle, idx) => {
    const tab = document.createElement('button');
    tab.className = 'selector-tab';
    tab.id = `tab-${bundle.id}`;
    if (bundle.id === activeBundle.id) tab.classList.add('active');
    
    const icon = icons[idx % icons.length];
    
    let displayName = 'Pack';
    if (bundle.id === 'graphics-sale') displayName = 'Graphics Pack';
    else if (bundle.id === 'hr-toolkit') displayName = 'HR Pack';
    else if (bundle.id === 'business-accounts') displayName = 'Accounts Pack';
    else if (bundle.id === 'presentations-sbb') displayName = 'Presentations Pack';

    tab.innerHTML = `
      <span class="selector-tab-icon">${icon}</span>
      <span>${displayName}</span>
    `;
    
    tab.addEventListener('click', () => {
      selectBundle(bundle.id);
    });
    
    selectorBar.appendChild(tab);
  });
}

// Switch active tab bundle
function selectBundle(bundleId) {
  const tabs = document.querySelectorAll('.selector-tab');
  tabs.forEach(t => t.classList.remove('active'));
  
  const activeTab = document.getElementById(`tab-${bundleId}`);
  if (activeTab) activeTab.classList.add('active');
  
  activeBundle = allBundles.find(b => b.id === bundleId);
  if (activeBundle) {
    displayBundle(activeBundle);
  }
}

// Populate bundle contents
function displayBundle(bundle) {
  if (mainShowcase) mainShowcase.style.opacity = 0;
  
  setTimeout(() => {
    if (bundleTitle) bundleTitle.textContent = bundle.title;
    if (bundleDesc) bundleDesc.textContent = bundle.description;
    if (displayPrice) displayPrice.textContent = `₹${bundle.price}`;
    if (originalPrice) originalPrice.textContent = `₹3,999`;
    if (discountPercentage) discountPercentage.textContent = `SAVE 97%`;

    // Update modal checkout details
    const summaryTitle = document.getElementById('summary-title');
    if (summaryTitle) summaryTitle.textContent = bundle.title;
    
    const summaryPrice = document.getElementById('summary-price');
    if (summaryPrice) summaryPrice.textContent = `₹${bundle.price}`;
    
    const payAmountLabel = document.getElementById('pay-amount-label');
    if (payAmountLabel) payAmountLabel.textContent = `₹${bundle.price}.00`;

    const btnPriceLabel = document.getElementById('btn-price-label');
    if (btnPriceLabel) btnPriceLabel.textContent = `₹${bundle.price}`;

    const base = BACKEND_URL || window.location.origin;
    if (cardCover) {
      cardCover.src = bundle.coverImage.startsWith('http') ? bundle.coverImage : `${base}${bundle.coverImage}`;
      cardCover.style.display = 'block';
      const placeholder = document.getElementById('bundle-cover-placeholder');
      if (placeholder) placeholder.style.display = 'none';
    }

    // Split features into left & right lists
    if (flankLeftList) flankLeftList.innerHTML = '';
    if (flankRightList) flankRightList.innerHTML = '';

    const leftFeatures = bundle.features.slice(0, 3);
    const rightFeatures = bundle.features.slice(3, 6);
    const listIcons = ['✓', '✦', '✔', '⚡', '⭐', '★'];

    leftFeatures.forEach((feat, idx) => {
      if (flankLeftList) {
        const li = document.createElement('li');
        li.innerHTML = `
          <span class="list-icon">${listIcons[idx % listIcons.length]}</span>
          <div class="list-text">
            <strong>${feat}</strong>
            <p>Full lifetime access & updates</p>
          </div>
        `;
        flankLeftList.appendChild(li);
      }
    });

    rightFeatures.forEach((feat, idx) => {
      if (flankRightList) {
        const li = document.createElement('li');
        li.innerHTML = `
          <span class="list-icon">${listIcons[(idx + 3) % listIcons.length]}</span>
          <div class="list-text">
            <strong>${feat}</strong>
            <p>Full lifetime access & updates</p>
          </div>
        `;
        flankRightList.appendChild(li);
      }
    });

    // Populate details grid section
    const featuresContainer = document.getElementById('features-container');
    if (featuresContainer) {
      featuresContainer.innerHTML = '';
      bundle.features.forEach((feat, index) => {
        const icons = ['📁', '🚀', '📊', '🛠️', '🎨', '🔒'];
        const icon = icons[index % icons.length];
        
        const card = document.createElement('div');
        card.className = 'feature-card';
        card.innerHTML = `
          <div class="feature-icon">${icon}</div>
          <div class="feature-title">${feat}</div>
          <div class="feature-desc">Premium high-quality asset included in the bundle with lifetime support and updates.</div>
        `;
        featuresContainer.appendChild(card);
      });
    }

    if (mainShowcase) mainShowcase.style.opacity = 1;
  }, 200);
}

// Modal handling
function openCheckout() {
  if (!activeBundle) return;
  checkoutModal.classList.add('active');
  setCheckoutStep('details');
}

function closeCheckout() {
  checkoutModal.classList.remove('active');
}

function setCheckoutStep(step) {
  stepDetails.classList.remove('active');
  stepPayment.classList.remove('active');
  stepProcessing.classList.remove('active');
  stepSuccess.classList.remove('active');
  
  document.getElementById('modal-title-text').textContent = "Secure Checkout";

  if (step === 'details') {
    stepDetails.classList.add('active');
  } else if (step === 'payment') {
    stepPayment.classList.add('active');
  } else if (step === 'processing') {
    document.getElementById('modal-title-text').textContent = "Connecting to Gateway";
    stepProcessing.classList.add('active');
  } else if (step === 'success') {
    document.getElementById('modal-title-text').textContent = "Order Complete";
    stepSuccess.classList.add('active');
  }
}

// PhonePe Payment redirect handler
async function processPayment() {
  setCheckoutStep('processing');

  try {
    const payload = {
      bundleId: activeBundle.id,
      email: inputEmail.value,
      name: inputName.value
    };

    const base = BACKEND_URL || window.location.origin;
    const response = await fetch(`${base}/api/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (data.success) {
      if (data.redirectUrl) {
        // Redirect customer browser directly to PhonePe hosted checkout
        window.location.href = data.redirectUrl;
      } else {
        // Local Sandbox Fallback
        setCheckoutStep('success');
        showToast('Payment successful!', 'success');
        directDownloadBtn.href = `${base}${data.downloadUrl}`;
        directDownloadBtn.setAttribute('download', '');
        triggerInstantDownload(`${base}${data.downloadUrl}`);
      }
    } else {
      throw new Error(data.error || 'Failed to initialize payment.');
    }
  } catch (error) {
    showToast(error.message, 'error');
    setCheckoutStep('payment');
  }
}

// Auto-trigger file download in browser
function triggerInstantDownload(url) {
  try {
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', '');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error("Auto-download trigger failed:", err);
  }
}

// Toast Notifications
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  
  container.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => container.removeChild(toast), 300);
  }, 4000);
}

// 3D Tilt Hover Physics
function setupCard3DTilt() {
  const container = document.getElementById('box-card-container');
  const card = document.getElementById('box-card');
  if (!container || !card) return;

  container.addEventListener('mousemove', (e) => {
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const xc = rect.width / 2;
    const yc = rect.height / 2;
    
    const angleX = (yc - y) / 18;
    const angleY = (x - xc) / 18;
    
    card.style.transform = `rotateX(${angleX}deg) rotateY(${angleY}deg)`;
  });

  container.addEventListener('mouseleave', () => {
    card.style.transform = 'rotateX(0deg) rotateY(0deg)';
  });
}

// Countdown timer
function setupCountdown() {
  const timerElement = document.getElementById('promo-timer');
  if (!timerElement) return;

  let timeLeft = 15 * 60; // 15 minutes
  
  const timer = setInterval(() => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    
    timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    if (timeLeft <= 0) {
      clearInterval(timer);
      timerElement.textContent = "00:00";
    }
    timeLeft--;
  }, 1000);
}

// Check for PhonePe callback parameters on startup
function checkPaymentCallback() {
  const urlParams = new URLSearchParams(window.location.search);
  const status = urlParams.get('payment_status');
  const token = urlParams.get('token');
  const title = urlParams.get('title');

  if (status === 'success' && token) {
    const base = BACKEND_URL || window.location.origin;
    openCheckout();
    setCheckoutStep('success');
    
    document.getElementById('summary-title').textContent = title || "Course Bundle";
    directDownloadBtn.href = `${base}/download/${token}`;
    directDownloadBtn.setAttribute('download', '');

    triggerInstantDownload(`${base}/download/${token}`);

    // Clean address bar parameters
    window.history.replaceState({}, document.title, "/");
  } else if (status === 'failed') {
    showToast('Transaction declined by PhonePe. Please try again.', 'error');
  }
}

// Event Listeners
buyBtn.addEventListener('click', (e) => {
  e.preventDefault();
  openCheckout();
});

modalClose.addEventListener('click', closeCheckout);
window.addEventListener('click', (e) => {
  if (e.target === checkoutModal) closeCheckout();
});

nextBtn.addEventListener('click', () => {
  if (!inputEmail.value.trim() || !inputEmail.value.includes('@')) {
    showToast('Please enter a valid email address.', 'error');
    return;
  }
  if (!inputName.value.trim()) {
    showToast('Please enter your name.', 'error');
    return;
  }
  
  if (paymentGateway === 'phonepe') {
    processPayment();
  } else {
    setCheckoutStep('payment');
  }
});

// Setup tab switches
tabCard.addEventListener('click', () => {
  currentPaymentMethod = 'card';
  tabCard.classList.add('active');
  tabUpi.classList.remove('active');
  methodCard.style.display = 'flex';
  methodUpi.style.display = 'none';
});

tabUpi.addEventListener('click', () => {
  currentPaymentMethod = 'upi';
  tabUpi.classList.add('active');
  tabCard.classList.remove('active');
  methodCard.style.display = 'none';
  methodUpi.style.display = 'flex';
});

paySubmitBtn.addEventListener('click', () => {
  processPayment();
});

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  fetchPaymentConfig();
  fetchBundles();
  setupCard3DTilt();
  setupCountdown();
  checkPaymentCallback();
});
