async function handleCheckout() {
  if (!isCheckoutReady()) {
    alert("Completa email y código postal antes de enviar.");
    return;
  }
  const items = Object.values(cart);
  if (!items.length) {
    alert("Agrega productos al carrito antes de enviar.");
    return;
  }
  const subtotal = items.reduce((acc, i) => acc + i.qty * i.price, 0);
  const shipping = getShipping(subtotal);
  const payload = {
    name: nombreInput?.value || "Checkout web",
    email: emailInput?.value || "",
    phone: telInput?.value || "",
    total: subtotal + shipping,
    cp: cpInput?.value || "",
    pais: paisSelect?.value || "",
    address: {
      street: `${calleInput?.value || ""} ${numeroInput?.value || ""}`.trim(),
      floor: pisoInput?.value || "",
      city: ciudadInput?.value || "",
      state: provinciaInput?.value || "",
      country: paisSelect?.value || "",
      zip: cpInput?.value || "",
    },
    pickup: pickupToggle?.checked || false,
    items: items.map((i) => ({
      title: i.name,
      quantity: i.qty,
      unit_price: i.price,
      size: i.size,
    })),
    notes: pickupToggle?.checked ? "Retiro en local" : "Pedido web pendiente de confirmación",
  };
  try {
    showLoader();
    const res = await fetch(ORDER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error();
    const data = await res.json();
    const payRes = await fetch(PAY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        order_id: data.order_id,
        email: emailInput?.value || "",
        total: subtotal + shipping,
        items: [
          { title: `Pedido ${data.order_id}`, quantity: 1, unit_price: subtotal + shipping },
        ],
      }),
    });
    if (!payRes.ok) throw new Error();
    const payData = await payRes.json();
    if (payData.init_point) {
      window.location.href = payData.init_point;
      return;
    }
    alert(`Pedido enviado. ID: ${data.order_id || "pendiente"}`);
    Object.keys(cart).forEach((k) => delete cart[k]);
    persistCart();
    renderCart();
    renderCheckoutSummary();
  } catch (err) {
    alert("No se pudo enviar el pedido o crear el pago. Reintenta o contáctanos.");
  } finally {
    hideLoader();
  }
}
