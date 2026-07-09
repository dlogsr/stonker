package com.stonker.wear

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material.Card
import androidx.wear.compose.material.CardDefaults
import androidx.wear.compose.material.CircularProgressIndicator
import androidx.wear.compose.material.ListHeader
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.PositionIndicator
import androidx.wear.compose.material.Scaffold
import androidx.wear.compose.material.SwipeToDismissBox
import androidx.wear.compose.material.SwipeToDismissValue
import androidx.wear.compose.material.Text
import androidx.wear.compose.material.Vignette
import androidx.wear.compose.material.VignettePosition
import androidx.wear.compose.material.rememberSwipeToDismissBoxState

// ── Activity ────────────────────────────────────────────────────────────────

class MainActivity : ComponentActivity() {
    private val viewModel: StockViewModel by viewModels()
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { StonkerWearApp(viewModel) }
    }
}

// ── Navigation ──────────────────────────────────────────────────────────────

sealed class NavScreen {
    data object Main : NavScreen()
    data class StockDetail(val symbol: String) : NavScreen()
    data class MemeDetail(val symbol: String) : NavScreen()
}

@Composable
fun StonkerWearApp(viewModel: StockViewModel) {
    var screen by remember { mutableStateOf<NavScreen>(NavScreen.Main) }
    MaterialTheme {
        when (val s = screen) {
            is NavScreen.Main -> MainScreen(
                viewModel = viewModel,
                onStockTap = { screen = NavScreen.StockDetail(it) },
                onMemeTap = { screen = NavScreen.MemeDetail(it) },
            )
            is NavScreen.StockDetail -> DetailWrapper(onBack = { screen = NavScreen.Main }) {
                StockDetailScreen(symbol = s.symbol, viewModel = viewModel)
            }
            is NavScreen.MemeDetail -> DetailWrapper(onBack = { screen = NavScreen.Main }) {
                MemeDetailScreen(symbol = s.symbol, viewModel = viewModel)
            }
        }
    }
}

@Composable
fun DetailWrapper(onBack: () -> Unit, content: @Composable () -> Unit) {
    BackHandler { onBack() }
    val dismissState = rememberSwipeToDismissBoxState()
    LaunchedEffect(dismissState.currentValue) {
        if (dismissState.currentValue == SwipeToDismissValue.Dismissed) onBack()
    }
    SwipeToDismissBox(state = dismissState) { isBackground ->
        if (!isBackground) content()
        else Box(Modifier.fillMaxSize().background(Color.Black))
    }
}

// ── Main pager ──────────────────────────────────────────────────────────────

@Composable
fun MainScreen(viewModel: StockViewModel, onStockTap: (String) -> Unit, onMemeTap: (String) -> Unit) {
    val pagerState = rememberPagerState(pageCount = { 2 })
    Box(Modifier.fillMaxSize().background(Color.Black)) {
        HorizontalPager(state = pagerState, modifier = Modifier.fillMaxSize()) { page ->
            when (page) {
                0 -> WatchlistTab(viewModel, onStockTap)
                1 -> MemeTab(viewModel, onMemeTap)
            }
        }
        Row(
            modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(5.dp),
        ) {
            repeat(2) { i ->
                val sel = pagerState.currentPage == i
                Box(Modifier.size(if (sel) 6.dp else 4.dp).clip(CircleShape)
                    .background(if (sel) Color.White else Color.White.copy(alpha = 0.35f)))
            }
        }
    }
}

// ── Watchlist tab ────────────────────────────────────────────────────────────

@Composable
fun WatchlistTab(viewModel: StockViewModel, onTap: (String) -> Unit) {
    val state by viewModel.watchlist.collectAsState()
    val listState = rememberScalingLazyListState()
    Scaffold(
        positionIndicator = { PositionIndicator(scalingLazyListState = listState) },
        vignette = { Vignette(vignettePosition = VignettePosition.TopAndBottom) },
    ) {
        ScalingLazyColumn(
            state = listState,
            modifier = Modifier.fillMaxSize().background(Color.Black),
            contentPadding = PaddingValues(horizontal = 6.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            item { ListHeader { Text("STONKER", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 11.sp) } }
            when {
                state.loading && state.stocks.isEmpty() -> item {
                    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(Modifier.size(28.dp), strokeWidth = 3.dp, indicatorColor = Color(0xFF22C55E))
                    }
                }
                state.error != null && state.stocks.isEmpty() -> item {
                    Text("Error loading", color = Color(0xFFEF4444), modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center, fontSize = 12.sp)
                }
                else -> items(state.stocks) { stock ->
                    StockRow(stock) { viewModel.loadSentiment(stock.symbol); onTap(stock.symbol) }
                }
            }
        }
    }
}

