loadCatalog()
  .then(() => {
    setupProductSpecs();
    setupCartButtons();
    renderCart();
  })
  .catch(error => {
    console.error(error);
    setupProductSpecs();
    setupCartButtons();
    renderCart();
  });
