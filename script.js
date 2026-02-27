// ========================================
// REDCREST WEBSITE - COMPLETE JavaScript
// Section navigation, cart, quantity controls
// ========================================

// Cart state (persists in localStorage)
let cart = JSON.parse(localStorage.getItem('redcrest-cart')) || [];

// Section navigation
function showSection(sectionId) {
  // Hide all sections
  document.querySelectorAll('.page-section').forEach(section => {
    section.classList.remove('active');
  });
  
  // Show selected section
  const targetSection = document.getElementById(sectionId);
  if (targetSection) {
    targetSection.classList.add('active');
    targetSection.scrollIntoView({ behavior: 'smooth' });
  }
  
  // Update nav active states
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
    if (link.getAttribute('onclick')?.includes(`'${sectionId}'`)) {
      link.classList.add('active');
    }
  });
}

// Quantity controls for product cards
function updateQuantity(button, change) {
  const controls = button.closest('.quantity-controls');
  const display = controls.querySelector('.qty-display');
  let qty = parseInt(display.textContent) || 1;
  qty = Math.max(1, qty + change);
  display.textContent = qty;
}

// Add to cart from product cards
function addToCart(name, price, button) {
  const card = button.closest('.product-card');
  const qtyDisplay = card.querySelector('.qty-display');
  const quantity = parseInt(qtyDisplay?.textContent) || 1;
  
  // Check if item exists in cart
  const existingItem = cart.find(item => item.name === name);
  
  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    cart.push({
      id: Date.now() + Math.random(), // Unique ID
      name: name,
      price: price,
      quantity: quantity
    });
  }
  
  // Save to localStorage and update display
  saveCart();
  updateCartDisplay();
  
  // Show success message
  showNotification(`${name} (${quantity}) added to cart!`, 'success');
  
  // Reset quantity selector
  if (qtyDisplay) qtyDisplay.textContent = '1';
}

// Save cart to localStorage
function saveCart() {
  localStorage.setItem('redcrest-cart', JSON.stringify(cart));
}

// Update cart icon badge
function updateCartDisplay() {
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartIcon = document.getElementById('cartIcon');
  if (cartIcon) {
    cartIcon.textContent = `Cart (${totalItems})`;
  }
}

// Render full cart page
function renderCartItems() {
  const cartItemsList = document.getElementById('cartItemsList');
  const emptyCart = document.getElementById('emptyCart');
  const cartContent = document.getElementById('cartContent');
  
  if (!cartItemsList || !emptyCart || !cartContent) return;
  
  if (cart.length === 0) {
    emptyCart.style.display = 'block';
    cartContent.style.display = 'none';
    return;
  }
  
  emptyCart.style.display = 'none';
  cartContent.style.display = 'grid';
  
  // Generate cart items HTML
  cartItemsList.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div class="item-image">
        ${item.name.split(' ')[1] || 'Jar'}
        <br><small>${item.name}</small>
      </div>
      <div class="item-details">
        <h3>${item.name}</h3>
        <p class="item-price">Rs. ${item.price.toLocaleString()} each</p>
        <div class="item-quantity">
          <span style="color: var(--gray);">Qty:</span>
          <button class="qty-btn-small" onclick="updateCartItemQty(${item.id}, -1)">-</button>
          <span style="font-weight: 600; margin: 0 10px;">${item.quantity}</span>
          <button class="qty-btn-small" onclick="updateCartItemQty(${item.id}, 1)">+</button>
        </div>
      </div>
      <div class="item-actions">
        <div class="item-total">Rs. ${(item.price * item.quantity).toLocaleString()}</div>
        <button class="btn-remove" onclick="removeCartItem(${item.id})">Remove</button>
      </div>
    </div>
  `).join('');
  
  updateCartSummary();
}

// Update cart item quantity
function updateCartItemQty(itemId, change) {
  const item = cart.find(i => i.id === itemId);
  if (item) {
    item.quantity = Math.max(1, item.quantity + change);
    if (item.quantity === 0) {
      removeCartItem(itemId);
      return;
    }
    saveCart();
    renderCartItems();
    updateCartDisplay();
  }
}

// Remove item from cart
function removeCartItem(itemId) {
  cart = cart.filter(i => i.id !== itemId);
  saveCart();
  renderCartItems();
  updateCartDisplay();
  showNotification('Item removed from cart', 'info');
}

// Update cart summary totals
function updateCartSummary() {
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const subtotalEl = document.getElementById('cartSubtotal');
  const totalEl = document.getElementById('cartTotal');
  
  if (subtotalEl) subtotalEl.textContent = `Rs. ${subtotal.toLocaleString()}`;
  if (totalEl) totalEl.textContent = `Rs. ${subtotal.toLocaleString()}`;
}

// Notification system
function showNotification(message, type = 'info') {
  // Create notification element
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed; top: 20px; right: 20px; z-index: 10000;
    background: ${type === 'success' ? 'var(--red-primary)' : '#3498db'};
    color: white; padding: 1rem 1.5rem; border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15); font-weight: 500;
    transform: translateX(400px); transition: all 0.3s ease;
  `;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  // Animate in
  setTimeout(() => notification.style.transform = 'translateX(0)', 100);
  
  // Auto remove
  setTimeout(() => {
    notification.style.transform = 'translateX(400px)';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Clear entire cart
function clearCart() {
  if (confirm('Clear all items from cart?')) {
    cart = [];
    saveCart();
    renderCartItems();
    updateCartDisplay();
    showNotification('Cart cleared!', 'warning');
  }
}

// Form handlers
function handleNewsletter(e) {
  e?.preventDefault();
  showNotification('Welcome to the RedCrest family! 🍅', 'success');
}

function handleContactSubmit(e) {
  e?.preventDefault();
  showNotification('Thanks for reaching out! We\'ll reply within 24 hours.', 'success');
}

// Checkout handler
function handleCheckout() {
  if (cart.length === 0) {
    showNotification('Your cart is empty!', 'warning');
    return;
  }
  showNotification('Redirecting to checkout... (Demo mode)', 'success');
  // In production: redirect to payment gateway
}

// Initialize everything when page loads
document.addEventListener('DOMContentLoaded', function() {
  // Set home as active
  showSection('home');
  
  // Update cart display
  updateCartDisplay();
  
  // Form event listeners
  const newsletterForm = document.querySelector('.newsletter-form');
  const contactForm = document.querySelector('.contact-form');
  
  if (newsletterForm) newsletterForm.onsubmit = handleNewsletter;
  if (contactForm) contactForm.onsubmit = handleContactSubmit;
  
  // Checkout button
  const checkoutBtn = document.querySelector('.cart-summary .btn-primary');
  if (checkoutBtn) checkoutBtn.onclick = handleCheckout;
});
// Mobile menu toggle
function toggleMobileMenu() {
  document.body.classList.toggle('menu-open');
}