@Composable
fun StockRow(stock: StockItem, onClick: () -> Unit) {
    val positive = stock.changePercent >= 0
    val changeColor = if (positive) Color(0xFF22C55E) else Color(0xFFEF4444)
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        backgroundPainter = CardDefaults.cardBackgroundPainter(Color(0xFF1E293B), Color(0xFF1E293B)),
    ) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 5.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text(stock.symbol, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp, modifier = Modifier.width(44.dp))
                if (stock.chart.size > 1) {
                    SparklineChart(
                        points = stock.chart,
                        previousClose = stock.previousClose ?: stock.price,
                        modifier = Modifier.weight(1f).height(20.dp).padding(horizontal = 4.dp),
                    )
                } else {
                    Spacer(Modifier.weight(1f))
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text("$%.2f".format(stock.price), color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                    Text("%+.2f%%".format(stock.changePercent), color = changeColor, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                }
            }
            val chips = buildList {
                stock.weekChange?.let { add("1W ${fmtPct(it)}") }
                stock.monthChange?.let { add("1M ${fmtPct(it)}") }
                stock.signals.take(2).forEach { add(it) }
            }
            if (chips.isNotEmpty()) {
                Spacer(Modifier.height(2.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    chips.forEach { chip ->
                        Text(chip, color = Color(0xFF94A3B8), fontSize = 9.sp)
                    }
                }
            }
        }
    }
}

// ── Meme tab ─────────────────────────────────────────────────────────────────

@Composable
fun MemeTab(viewModel: StockViewModel, onTap: (String) -> Unit) {
    val state by viewModel.meme.collectAsState()
    val listState = rememberScalingLazyListState()
    Scaffold(
        positionIndicator = { PositionIndicator(scalingLazyListState = listState) },
        vignette = { Vignette(vignettePosition = VignettePosition.TopAndBottom) },
    ) {
        ScalingLazyColumn(
            state = listState,
            modifier = Modifier.fillMaxSize().background(Color.Black),
            contentPadding = PaddingValues(horizontal = 6.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            item { ListHeader { Text("MEME BETS", color = Color(0xFFF59E0B), fontWeight = FontWeight.Bold, fontSize = 11.sp) } }
            when {
                state.loading && state.bets.isEmpty() -> item {
                    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(Modifier.size(28.dp), strokeWidth = 3.dp, indicatorColor = Color(0xFFF59E0B))
                    }
                }
                state.error != null && state.bets.isEmpty() -> item {
                    Text("Error loading", color = Color(0xFFEF4444), modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center, fontSize = 12.sp)
                }
                else -> items(state.bets) { bet ->
                    MemeRow(bet) { onTap(bet.symbol) }
                }
            }
        }
    }
}

@Composable
fun MemeRow(bet: MemeBet, onClick: () -> Unit) {
    val positive = bet.changePercent >= 0
    val changeColor = if (positive) Color(0xFF22C55E) else Color(0xFFEF4444)
    val sentimentColor = sentimentColor(bet.sentiment)
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        backgroundPainter = CardDefaults.cardBackgroundPainter(Color(0xFF1A1F2E), Color(0xFF1A1F2E)),
    ) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 5.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp), modifier = Modifier.width(52.dp)) {
                    Text("#${bet.rank}", color = Color(0xFF64748B), fontSize = 9.sp)
                    Text(bet.symbol, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                }
                if (bet.chart.size > 1) {
                    SparklineChart(
                        points = bet.chart,
                        previousClose = bet.previousClose,
                        modifier = Modifier.weight(1f).height(18.dp).padding(horizontal = 4.dp),
                    )
                } else {
                    Spacer(Modifier.weight(1f))
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text("$%.2f".format(bet.price), color = Color.White, fontSize = 11.sp)
                    Text("%+.2f%%".format(bet.changePercent), color = changeColor, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                }
            }
            Spacer(Modifier.height(2.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(bet.sentiment, color = sentimentColor, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                Text("${bet.bullPct}% bull", color = Color(0xFF94A3B8), fontSize = 9.sp)
                Text("${fmtCount(bet.messageCount)} posts", color = Color(0xFF64748B), fontSize = 9.sp)
            }
        }
    }
}

// ── Stock detail ─────────────────────────────────────────────────────────────

