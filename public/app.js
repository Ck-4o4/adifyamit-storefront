// State management
let allBundles = [];
let activeBundle = null;
let currentPaymentMethod = 'card'; // 'card' or 'upi'

// DOM elements
const selectorBar = document.getElementById('bundle-selector-bar');
const elTitle = document.getElementById('box-title');
const elCover = document.getElementById('bundle-cover');
const elCoverPlaceholder = document.getElementById('bundle-cover-placeholder');
const elFeaturesContainer = document.getElementById('features-container');

// Flank checklists DOM elements
const flankLeftHeader = document.getElementById('flank-left-header');
const flankLeftList = document.getElementById('flank-left-list');
const flankRightHeader = document.getElementById('flank-right-header');
const flankRightList = document.getElementById('flank-right-list');

// CTA pricing elements
const elStickerPrice = document.getElementById('sticker-price');
const elStickerOriginal = document.getElementById('sticker-original');
const elBtnPriceLabel = document.getElementById('btn-price-label');

// Checkout DOM elements
const checkoutModal = document.getElementById('checkout-modal');
const buyBtn = document.getElementById('buy-btn');
const closeModalBtn = document.getElementById('close-modal-btn');
const proceedPaymentBtn = document.getElementById('proceed-payment-btn');
const paySubmitBtn = document.getElementById('pay-submit-btn');
const directDownloadBtn = document.getElementById('direct-download-btn');
const payAmountLabel = document.getElementById('pay-amount-label');

const stepDetails = document.getElementById('step-details');
const stepPayment = document.getElementById('step-payment');
const stepProcessing = document.getElementById('step-processing');
const stepSuccess = document.getElementById('step-success');

const tabCard = document.getElementById('tab-card');
const tabUpi = document.getElementById('tab-upi');
const methodCard = document.getElementById('payment-method-card');
const methodUpi = document.getElementById('payment-method-upi');

const inputName = document.getElementById('customer-name');
const inputEmail = document.getElementById('customer-email');
const inputCardNum = document.getElementById('card-number');
const inputCardExpiry = document.getElementById('card-expiry');
const inputCardCvc = document.getElementById('card-cvc');
const inputUpiId = document.getElementById('upi-id');

const summaryTitle = document.getElementById('summary-title');
const summaryPrice = document.getElementById('summary-price');

// Fetch all course bundles
async function fetchBundles() {
  try {
    const response = await fetch('/api/bundles');
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to load bundles');
    }
    
    allBundles = await response.json();
    if (allBundles.length === 0) {
      showEmptyState('No active course bundles available yet.');
      return;
    }
    
    renderSelectorBar();
    selectBundle(allBundles[0].id); // Select first bundle by default
  } catch (error) {
    console.error("Error fetching bundles:", error);
    showEmptyState(error.message);
  }
}

