/**
 * Helper functions to format stock data for frontend
 */

/**
 * Format stock data for frontend response
 * @param {Object} stockData - Raw stock data from database/finance API
 * @param {Number} quantity - User's holding quantity
 * @param {Object} holdingData - User's holding data (avg price, etc.)
 * @returns {Object} Formatted stock data for frontend
 */
export function formatStockForFrontend(
  stockData,
  quantity = 0,
  holdingData = {},
) {
  const {
    symbol,
    name,
    price = 0,
    change = 0,
    changePercent = 0,
    volume = "0M",
    marketCap = "$0",
    sector = "Technology",
    industry = "Technology",
    logo = "",
    exchange = "",
    country = "US",
    currency = "USD",
  } = stockData;

  // Calculate totals
  const totalValue = price * quantity;
  const totalInvested = (holdingData.avgPurchasePrice || 0) * quantity;
  const unrealizedPL = totalValue - totalInvested;
  const unrealizedPLPercent =
    totalInvested > 0 ? (unrealizedPL / totalInvested) * 100 : 0;

  return {
    symbol: symbol?.toUpperCase() || "",
    name: name || "",
    price: formatCurrency(price, currency),
    change: formatChange(change),
    changePercent: formatPercent(changePercent),
    volume: formatVolume(volume),
    marketCap: formatMarketCap(marketCap),
    sector: sector || "N/A",
    industry: industry || "N/A",
    logo: logo || getDefaultLogo(symbol),
    exchange: exchange || "N/A",
    country: country || "US",
    currency: currency || "USD",
    quantity: formatQuantity(quantity),
    total: formatCurrency(totalValue, currency),
    // Additional useful data for frontend
    avgPurchasePrice: holdingData.avgPurchasePrice
      ? formatCurrency(holdingData.avgPurchasePrice, currency)
      : formatCurrency(0, currency),
    totalInvested: formatCurrency(totalInvested, currency),
    unrealizedPL: formatCurrency(unrealizedPL, currency),
    unrealizedPLPercent: formatPercent(unrealizedPLPercent),
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Get default logo URL if none provided
 */
export function getDefaultLogo(symbol) {
  if (!symbol) return "";
  return `https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/${symbol.toUpperCase()}.png`;
}

/**
 * Format currency with proper symbols
 */
export function formatCurrency(amount, currency = "USD") {
  if (typeof amount !== "number" || isNaN(amount)) {
    amount = 0;
  }

  const currencySymbols = {
    USD: "$",
    EUR: "€",
    GBP: "£",
    JPY: "¥",
    CNY: "¥",
    INR: "₹",
  };

  const symbol = currencySymbols[currency] || "$";

  // Format with proper decimal places
  const absAmount = Math.abs(amount);
  let formatted;

  if (absAmount >= 1000000000) {
    formatted = `${symbol}${(amount / 1000000000).toFixed(2)}B`;
  } else if (absAmount >= 1000000) {
    formatted = `${symbol}${(amount / 1000000).toFixed(2)}M`;
  } else if (absAmount >= 1000) {
    formatted = `${symbol}${(amount / 1000).toFixed(2)}K`;
  } else if (absAmount >= 1) {
    formatted = `${symbol}${amount.toFixed(2)}`;
  } else {
    formatted = `${symbol}${amount.toFixed(4)}`;
  }

  return formatted;
}

/**
 * Format percentage change
 */
export function formatPercent(value) {
  if (typeof value !== "number" || isNaN(value)) {
    return "0%";
  }

  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

/**
 * Format volume
 */
export function formatVolume(volume) {
  if (typeof volume === "number") {
    if (volume >= 1000000000) {
      return `${(volume / 1000000000).toFixed(2)}B`;
    } else if (volume >= 1000000) {
      return `${(volume / 1000000).toFixed(2)}M`;
    } else if (volume >= 1000) {
      return `${(volume / 1000).toFixed(1)}K`;
    }
    return volume.toString();
  }
  return volume || "0M";
}

/**
 * Format market cap
 */
export function formatMarketCap(marketCap) {
  if (typeof marketCap === "number") {
    return formatCurrency(marketCap, "USD");
  }
  return marketCap || "$0";
}

/**
 * Format change amount
 */
export function formatChange(change) {
  if (typeof change !== "number" || isNaN(change)) {
    return "0.00";
  }

  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(2)}`;
}

/**
 * Format quantity for display
 */
export function formatQuantity(quantity) {
  if (typeof quantity !== "number" || isNaN(quantity)) {
    return "0";
  }

  if (quantity >= 1000000) {
    return `${(quantity / 1000000).toFixed(2)}M`;
  } else if (quantity >= 1000) {
    return `${(quantity / 1000).toFixed(2)}K`;
  } else if (quantity < 0.001) {
    return quantity.toFixed(8);
  } else if (quantity < 1) {
    return quantity.toFixed(4);
  }

  return quantity.toFixed(2);
}

/**
 * Helper to fetch live stock data (you'll need to implement actual API integration)
 */
export async function fetchLiveStockData(symbol) {
  try {
    // Replace with your actual stock data API
    const response = await fetch(`/api/stocks/quote?symbol=${symbol}`);
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.error("Error fetching stock data:", error);
  }

  // Return fallback data
  return {
    symbol,
    price: 0,
    change: 0,
    changePercent: 0,
    volume: "0M",
    marketCap: "$0",
  };
}
