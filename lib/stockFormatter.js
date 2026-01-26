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

/**
 * Helper to fetch live stock data
 */
export async function fetchLiveStockData(symbol) {
  try {
    // Validate symbol
    if (!symbol || typeof symbol !== "string") {
      console.error("Invalid symbol:", symbol);
      return getFallbackData(symbol);
    }

    const cleanSymbol = symbol.trim().toUpperCase();

    // For server-side calls, we need the full URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    // Construct the full URL
    const url = `${baseUrl}/api/stocks/quote?symbol=${encodeURIComponent(cleanSymbol)}`;

    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
      },
      // Add timeout to prevent hanging requests
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (response.ok) {
      const data = await response.json();
      return data;
    } else {
      console.error(`API responded with status: ${response.status}`);
    }
  } catch (error) {
    // Don't log timeout errors as full errors
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      console.warn(`Stock data fetch timed out for ${symbol}`);
    } else {
      console.error("Error fetching stock data:", error);
    }
  }

  // Return fallback data
  return getFallbackData(symbol);
}

/**
 * Get fallback data when API fails
 */
function getFallbackData(symbol) {
  const cleanSymbol = symbol?.toUpperCase() || "";

  return {
    symbol: cleanSymbol,
    price: 0,
    change: 0,
    changePercent: 0,
    volume: "0M",
    marketCap: "$0",
    name: cleanSymbol,
    currency: "USD",
    exchange: "NASDAQ",
    country: "US",
  };
}

/**
 * Alternative: Cache stock data to reduce API calls
 */
const stockDataCache = new Map();
const CACHE_DURATION = 60000; // 1 minute cache

export async function fetchLiveStockDataWithCache(symbol) {
  const cleanSymbol = symbol?.trim().toUpperCase();

  if (!cleanSymbol) {
    return getFallbackData(cleanSymbol);
  }

  // Check cache first
  const cached = stockDataCache.get(cleanSymbol);
  const now = Date.now();

  if (cached && now - cached.timestamp < CACHE_DURATION) {
    console.log(`Using cached data for ${cleanSymbol}`);
    return cached.data;
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const url = `${baseUrl}/api/stocks/quote?symbol=${encodeURIComponent(cleanSymbol)}`;

    const response = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10000),
    });

    if (response.ok) {
      const data = await response.json();

      // Cache the result
      stockDataCache.set(cleanSymbol, {
        data,
        timestamp: now,
      });

      return data;
    }
  } catch (error) {
    console.error(`Error fetching stock data for ${cleanSymbol}:`, error);
  }

  // Return cached data even if expired, or fallback
  if (cached) {
    console.log(`Using expired cached data for ${cleanSymbol}`);
    return cached.data;
  }

  return getFallbackData(cleanSymbol);
}
