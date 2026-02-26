// RedCrest Website JavaScript
// Section navigation, cart management, and interactions

// Cart state
let cart = [];
let currentProduct = {
  name: 'RedCrest Classic',
  price: 2500,
  quantity: 1
};

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
  }
  
  // Update nav links
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
    if (link.dataset.section === sectionId) {
      link.classList.add('active');
    }
  });
  
  // Scroll to top
  window.scrollTo(0, 0);
}

// Product detail navigation
function showProductDetail(productType) {
  const products = {
    classic: {
      name: 'RedCrest Classic',
      price: 2500,
      badge: 'Bestseller',
      badgeClass: '',
      description: 'The one that started it all. Sun-ripened tomatoes, slow-cooked for that deep, authentic flavor your family will love.',
      image: 'Large RedCrest Classic Jar<br><br>Photographed on White Marble Counter<br>with Fresh Whole Tomatoes<br>and Wooden Spoon'
    },
    spicy: {
      name: 'RedCrest Spicy',
      price: 2700,
      badge: 'New',
      badgeClass: 'badge-new',
      description: 'Turn up the heat. All the richness of our classic, with a bold kick of chili. Perfect for those who like it hot.',
      image: 'Large RedCrest Spicy Jar<br><br>Photographed on White Marble Counter<br>with Fresh Red Chilies<br>and Wooden Spoon'
    },
    herb: {
      name: 'RedCrest Herb Infused',
      price: 2800,
      badge: 'Limited',
      badgeClass: 'badge-limited',
      description: 'Elevated everyday cooking. Classic tomato goodness with fragrant herbs and roasted garlic. Your secret ingredient.',
      image: 'Large RedCrest Herb Infused Jar<br><br>Photographed on White Marble Counter<br>with Fresh Basil & Garlic<br>and Wooden Spoon'
    }
  };
  
  const product = products[productType];
  if (product) {
    currentProduct = {
      name: product.name,
      price: product.price,
      quantity: 1
    };
    
    document.getElementById('detailTitle').textContent = product.name;
    document.getElementById('detailPrice').textContent = 'Rs. ' + product.price.toLocaleString();
    document.getElementById('detailDescription').textContent = product.description;
    document.getElementById('detailImage').innerHTML = product.image;
    document.getElementById('detailQty').textContent = '1';
    
    const badge = document.getElementById('detailBadge');
    badge.textContent = product.badge;
    badge.className = 'product-badge ' + product.badgeClass;
    
    showSection('product-detail');
  }
}

// Quantity controls for product cards
function updateQuantity(button, change) {
  const controls = button.closest('.quantity-controls');
  const display = controls.querySelector('.qty-display');
  let qty = parseInt(display.textContent);
  qty = Math.max(1, qty + change);
  display.textContent = qty;
}

// Quantity controls for product detail
function updateDetailQty(change) {
  let qty = parseInt(document.getElementById('detailQty').textContent);
  qty = Math.max(1, qty + change);
  document.getElementById('detailQty').textContent = qty;
  currentProduct.quantity = qty;
}

// Add to cart from products page
function addToCart(name, price, button) {
  const card = button.closest('.product-card');
  const qtyDisplay = card.querySelector('.qty-display');
  const quantity = qtyDisplay ? parseInt(qtyDisplay.textContent) : 1;
  
  const existingItem = cart.find(item => item.name === name);
  
  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    cart.push({
      name: name,
      price: price,
      quantity: quantity,
      id: Date.now()
    });
  }
  
  updateCartDisplay();
  alert(name + ' added to cart!');
  
  // Reset quantity to 1
  if (qtyDisplay) {
    qtyDisplay.textContent = '1';
  }
}

// Add to cart from detail page
function addToCartFromDetail() {
  const existingItem = cart.find(item => item.name === currentProduct.name);
  
  if (existingItem) {
    existingItem.quantity += currentProduct.quantity;
  } else {
    cart.push({
      name: currentProduct.name,
      price: currentProduct.price,
      quantity: currentProduct.quantity,
      id: Date.now()
    });
  }
  
  updateCartDisplay();
  alert(currentProduct.name + ' added to cart!');
  
  // Reset quantity
  document.getElementById('detailQty').textContent = '1';
  currentProduct.quantity = 1;
}

// Update cart display
function updateCartDisplay() {
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  document.getElementById('cartIcon').textContent = 'Cart (' + totalItems + ')';
  
  renderCartItems();
}

// Render cart items
function renderCartItems() {
  const cartItemsList = document.getElementById('cartItemsList');
  const emptyCart = document.getElementById('emptyCart');
  const cartContent = document.getElementById('cartContent');
  
  if (cart.length === 0) {
    emptyCart.style.display = 'block';
    cartContent.style.display = 'none';
    return;
  }
  
  emptyCart.style.display = 'none';
  cartContent.style.display = 'grid';
  
  cartItemsList.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div class="item-image">${item.name.split(' ')[1]}<br>${item.name.split(' ')[2] || ''}</div>
      <div class="item-details">
        <h3>${item.name}</h3>
        <p class="item-price">Rs. ${item.price.toLocaleString()} each</p>
        <div class="item-quantity">
          <span style="color: #7F8C8D; font-size: 0.9rem;">Quantity:</span>
          <button class="qty-btn-small" onclick="updateCartItemQty(${item.id}, -1)">-</button>
          <span style="font-weight: 600;">${item.quantity}</span>
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
    updateCartDisplay();
  }
}

// Remove cart item
function removeCartItem(itemId) {
  cart = cart.filter(i => i.id !== itemId);
  updateCartDisplay();
}

// Update cart summary
function updateCartSummary() {
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  document.getElementById('cartSubtotal').textContent = 'Rs. ' + subtotal.toLocaleString();
  document.getElementById('cartTotal').textContent = 'Rs. ' + subtotal.toLocaleString();
}

// Newsletter form handler
function handleNewsletter(e) {
  e.preventDefault();
  alert('Welcome to the family! Check your inbox for a special offer.');
  e.target.reset();
  return false;
}

// Contact form handler
function handleContactSubmit(e) {
  e.preventDefault();
  alert('Thank you for your message! We\'ll get back to you within 24 hours.');
  e.target.reset();
  return false;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  // Set home section as active
  showSection('home');
  
  // Initialize cart display
  updateCartDisplay();
});
