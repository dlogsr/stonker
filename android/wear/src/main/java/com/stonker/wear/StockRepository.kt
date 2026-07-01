package com.stonker.wear

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

// ── Models ──────────────────────────────────────────────────────────────────

data class ChartPoint(val t: Long, val p: Double, val phase: String)

data class SentimentSource(val type: String, val title: String, val sentiment: String)

data class SentimentData(
    val summary: String,
    val sentiment: String,
    val sources: List<SentimentSource>,
)

data class StockItem(
    val symbol: String,
    val name: String,
    val price: Double,
    val change: Double,
    val changePercent: Double,
    val chart: List<ChartPoint> = emptyList(),
    val previousClose: Double? = null,
    val weekChange: Double? = null,
    val monthChange: Double? = null,
    val afterHoursPercent: Double? = null,
    val signals: List<String> = emptyList(),
    val earningsDate: String? = null,
    val open: Double? = null,
    val high: Double? = null,
    val low: Double? = null,
    val volume: String? = null,
    val marketCap: String? = null,
    val fiftyTwoWeekHigh: Double? = null,
    val fiftyTwoWeekLow: Double? = null,
    val sentiment: SentimentData? = null,
    val sentimentLoading: Boolean = false,
)

data class MemeMessage(val body: String, val sentiment: String, val likes: Int)

data class MemeBet(
    val rank: Int,
    val symbol: String,
    val name: String,
    val price: Double,
    val change: Double,
    val changePercent: Double,
    val chart: List<ChartPoint> = emptyList(),
    val previousClose: Double = 0.0,
    val sentiment: String,
    val bullPct: Int,
    val trendScore: Double,
    val summary: String? = null,
    val messageCount: Int,
    val totalLikes: Int,
    val watchers: Int? = null,
    val beta: Double? = null,
    val peRatio: Double? = null,
    val marketCap: String? = null,
    val topMessages: List<MemeMessage> = emptyList(),
)

// ── Repository ──────────────────────────────────────────────────────────────

object StockRepository {
    private const val API_BASE = "https://stonker-production.up.railway.app/api"
    val DEFAULT_SYMBOLS = listOf("AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "NVDA", "META")

    suspend fun fetchQuotes(symbols: List<String>): List<StockItem> = withContext(Dispatchers.IO) {
        val json = get("$API_BASE/quotes?symbols=${symbols.joinToString(",")}&timeScale=1D")
        val arr = json.getJSONArray("quotes")
        (0 until arr.length()).map { parseStockItem(arr.getJSONObject(it)) }
    }

    suspend fun fetchSentiment(symbol: String): SentimentData = withContext(Dispatchers.IO) {
        val json = get("$API_BASE/sentiment/$symbol")
        SentimentData(
            summary = json.optString("summary", ""),
            sentiment = json.optString("sentiment", "neutral"),
            sources = parseSources(json.optJSONArray("sources")),
        )
    }

    suspend fun fetchMemeBets(): List<MemeBet> = withContext(Dispatchers.IO) {
        val json = get("$API_BASE/stocktwits/trending?timeScale=1D")
        val arr = json.getJSONArray("bets")
        (0 until arr.length()).map { parseMemeBet(arr.getJSONObject(it), it) }
    }

    private fun parseStockItem(q: JSONObject) = StockItem(
        symbol = q.getString("symbol"),
        name = q.optString("name", q.getString("symbol")),
        price = q.getDouble("price"),
        change = q.optDouble("change", 0.0),
        changePercent = q.getDouble("changePercent"),
        chart = parseChart(q.optJSONArray("chart")),
        previousClose = q.optDouble("previousClose").nan2null(),
        weekChange = q.optDouble("weekChange").nan2null(),
        monthChange = q.optDouble("monthChange").nan2null(),
        afterHoursPercent = q.optDouble("afterHoursPercent").nan2null(),
        signals = parseStringList(q.optJSONArray("signals")),
        earningsDate = q.optString("earningsDate").ifEmpty { null },
        open = q.optDouble("open").nan2null(),
        high = q.optDouble("high").nan2null(),
        low = q.optDouble("low").nan2null(),
        volume = q.optString("volume").ifEmpty { null },
        marketCap = q.optString("marketCap").ifEmpty { null },
        fiftyTwoWeekHigh = q.optDouble("fiftyTwoWeekHigh").nan2null(),
        fiftyTwoWeekLow = q.optDouble("fiftyTwoWeekLow").nan2null(),
    )

    private fun parseMemeBet(b: JSONObject, idx: Int) = MemeBet(
        rank = b.optInt("rank", idx + 1),
        symbol = b.getString("symbol"),
        name = b.optString("name", b.getString("symbol")),
        price = b.optDouble("price", 0.0),
        change = b.optDouble("change", 0.0),
        changePercent = b.optDouble("changePercent", 0.0),
        chart = parseChart(b.optJSONArray("chart")),
        previousClose = b.optDouble("previousClose", 0.0),
        sentiment = b.optString("sentiment", "neutral"),
        bullPct = b.optInt("bullPct", 50),
        trendScore = b.optDouble("trendScore", 0.0),
        summary = b.optString("summary").ifEmpty { null },
        messageCount = b.optInt("messageCount", 0),
        totalLikes = b.optInt("totalLikes", 0),
        watchers = b.optInt("watchers").takeIf { it > 0 },
        beta = b.optDouble("beta").nan2null(),
        peRatio = b.optDouble("peRatio").nan2null(),
        marketCap = b.optString("marketCap").ifEmpty { null },
        topMessages = parseMemeMessages(b.optJSONArray("topMessages")),
    )

    private fun parseChart(arr: JSONArray?) = arr?.let {
        (0 until it.length()).map { i ->
            val p = it.getJSONObject(i)
            ChartPoint(p.optLong("t", 0), p.optDouble("p", 0.0), p.optString("phase", "regular"))
        }
    } ?: emptyList()

    private fun parseStringList(arr: JSONArray?) = arr?.let {
        (0 until it.length()).map { i -> it.getString(i) }
    } ?: emptyList()

    private fun parseSources(arr: JSONArray?) = arr?.let {
        (0 until it.length()).map { i ->
            val s = it.getJSONObject(i)
            SentimentSource(s.optString("type", "news"), s.optString("title", ""), s.optString("sentiment", "neutral"))
        }
    } ?: emptyList()

    private fun parseMemeMessages(arr: JSONArray?) = arr?.let {
        (0 until it.length()).map { i ->
            val m = it.getJSONObject(i)
            MemeMessage(m.optString("body", ""), m.optString("sentiment", "neutral"), m.optInt("likes", 0))
        }
    } ?: emptyList()

    private fun get(urlStr: String): JSONObject {
        val conn = URL(urlStr).openConnection() as HttpURLConnection
        conn.connectTimeout = 10_000
        conn.readTimeout = 10_000
        conn.setRequestProperty("Accept", "application/json")
        return try {
            JSONObject(conn.inputStream.bufferedReader().readText())
        } finally {
            conn.disconnect()
        }
    }

    private fun Double.nan2null() = if (isNaN()) null else this
}
