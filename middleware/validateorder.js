export const validateCheckout = (data) => {
  const errors = {};

  // Required fields validation
  const requiredFields = [
    "billing_name",
    "billing_email",
    "billing_phone",
    "billing_address",
    "billing_city",
    "billing_state",
    "billing_postal_code",
    "billing_country",
    "payment_method_id",
    "car_id",
  ];

  requiredFields.forEach((field) => {
    if (!data[field] || data[field].toString().trim() === "") {
      errors[field] = "This field is required";
    }
  });

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (data.billing_email && !emailRegex.test(data.billing_email)) {
    errors.billing_email = "Please enter a valid email address";
  }

  // Phone validation
  const phoneRegex = /^\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/;
  if (
    data.billing_phone &&
    !phoneRegex.test(data.billing_phone.replace(/\D/g, ""))
  ) {
    errors.billing_phone = "Please enter a valid phone number";
  }

  // Terms acceptance
  if (!data.terms_accepted) {
    errors.terms_accepted = "You must accept the terms and conditions";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

export const validatePaymentConfirmation = (data) => {
  const errors = {};

  if (!data.transaction_hash || data.transaction_hash.trim() === "") {
    errors.transaction_hash = "Transaction hash is required";
  } else if (data.transaction_hash.length < 10) {
    errors.transaction_hash = "Invalid transaction hash";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};
