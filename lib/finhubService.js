import axios from "axios";

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const ALPHA_VANTAGE_KEY = process.env.ALPHA_VANTAGE_KEY;

const finnhub = axios.create({
  baseURL: "https://finnhub.io/api/v1",
  params: {
    token: FINNHUB_API_KEY,
  },
});

const alphaVantage = axios.create({
  baseURL: "https://www.alphavantage.co/query",
});

export const stockService = {
  /**
   * Get stock quote from Finnhub
   */
  async getStockQuote(symbol) {
    try {
      const response = await finnhub.get("/quote", {
        params: { symbol: symbol.toUpperCase() },
      });

      return {
        current: response.data.c || 0,
        change: response.data.d || 0,
        percentChange: response.data.dp || 0,
        high: response.data.h || 0,
        low: response.data.l || 0,
        open: response.data.o || 0,
        previousClose: response.data.pc || 0,
        timestamp: response.data.t || Date.now(),
      };
    } catch (error) {
      console.error("Error fetching stock quote:", error);
      return null;
    }
  },

  /**
   * Get stock profile from Finnhub
   */
  async getStockProfile(symbol) {
    try {
      const response = await finnhub.get("/stock/profile2", {
        params: { symbol: symbol.toUpperCase() },
      });

      return {
        name: response.data.name || `${symbol.toUpperCase()} Inc.`,
        logo:
          response.data.logo ||
          `https://placehold.co/100x100/3b82f6/ffffff?text=${symbol.substring(0, 2)}`,
        marketCap: response.data.marketCapitalization || 0,
        currency: response.data.currency || "USD",
        exchange: response.data.exchange || "N/A",
        country: response.data.country || "US",
        industry: response.data.finnhubIndustry || "Technology",
        weburl: response.data.weburl || "",
        phone: response.data.phone || "",
        shareOutstanding: response.data.shareOutstanding || 0,
        ticker: response.data.ticker || symbol.toUpperCase(),
      };
    } catch (error) {
      console.error("Error fetching stock profile:", error);
      return null;
    }
  },

  /**
   * Get stock recommendations
   */
  async getStockRecommendations(symbol) {
    try {
      const response = await finnhub.get("/stock/recommendation", {
        params: { symbol: symbol.toUpperCase() },
      });

      if (response.data && response.data.length > 0) {
        const latest = response.data[0];
        return {
          consensus: this.getConsensus(latest),
          buyRating: this.calculateBuyRating(latest),
          recommendations: {
            strongBuy: latest.strongBuy || 0,
            buy: latest.buy || 0,
            hold: latest.hold || 0,
            sell: latest.sell || 0,
            strongSell: latest.strongSell || 0,
          },
          period: latest.period || "Current",
          symbol: latest.symbol || symbol.toUpperCase(),
        };
      }
      return null;
    } catch (error) {
      console.error("Error fetching recommendations:", error);
      return null;
    }
  },

  /**
   * Get historical data from Alpha Vantage
   */
  async getHistoricalData(symbol) {
    try {
      const response = await alphaVantage.get("", {
        params: {
          function: "TIME_SERIES_DAILY",
          symbol: symbol.toUpperCase(),
          apikey: ALPHA_VANTAGE_KEY,
          outputsize: "compact",
          datatype: "json",
        },
      });

      if (response.data["Time Series (Daily)"]) {
        const timeSeries = response.data["Time Series (Daily)"];
        const dates = Object.keys(timeSeries).slice(0, 30);

        return dates
          .map((date) => ({
            date,
            open: parseFloat(timeSeries[date]["1. open"]),
            high: parseFloat(timeSeries[date]["2. high"]),
            low: parseFloat(timeSeries[date]["3. low"]),
            close: parseFloat(timeSeries[date]["4. close"]),
            volume: parseFloat(timeSeries[date]["5. volume"]),
          }))
          .reverse();
      }
      return null;
    } catch (error) {
      console.error("Error fetching historical data:", error);
      return null;
    }
  },

  /**
   * Get comprehensive stock data (quote + profile)
   */
  async getStockData(symbol) {
    try {
      const [quote, profile, recommendations] = await Promise.all([
        this.getStockQuote(symbol),
        this.getStockProfile(symbol),
        this.getStockRecommendations(symbol),
      ]);

      if (!quote || !profile) {
        throw new Error("Failed to fetch stock data");
      }

      // Calculate volume
      const volume = this.formatVolume(0); // You might need to get volume from another endpoint

      // Format market cap
      const marketCap = this.formatMarketCap(profile.marketCap);

      return {
        symbol: symbol.toUpperCase(),
        name: profile.name,
        price: quote.current,
        change: quote.change,
        changePercent: quote.percentChange,
        volume: volume,
        marketCap: marketCap,
        sector: profile.industry,
        industry: profile.industry,
        logo: profile.logo,
        exchange: profile.exchange,
        country: profile.country,
        currency: profile.currency,
        recommendations: recommendations,
        quote: quote,
        profile: profile,
      };
    } catch (error) {
      console.error("Error fetching comprehensive stock data:", error);
      return null;
    }
  },

  /**
   * Search for stocks by symbol or name
   */
  async searchStocks(query) {
    try {
      const response = await finnhub.get("/search", {
        params: { q: query },
      });

      if (response.data.result) {
        return response.data.result.slice(0, 10).map((item) => ({
          symbol: item.symbol,
          name: item.description,
          type: item.type,
          currency: item.currency || "USD",
          exchange: item.exchange || "N/A",
        }));
      }
      return [];
    } catch (error) {
      console.error("Error searching stocks:", error);
      return [];
    }
  },

  /**
   * Helper methods
   */
  formatVolume(volume) {
    if (!volume) return "0M";
    if (volume >= 1000000000) {
      return `${(volume / 1000000000).toFixed(1)}B`;
    }
    if (volume >= 1000000) {
      return `${(volume / 1000000).toFixed(1)}M`;
    }
    if (volume >= 1000) {
      return `${(volume / 1000).toFixed(1)}K`;
    }
    return volume.toString();
  },

  formatMarketCap(marketCap) {
    if (!marketCap) return "$0.00";
    if (marketCap >= 1000000000000) {
      return `$${(marketCap / 1000000000000).toFixed(2)}T`;
    }
    if (marketCap >= 1000000000) {
      return `$${(marketCap / 1000000000).toFixed(2)}B`;
    }
    if (marketCap >= 1000000) {
      return `$${(marketCap / 1000000).toFixed(2)}M`;
    }
    if (marketCap >= 1000) {
      return `$${(marketCap / 1000).toFixed(2)}K`;
    }
    return `$${marketCap.toFixed(2)}`;
  },

  getConsensus(analystData) {
    const {
      strongBuy = 0,
      buy = 0,
      hold = 0,
      sell = 0,
      strongSell = 0,
    } = analystData;
    const total = strongBuy + buy + hold + sell + strongSell;

    if (total === 0) return "Hold";

    const buyScore = (strongBuy * 2 + buy) / total;
    const sellScore = (strongSell * 2 + sell) / total;

    if (buyScore > 0.6) return "Strong Buy";
    if (buyScore > 0.4) return "Buy";
    if (sellScore > 0.6) return "Strong Sell";
    if (sellScore > 0.4) return "Sell";
    return "Hold";
  },

  calculateBuyRating(analystData) {
    const {
      strongBuy = 0,
      buy = 0,
      hold = 0,
      sell = 0,
      strongSell = 0,
    } = analystData;
    const total = strongBuy + buy + hold + sell + strongSell;

    if (total === 0) return 50;

    const positiveRatings = strongBuy + buy;
    return Math.round((positiveRatings / total) * 100);
  },
};
