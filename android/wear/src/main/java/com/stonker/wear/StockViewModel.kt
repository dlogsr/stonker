package com.stonker.wear

import android.app.Application
import android.content.Context
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.Wearable
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import org.json.JSONArray

data class WatchlistState(
    val stocks: List<StockItem> = emptyList(),
    val loading: Boolean = true,
    val error: String? = null,
)

data class MemeState(
    val bets: List<MemeBet> = emptyList(),
    val loading: Boolean = true,
    val error: String? = null,
)

class StockViewModel(app: Application) : AndroidViewModel(app) {

    private val _watchlist = MutableStateFlow(WatchlistState())
    val watchlist: StateFlow<WatchlistState> = _watchlist.asStateFlow()

    private val _meme = MutableStateFlow(MemeState())
    val meme: StateFlow<MemeState> = _meme.asStateFlow()

    init {
        viewModelScope.launch {
            syncFromDataLayer()
            while (true) { fetchWatchlist(); delay(30_000) }
        }
        viewModelScope.launch {
            while (true) { fetchMeme(); delay(5 * 60_000L) }
        }
    }

    fun refreshWatchlist() { viewModelScope.launch { fetchWatchlist() } }
    fun refreshMeme() { viewModelScope.launch { fetchMeme() } }

    fun loadSentiment(symbol: String) {
        val stock = _watchlist.value.stocks.find { it.symbol == symbol }
        if (stock?.sentiment != null || stock?.sentimentLoading == true) return
        _watchlist.update { s -> s.copy(stocks = s.stocks.map {
            if (it.symbol == symbol) it.copy(sentimentLoading = true) else it
        })}
        viewModelScope.launch {
            try {
                val data = StockRepository.fetchSentiment(symbol)
                _watchlist.update { s -> s.copy(stocks = s.stocks.map {
                    if (it.symbol == symbol) it.copy(sentiment = data, sentimentLoading = false) else it
                })}
            } catch (_: Exception) {
                _watchlist.update { s -> s.copy(stocks = s.stocks.map {
                    if (it.symbol == symbol) it.copy(sentimentLoading = false) else it
                })}
            }
        }
    }

    private suspend fun fetchWatchlist() {
        try {
            val fetched = StockRepository.fetchQuotes(getWatchlistSymbols())
            val existing = _watchlist.value.stocks.associateBy { it.symbol }
            _watchlist.value = WatchlistState(
                stocks = fetched.map { new ->
                    val old = existing[new.symbol]
                    new.copy(sentiment = old?.sentiment, sentimentLoading = old?.sentimentLoading ?: false)
                },
                loading = false,
            )
        } catch (e: Exception) {
            if (_watchlist.value.stocks.isEmpty())
                _watchlist.value = _watchlist.value.copy(loading = false, error = e.message)
        }
    }

    private suspend fun fetchMeme() {
        try {
            _meme.value = MemeState(bets = StockRepository.fetchMemeBets(), loading = false)
        } catch (e: Exception) {
            if (_meme.value.bets.isEmpty())
                _meme.value = _meme.value.copy(loading = false, error = e.message)
        }
    }

    private suspend fun syncFromDataLayer() {
        try {
            val items = Wearable.getDataClient(getApplication<Application>())
                .getDataItems(Uri.parse("wear:/*/watchlist")).await()
            for (item in items) {
                val json = DataMapItem.fromDataItem(item).dataMap.getString("symbols")
                if (!json.isNullOrEmpty()) { saveWatchlistToPrefs(json); break }
            }
            items.release()
        } catch (_: Exception) {}
    }

    private fun saveWatchlistToPrefs(json: String) {
        getApplication<Application>()
            .getSharedPreferences("stonker_prefs", Context.MODE_PRIVATE)
            .edit().putString("watchlist", json).apply()
    }

    private fun getWatchlistSymbols(): List<String> = try {
        val prefs = getApplication<Application>()
            .getSharedPreferences("stonker_prefs", Context.MODE_PRIVATE)
        val json = prefs.getString("watchlist", null)
        if (!json.isNullOrEmpty()) {
            JSONArray(json).let { arr ->
                (0 until arr.length()).map { arr.getString(it) }.takeIf { it.isNotEmpty() }
            }
        } else null
    } catch (_: Exception) { null } ?: StockRepository.DEFAULT_SYMBOLS
}