@Composable
fun StockDetailScreen(symbol: String, viewModel: StockViewModel) {
    val state by viewModel.watchlist.collectAsState()
    val stock = state.stocks.find { it.symbol == symbol }
    val listState = rememberScalingLazyListState()
    Scaffold(positionIndicator = { PositionIndicator(scalingLazyListState = listState) }) {
        ScalingLazyColumn(
            state = listState,
            modifier = Modifier.fillMaxSize().background(Color.Black),
            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            if (stock == null) {
                item { Text("Loading…", color = Color.White, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center) }
            } else {
                val positive = stock.changePercent >= 0
                val changeColor = if (positive) Color(0xFF22C55E) else Color(0xFFEF4444)

                item {
                    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(stock.symbol, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                        Text(stock.name, color = Color(0xFF94A3B8), fontSize = 10.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Spacer(Modifier.height(3.dp))
                        Text("$%.2f".format(stock.price), color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                        Text("%+.2f%%  (%+.2f)".format(stock.changePercent, stock.change), color = changeColor, fontSize = 11.sp)
                    }
                }

                if (stock.chart.size > 1) {
                    item {
                        SparklineChart(
                            points = stock.chart,
                            previousClose = stock.previousClose ?: stock.price,
                            modifier = Modifier.fillMaxWidth().height(40.dp).padding(horizontal = 4.dp),
                        )
                    }
                }

                item { SentimentCard(stock.sentiment, stock.sentimentLoading) }
                item { StatsGrid(stock) }

                val sources = stock.sentiment?.sources.orEmpty()
                if (sources.isNotEmpty()) {
                    item { SectionLabel("CHATTER") }
                    items(sources.take(6)) { ChatterItem(it.type, it.title, it.sentiment) }
                }
            }
        }
    }
}

// ── Meme detail ──────────────────────────────────────────────────────────────

@Composable
fun MemeDetailScreen(symbol: String, viewModel: StockViewModel) {
    val state by viewModel.meme.collectAsState()
    val bet = state.bets.find { it.symbol == symbol }
    val listState = rememberScalingLazyListState()
    Scaffold(positionIndicator = { PositionIndicator(scalingLazyListState = listState) }) {
        ScalingLazyColumn(
            state = listState,
            modifier = Modifier.fillMaxSize().background(Color.Black),
            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            if (bet == null) {
                item { Text("Loading…", color = Color.White, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center) }
            } else {
                val positive = bet.changePercent >= 0
                val changeColor = if (positive) Color(0xFF22C55E) else Color(0xFFEF4444)

                item {
                    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text("#${bet.rank}", color = Color(0xFF94A3B8), fontSize = 12.sp)
                            Text(bet.symbol, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                            Text(bet.sentiment.uppercase(), color = sentimentColor(bet.sentiment), fontSize = 9.sp, fontWeight = FontWeight.Bold)
                        }
                        Text(bet.name, color = Color(0xFF94A3B8), fontSize = 10.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Spacer(Modifier.height(3.dp))
                        Text("$%.2f".format(bet.price), color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                        Text("%+.2f%%".format(bet.changePercent), color = changeColor, fontSize = 11.sp)
                    }
                }

                if (bet.chart.size > 1) {
                    item {
                        SparklineChart(
                            points = bet.chart,
                            previousClose = bet.previousClose,
                            modifier = Modifier.fillMaxWidth().height(40.dp).padding(horizontal = 4.dp),
                        )
                    }
                }

                item { HypeStats(bet) }
                if (!bet.summary.isNullOrEmpty()) {
                    item { SummaryCard(bet.summary) }
                }
                if (bet.topMessages.isNotEmpty()) {
                    item { SectionLabel("TOP POSTS") }
                    items(bet.topMessages.take(5)) { ChatterItem("stocktwits", it.body, it.sentiment) }
                }
            }
        }
    }
}

// ── Shared components ────────────────────────────────────────────────────────

@Composable
fun SentimentCard(sentiment: SentimentData?, loading: Boolean) {
    Card(onClick = {}, modifier = Modifier.fillMaxWidth(),
        backgroundPainter = CardDefaults.cardBackgroundPainter(Color(0xFF1E293B), Color(0xFF1E293B))) {
        Column(Modifier.padding(horizontal = 10.dp, vertical = 8.dp)) {
            when {
                loading -> Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    CircularProgressIndicator(Modifier.size(10.dp), strokeWidth = 1.5.dp, indicatorColor = Color(0xFF22C55E))
                    Text("loading sentiment…", color = Color(0xFF64748B), fontSize = 10.sp)
                }
                sentiment != null -> {
                    Text(sentiment.sentiment.uppercase(), color = sentimentColor(sentiment.sentiment), fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(4.dp))
                    Text(sentiment.summary, color = Color(0xFFCBD5E1), fontSize = 11.sp)
                }
                else -> Text("No sentiment data", color = Color(0xFF64748B), fontSize = 10.sp)
            }
        }
    }
}

@Composable
fun StatsGrid(stock: StockItem) {
    Card(onClick = {}, modifier = Modifier.fillMaxWidth(),
        backgroundPainter = CardDefaults.cardBackgroundPainter(Color(0xFF1E293B), Color(0xFF1E293B))) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                StatCell("Open", stock.open?.let { "$%.2f".format(it) })
                StatCell("High", stock.high?.let { "$%.2f".format(it) })
                StatCell("Low", stock.low?.let { "$%.2f".format(it) })
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                StatCell("Vol", stock.volume)
                StatCell("Cap", stock.marketCap)
                StatCell("Earn", stock.earningsDate)
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                StatCell("52H", stock.fiftyTwoWeekHigh?.let { "$%.0f".format(it) })
                StatCell("52L", stock.fiftyTwoWeekLow?.let { "$%.0f".format(it) })
                StatCell("1M", stock.monthChange?.let { fmtPct(it) })
            }
        }
    }
}

