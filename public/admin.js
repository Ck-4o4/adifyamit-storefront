// DOM elements
const statRevenue = document.getElementById('stat-revenue');
const statSales = document.getElementById('stat-sales');
const statDownloads = document.getElementById('stat-downloads');
const statBundles = document.getElementById('stat-bundles');

const uploadForm = document.getElementById('upload-form');
const inputTitle = document.getElementById('bundle-title-input');
const inputDesc = document.getElementById('bundle-desc-input');
const inputPrice = document.getElementById('bundle-price-input');
const inputFeatures = document.getElementById('bundle-features-input');
const inputCover = document.getElementById('bundle-cover-input');
const inputFile = document.getElementById('bundle-file-input');

const progressWrapper = document.getElementById('progress-wrapper');
const progressBarFill = document.getElementById('progress-bar-fill');
const progressPercent = document.getElementById('progress-percent');
const bundleTableBody = document.getElementById('bundle-table-body');

// Fetch statistics and catalog history
async function fetchAdminStats() {
  try {
    const response = await fetch('/api/admin/stats');
    if (!response.ok) {
      throw new Error('Failed to load stats');
    }
    
    const stats = await response.json();
    populateStats(stats);
  } catch (error) {
    console.error("Error loading stats:", error);
    showToast('Failed to load dashboard metrics.', 'error');
  }
}

// Populate stats cards and catalog table
function populateStats(stats) {
  statRevenue.textContent = `$${stats.totalRevenue.toFixed(2)}`;
  statSales.textContent = stats.totalSales;
  statDownloads.textContent = stats.totalDownloads;
  statBundles.textContent = stats.totalBundles;

  bundleTableBody.innerHTML = '';
  if (stats.bundles && stats.bundles.length > 0) {
    stats.bundles.forEach(b => {
      const tr = document.createElement('tr');
      const formattedDate = new Date(b.uploadDate).toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric'
      });
      
      tr.innerHTML = `
        <td><strong>${b.title}</strong></td>
        <td>$${b.price.toFixed(2)}</td>
        <td style="font-family: monospace; font-size: 0.85rem; color: var(--text-muted);">${b.originalName}</td>
        <td>${b.downloads}</td>
        <td>${formattedDate}</td>
      `;
      bundleTableBody.appendChild(tr);
    });
  } else {
    bundleTableBody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 2rem;">
          No bundles in catalog. Upload your first course bundle above!
        </td>
      </tr>
    `;
  }
}

// Handle form submission with file uploading progress
uploadForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const title = inputTitle.value.trim();
  const description = inputDesc.value.trim();
  const price = inputPrice.value.trim();
  const features = inputFeatures.value.trim();
  const coverFile = inputCover.files[0];
  const bundleFile = inputFile.files[0];

  if (!bundleFile) {
    showToast('Course bundle zip/pdf file is required!', 'error');
    return;
  }

  // Construct multipart FormData payload
  const formData = new FormData();
  formData.append('title', title);
  formData.append('description', description);
  formData.append('price', price);
  formData.append('features', features);
  
  if (coverFile) {
    formData.append('coverImage', coverFile);
  }
  formData.append('bundleFile', bundleFile);

  // Initialize AJAX request to track upload progress
  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/api/admin/upload', true);

  // Show progress bar container
  progressWrapper.style.display = 'flex';
  progressBarFill.style.style = '0%';
  progressPercent.textContent = '0%';

  // Progress Listener
  xhr.upload.addEventListener('progress', (event) => {
    if (event.lengthComputable) {
      const percentComplete = Math.round((event.loaded / event.total) * 100);
      progressBarFill.style.width = `${percentComplete}%`;
      progressPercent.textContent = `${percentComplete}%`;
    }
  });

  // Complete Listener
  xhr.addEventListener('load', () => {
    progressWrapper.style.display = 'none';
    
    if (xhr.status === 201) {
      showToast('Course bundle published successfully!', 'success');
      uploadForm.reset();
      fetchAdminStats(); // Refresh dashboard stats and table
    } else {
      let errMsg = 'Failed to upload course bundle.';
      try {
        const responseJson = JSON.parse(xhr.responseText);
        errMsg = responseJson.error || errMsg;
      } catch (err) {
        console.error("Failed to parse error response:", err);
      }
      showToast(errMsg, 'error');
    }
  });

  // Error Listener
  xhr.addEventListener('error', () => {
    progressWrapper.style.display = 'none';
    showToast('Network error occurred during upload.', 'error');
  });

  // Send request
  xhr.send(formData);
});

// Toast notification helper
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icon = type === 'success' ? '✓' : (type === 'error' ? '✕' : 'ℹ');
  toast.innerHTML = `<span>${icon}</span><p>${message}</p>`;
  
  container.appendChild(toast);
  
  // Slide out and remove toast
  setTimeout(() => {
    toast.style.animation = 'toastFadeIn 0.3s reverse forwards';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Initial fetch on page load
fetchAdminStats();
