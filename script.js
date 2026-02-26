
:root {
  --primary: #c62828;
  --secondary: #fff4ec;
  --text-dark: #333;
}

body {
  margin: 0;
  font-family: 'Segoe UI', sans-serif;
  color: var(--text-dark);
  background: #ffffff;
}

.container {
  max-width: 1100px;
  margin: auto;
  padding: 0 20px;
}

.navbar {
  background: var(--primary);
  color: white;
  padding: 15px 0;
}

.nav-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo {
  margin: 0;
}

nav a {
  color: white;
  margin-left: 20px;
  text-decoration: none;
  font-weight: 500;
}

.section {
  padding: 80px 0;
  display: none;
}

.section.active {
  display: block;
}

.hero {
  background: var(--secondary);
}

.hero-content {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 40px;
}

.hero-text {
  flex: 1;
}

.hero-text h2 {
  font-size: 38px;
  color: var(--primary);
}

.hero-image {
  flex: 1;
}

.image-placeholder {
  background: #f9d6c8;
  height: 250px;
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
}

.primary-btn {
  background: var(--primary);
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 30px;
  cursor: pointer;
  margin-top: 15px;
}

.trust-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 20px;
  margin-top: 50px;
}

.trust-card {
  background: white;
  padding: 20px;
  border-radius: 16px;
  text-align: center;
  box-shadow: 0 6px 20px rgba(0,0,0,0.05);
}

.product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 30px;
  margin-top: 40px;
}

.product-card {
  background: white;
  padding: 30px;
  border-radius: 20px;
  box-shadow: 0 8px 25px rgba(0,0,0,0.06);
  text-align: center;
}

.section-title {
  text-align: center;
  font-size: 30px;
  color: var(--primary);
}

.light-bg {
  background: var(--secondary);
}

.contact-form {
  display: flex;
  flex-direction: column;
  gap: 15px;
  max-width: 500px;
  margin: auto;
}

.contact-form input,
.contact-form textarea {
  padding: 12px;
  border-radius: 10px;
  border: 1px solid #ddd;
}

.cart-box {
  background: white;
  padding: 30px;
  border-radius: 16px;
  text-align: center;
}

footer {
  background: var(--primary);
  color: white;
  text-align: center;
  padding: 20px 0;
}

@media(max-width: 768px){
  .hero-content {
    flex-direction: column;
  }
}