// Render tabs for selector bar
function renderSelectorBar() {
  selectorBar.innerHTML = '';
  
  const icons = ['📦', '👔', '📊', '🎨', '🚀', '💻'];
  
  allBundles.forEach((bundle, idx) => {
    const tab = document.createElement('button');
    tab.className = 'selector-tab';
    tab.id = `tab-${bundle.id}`;
    
    const icon = icons[idx % icons.length];
    
    let displayName = bundle.title.split(' ')[0] + ' Pack';
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

// Switch active bundle
function selectBundle(bundleId) {
  // Update tab classes
  const tabs = document.querySelectorAll('.selector-tab');
  tabs.forEach(t => t.classList.remove('active'));
  
  const activeTab = document.getElementById(`tab-${bundleId}`);
  if (activeTab) activeTab.classList.add('active');
  
  // Set state
  activeBundle = allBundles.find(b => b.id === bundleId);
  if (activeBundle) {
    displayBundle(activeBundle);
  }
}

// Populate landing page with selected bundle details
function displayBundle(bundle) {
  // Smoothly fade contents in
  const mainShowcase = document.getElementById('hero');
  mainShowcase.style.opacity = 0.3;
  
  setTimeout(() => {
    elTitle.textContent = bundle.title;
    
    // Set prices with Indian Rupee (₹) symbol
    const formattedPrice = `₹${bundle.price.toFixed(2)}`;
    elStickerPrice.textContent = `₹${Math.round(bundle.price)}`;
    // Replicates original crossed out price (roughly 3x the active sale price)
    elStickerOriginal.textContent = `₹${Math.round(bundle.price * 3)}`;
    elBtnPriceLabel.textContent = formattedPrice;
    
    // Set prices in checkout modal
    summaryPrice.textContent = formattedPrice;
    payAmountLabel.textContent = formattedPrice;
    summaryTitle.textContent = bundle.title;

    if (bundle.coverImage) {
      elCover.src = bundle.coverImage;
      elCover.style.display = 'block';
      elCoverPlaceholder.style.display = 'none';
    } else {
      elCover.style.display = 'none';
      elCoverPlaceholder.style.display = 'flex';
    }

    // Populate flanking feature checklists
    flankLeftList.innerHTML = '';
    flankRightList.innerHTML = '';

    const listIcons = ['🎥', '💻', '🛠️', '📊', '📝', '📋', '📁', '🔑', '⚡'];

    // Split features list: first 3 on left, remaining 3 on right
    const leftFeatures = bundle.features.slice(0, 3);
    const rightFeatures = bundle.features.slice(3, 6);

    // Left flank header name matches first words
    const firstWord = bundle.title.split(' ')[0].toUpperCase();
    flankLeftHeader.textContent = `${firstWord} SOLUTION`;
    flankRightHeader.textContent = `BONUS TRACKERS`;

    leftFeatures.forEach((feat, idx) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="list-icon">${listIcons[idx % listIcons.length]}</span>
        <div class="list-text">
          <strong>${feat}</strong>
          <p>Included in instant zip bundle download</p>
        </div>
      `;
      flankLeftList.appendChild(li);
    });

    rightFeatures.forEach((feat, idx) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="list-icon">${listIcons[(idx + 3) % listIcons.length]}</span>
        <div class="list-text">
          <strong>${feat}</strong>
          <p>Full lifetime access & updates</p>
        </div>
      `;
      flankRightList.appendChild(li);
    });

    // Populate dynamic modules grid inside catalog details
    elFeaturesContainer.innerHTML = '';
    bundle.features.forEach((feature, idx) => {
      const card = document.createElement('div');
      card.className = 'feature-card';
      
      const icon = listIcons[idx % listIcons.length];
      
      card.innerHTML = `
        <div class="feature-icon">${icon}</div>
        <h3 class="feature-title">Part ${idx + 1}</h3>
        <p class="feature-desc">${feature}</p>
      `;
      elFeaturesContainer.appendChild(card);
    });

    mainShowcase.style.opacity = 1;
  }, 200);
}

// Display landing page empty state when no bundles uploaded
function showEmptyState(msg) {
  const container = document.getElementById('hero');
  container.style.gridTemplateColumns = '1fr';
  container.innerHTML = `
    <div class="empty-placeholder">
      <div style="font-size: 4rem; margin-bottom: 1.5rem;">🎒</div>
      <h2>Welcome to your Digital Sales Storefront!</h2>
      <p style="margin: 1rem auto; max-width: 600px; font-size: 1.1rem;">
        No active course bundle has been uploaded yet. Open the admin dashboard using the link in navigation to publish your zip/pdf files, set your offer price, and customize details.
      </p>
      <a href="/admin.html" class="admin-btn" style="display: inline-block; padding: 0.8rem 1.5rem; font-size: 1rem; border-radius: 50px;">Go to Admin Panel</a>
    </div>
  `;
  document.getElementById('buy-btn').style.display = 'none';
  selectorBar.style.display = 'none';
}

// Modal handling
function openCheckout() {
  if (!activeBundle) return;
  checkoutModal.classList.add('active');
  setCheckoutStep('details');
}

function closeCheckout() {
  checkoutModal.classList.remove('active');
  setTimeout(() => {
    inputName.value = '';
    inputEmail.value = '';
    inputCardNum.value = '';
    inputCardExpiry.value = '';
    inputCardCvc.value = '';
    inputUpiId.value = '';
  }, 400);
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
    document.getElementById('modal-title-text').textContent = "Processing Transaction";
    stepProcessing.classList.add('active');
  } else if (step === 'success') {
    document.getElementById('modal-title-text').textContent = "Order Complete";
    stepSuccess.classList.add('active');
  }
}

// Simulated payment processing
async function processPayment() {
  setCheckoutStep('processing');
  
  // Simulate delay to feel secure
  await new Promise(resolve => setTimeout(resolve, 2000));

  try {
    const payload = {
      bundleId: activeBundle.id,
      email: inputEmail.value,
      name: inputName.value,
      paymentMethod: currentPaymentMethod
    };

    const response = await fetch('/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error('Payment processing failed. Please try again.');
    }

    const data = await response.json();
    
    if (data.success) {
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }
      setCheckoutStep('success');
      showToast('Payment successful!', 'success');
      
      // Update download link button
      directDownloadBtn.href = data.downloadUrl;
      directDownloadBtn.setAttribute('download', '');

      // Trigger automatic instant download
      triggerInstantDownload(data.downloadUrl);
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
    showToast('Download started automatically!', 'info');
  } catch (err) {
    console.error("Auto-download failed:", err);
    showToast("Automatic download blocked. Click 'Download Course Bundle' to download.", "warning");
  }
}

// Toast notification helper
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icon = type === 'success' ? '✓' : (type === 'error' ? '✕' : 'ℹ');
  toast.innerHTML = `<span>${icon}</span><p>${message}</p>`;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'toastFadeIn 0.3s reverse forwards';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// 3D Card Hover Tilt Animation
function setupCard3DTilt() {
  const card = document.getElementById('box-card');
  if (!card) return;
  const wrapper = card.parentElement;

  wrapper.addEventListener('mousemove', (e) => {
    const rect = wrapper.getBoundingClientRect();
    const x = e.clientX - rect.left - (rect.width / 2);
    const y = e.clientY - rect.top - (rect.height / 2);
    
    const rotateX = -(y / (rect.height / 2)) * 10;
    const rotateY = (x / (rect.width / 2)) * 10;
    
    card.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.03)`;
  });

  wrapper.addEventListener('mouseleave', () => {
    card.style.transform = `rotateX(0deg) rotateY(0deg) scale(1)`;
  });
}

// Countdown timer script (looping 15m)
function setupCountdown() {
  const countdownEl = document.getElementById('countdown');
  if (!countdownEl) return;

  let totalSeconds = 15 * 60; // 15 minutes in seconds

  const interval = setInterval(() => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    countdownEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    if (totalSeconds <= 0) {
      totalSeconds = 15 * 60; // Loop countdown
    } else {
      totalSeconds--;
    }
  }, 1000);
}

// Event Listeners
buyBtn.addEventListener('click', openCheckout);
closeModalBtn.addEventListener('click', closeCheckout);

checkoutModal.addEventListener('click', (e) => {
  if (e.target === checkoutModal) closeCheckout();
});

proceedPaymentBtn.addEventListener('click', () => {
  if (!inputName.value.trim() || !inputEmail.value.trim()) {
    showToast('Please fill in your name and email address.', 'error');
    return;
  }
  if (!inputEmail.value.includes('@')) {
    showToast('Please enter a valid email address.', 'error');
    return;
  }
  setCheckoutStep('payment');
});

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
  if (currentPaymentMethod === 'card') {
    if (!inputCardNum.value.trim() || !inputCardExpiry.value.trim() || !inputCardCvc.value.trim()) {
      showToast('Please fill in card details.', 'error');
      return;
    }
  } else {
    if (!inputUpiId.value.trim() || !inputUpiId.value.includes('@')) {
      showToast('Please enter a valid UPI address (e.g., username@bank).', 'error');
      return;
    }
  }
  processPayment();
});

// Check for PhonePe redirect callback parameters on startup
function checkPaymentCallback() {
  const urlParams = new URLSearchParams(window.location.search);
  const status = urlParams.get('payment_status');
  const token = urlParams.get('token');
  const title = urlParams.get('title');

  if (status === 'success' && token) {
    openCheckout();
    setCheckoutStep('success');
    
    document.getElementById('summary-title').textContent = title || "Course Bundle";
    directDownloadBtn.href = `/download/${token}`;
    directDownloadBtn.setAttribute('download', '');

    triggerInstantDownload(`/download/${token}`);

    // Clean address bar parameters
    window.history.replaceState({}, document.title, "/");
  } else if (status === 'failed') {
    showToast('Transaction declined by PhonePe. Please try again.', 'error');
  }
}

// Initialize
fetchBundles();
setupCard3DTilt();
setupCountdown();
checkPaymentCallback();
