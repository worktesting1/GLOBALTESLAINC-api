import Order from "@/models/Order";
import Car from "@/models/Car";
import PaymentMethod from "@/models/PaymentMethod";
import crypto from "crypto";

export class OrderService {
  static async createOrder(userId, checkoutData) {
    try {
      // Generate unique order ID
      const orderId = `ORD-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

      // Get car details
      const car = await Car.findById(checkoutData.car_id);
      if (!car) {
        throw new Error("Car not found");
      }

      // Get payment method
      const paymentMethod = await PaymentMethod.findById(
        checkoutData.payment_method_id,
      );
      if (!paymentMethod || !paymentMethod.isActive) {
        throw new Error("Payment method not available");
      }

      // Calculate amount
      const amount = car.price;
      let cryptoAmount = null;

      if (paymentMethod.type === "crypto") {
        // Convert USD to crypto (simplified - use real rates in production)
        const cryptoRate = await this.getCryptoRate(paymentMethod.code);
        cryptoAmount = amount / cryptoRate;
      }

      // Set expiration (30 minutes from now)
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

      // Create order
      const order = new Order({
        orderId,
        userId,
        carId: car._id,
        status: "pending",
        paymentMethod: paymentMethod.name,
        paymentCurrency: paymentMethod.code,
        amount,
        cryptoAmount,
        walletAddress: paymentMethod.walletAddress || null,
        expiresAt,
        billingInfo: {
          name: checkoutData.billing_name,
          email: checkoutData.billing_email,
          phone: checkoutData.billing_phone,
          company: checkoutData.company_name || "",
          address: checkoutData.billing_address,
          city: checkoutData.billing_city,
          state: checkoutData.billing_state,
          postalCode: checkoutData.billing_postal_code,
          country: checkoutData.billing_country,
          taxId: checkoutData.tax_id || "",
        },
        items: [
          {
            name: car.name,
            quantity: 1,
            price: car.price,
            total: car.price,
          },
        ],
      });

      await order.save();
      return order;
    } catch (error) {
      throw new Error(`Failed to create order: ${error.message}`);
    }
  }

  static async getOrderById(orderId, userId = null) {
    try {
      const query = { orderId };
      if (userId) {
        query.userId = userId;
      }

      const order = await Order.findOne(query)
        .populate("carId", "name price images specifications")
        .populate("userId", "name email");

      if (!order) {
        throw new Error("Order not found");
      }

      return order;
    } catch (error) {
      throw new Error(`Failed to get order: ${error.message}`);
    }
  }

  static async getPaymentDetails(orderId, userId) {
    try {
      const order = await this.getOrderById(orderId, userId);

      if (order.status !== "pending") {
        throw new Error("Order is not in pending state");
      }

      if (order.expiresAt < new Date()) {
        await Order.findByIdAndUpdate(order._id, { status: "expired" });
        throw new Error("Payment session has expired");
      }

      return {
        orderId: order.orderId,
        amount: order.amount,
        cryptoAmount: order.cryptoAmount,
        currency: order.paymentCurrency,
        walletAddress: order.walletAddress,
        expiresAt: order.expiresAt,
        paymentMethod: order.paymentMethod,
        timeLeft: Math.floor((order.expiresAt - new Date()) / 1000),
        qrCodeUrl: this.generateQRCode(order),
      };
    } catch (error) {
      throw new Error(`Failed to get payment details: ${error.message}`);
    }
  }

  static async confirmPayment(orderId, userId, transactionHash) {
    try {
      const order = await this.getOrderById(orderId, userId);

      if (order.status !== "pending") {
        throw new Error("Order is not in pending state");
      }

      if (order.expiresAt < new Date()) {
        await Order.findByIdAndUpdate(order._id, { status: "expired" });
        throw new Error("Payment session has expired");
      }

      // Validate transaction hash (simplified - integrate with blockchain API)
      if (!this.validateTransactionHash(transactionHash)) {
        throw new Error("Invalid transaction hash");
      }

      // Verify payment (in production, verify with blockchain API)
      const isVerified = await this.verifyPayment(
        transactionHash,
        order.walletAddress,
        order.cryptoAmount,
      );

      if (!isVerified) {
        throw new Error("Payment verification failed");
      }

      // Update order
      order.status = "paid";
      order.transactionHash = transactionHash;
      order.paidAt = new Date();
      order.confirmedAt = new Date();
      await order.save();

      return order;
    } catch (error) {
      throw new Error(`Failed to confirm payment: ${error.message}`);
    }
  }

  static async getUserOrders(userId, page = 1, limit = 10) {
    try {
      const skip = (page - 1) * limit;

      const orders = await Order.find({ userId })
        .populate("carId", "name images")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const total = await Order.countDocuments({ userId });

      return {
        orders,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      throw new Error(`Failed to get user orders: ${error.message}`);
    }
  }

  static async cancelOrder(orderId, userId) {
    try {
      const order = await this.getOrderById(orderId, userId);

      if (!["pending", "paid"].includes(order.status)) {
        throw new Error("Order cannot be cancelled");
      }

      order.status = "cancelled";
      await order.save();

      return order;
    } catch (error) {
      throw new Error(`Failed to cancel order: ${error.message}`);
    }
  }

  // Helper methods
  static async getCryptoRate(currency) {
    // Mock rates - replace with real API calls
    const rates = {
      BTC: 50000,
      ETH: 3000,
      LTC: 70,
      USDT: 1,
    };
    return rates[currency] || 1;
  }

  static generateQRCode(order) {
    if (order.paymentMethod.toLowerCase().includes("usdt")) {
      return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&format=png&data=${encodeURIComponent(`usdt:${order.walletAddress}?amount=${order.cryptoAmount}`)}`;
    }
    return null;
  }

  static validateTransactionHash(hash) {
    // Basic validation - adjust based on cryptocurrency
    return hash && hash.length >= 10 && /^[0-9a-fA-F]+$/.test(hash);
  }

  static async verifyPayment(transactionHash, walletAddress, amount) {
    // Mock verification - replace with blockchain API integration
    // For example, use BlockCypher, Etherscan, or other blockchain explorers
    return true; // Temporarily return true for testing
  }
}