@Composable
fun HypeStats(bet: MemeBet) {
    Card(onClick = {}, modifier = Modifier.fillMaxWidth(),
        backgroundPainter = CardDefaults.cardBackgroundPainter(Color(0xFF1E293B), Color(0xFF1E293B))) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                StatCell("Hype", "%.1f".format(bet.trendScore))
                StatCell("Bull", "${bet.bullPct}%")
                StatCell("Posts", fmtCount(bet.messageCount))
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                StatCell("Beta", bet.beta?.let { "%.2f".format(it) })
                StatCell("P/E", bet.peRatio?.let { "%.1f".format(it) })
                StatCell("Cap", bet.marketCap)
            }
        }
    }
}

@Composable
fun SummaryCard(summary: String) {
    Card(onClick = {}, modifier = Modifier.fillMaxWidth(),
        backgroundPainter = CardDefaults.cardBackgroundPainter(Color(0xFF1E293B), Color(0xFF1E293B))) {
        Text(summary, color = Color(0xFFCBD5E1), fontSize = 11.sp, modifier = Modifier.padding(10.dp))
    }
}

@Composable
fun RowScope.StatCell(label: String, value: String?) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.weight(1f)) {
        Text(label, color = Color(0xFF64748B), fontSize = 9.sp)
        Text(value ?: "—", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
fun SectionLabel(text: String) {
    Text(text, color = Color(0xFF64748B), fontSize = 9.sp, fontWeight = FontWeight.Bold, modifier = Modifier.fillMaxWidth())
}

@Composable
fun ChatterItem(type: String, title: String, sentiment: String) {
    val badge = when (type) { "stocktwits" -> "ST"; "reddit" -> "WSB"; else -> "NEWS" }
    Row(
        modifier = Modifier.fillMaxWidth()
            .clip(RoundedCornerShape(6.dp))
            .background(Color(0xFF0F172A))
            .padding(horizontal = 8.dp, vertical = 5.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Text(badge, color = Color(0xFF64748B), fontSize = 8.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 1.dp))
        Text(title, color = Color(0xFFCBD5E1), fontSize = 10.sp, modifier = Modifier.weight(1f), maxLines = 3, overflow = TextOverflow.Ellipsis)
        Box(Modifier.size(6.dp).clip(CircleShape).background(sentimentColor(sentiment)).align(Alignment.CenterVertically))
    }
}

// ── Sparkline ────────────────────────────────────────────────────────────────

@Composable
fun SparklineChart(points: List<ChartPoint>, previousClose: Double, modifier: Modifier = Modifier) {
    val prices = remember(points) { points.map { it.p } }
    val positive = (prices.lastOrNull() ?: 0.0) >= previousClose
    val lineColor = if (positive) Color(0xFF22C55E) else Color(0xFFEF4444)
    Canvas(modifier) {
        if (prices.size < 2) return@Canvas
        val minP = minOf(prices.min(), previousClose).toFloat()
        val maxP = maxOf(prices.max(), previousClose).toFloat()
        val range = maxP - minP
        if (range == 0f) return@Canvas
        val w = size.width
        val h = size.height
        val step = w / (prices.size - 1)
        // Baseline
        val baseY = h - ((previousClose.toFloat() - minP) / range * h)
        drawLine(Color.White.copy(alpha = 0.2f), Offset(0f, baseY), Offset(w, baseY), 0.5.dp.toPx())
        // Price line
        val path = Path()
        prices.forEachIndexed { i, price ->
            val x = i * step
            val y = h - ((price.toFloat() - minP) / range * h)
            if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
        }
        drawPath(path, lineColor, style = Stroke(1.5.dp.toPx(), cap = StrokeCap.Round))
    }
}

// ── Utilities ────────────────────────────────────────────────────────────────

fun sentimentColor(s: String) = when (s) {
    "bullish" -> Color(0xFF22C55E)
    "bearish" -> Color(0xFFEF4444)
    else -> Color(0xFF94A3B8)
}

fun fmtPct(v: Double) = "%+.1f%%".format(v)

fun fmtCount(n: Int) = when {
    n >= 1_000_000 -> "%.1fM".format(n / 1_000_000.0)
    n >= 1_000 -> "%.1fK".format(n / 1_000.0)
    else -> n.toString()
}
