package com.stonker.wear

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
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
import androidx.wear.compose.material.Text
import androidx.wear.compose.material.Vignette
import androidx.wear.compose.material.VignettePosition

class MainActivity : ComponentActivity() {
    private val viewModel: StockViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            StonkerWearApp(viewModel)
        }
    }
}

@Composable
fun StonkerWearApp(viewModel: StockViewModel) {
    val uiState by viewModel.uiState.collectAsState()
    val listState = rememberScalingLazyListState()

    MaterialTheme {
        Scaffold(
            positionIndicator = { PositionIndicator(scalingLazyListState = listState) },
            vignette = { Vignette(vignettePosition = VignettePosition.TopAndBottom) },
        ) {
            ScalingLazyColumn(
                state = listState,
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black),
                contentPadding = PaddingValues(horizontal = 8.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                item {
                    ListHeader {
                        Text(
                            text = "Stonker",
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                }

                when (val state = uiState) {
                    is StockUiState.Loading -> item {
                        CircularProgressIndicator(
                            modifier = Modifier.padding(16.dp),
                            indicatorColor = Color(0xFF22C55E),
                        )
                    }
                    is StockUiState.Error -> item {
                        Text(
                            text = "Tap to retry",
                            color = Color(0xFFEF4444),
                            textAlign = TextAlign.Center,
                            modifier = Modifier.fillMaxWidth().padding(8.dp),
                        )
                    }
                    is StockUiState.Success -> items(state.stocks) { stock ->
                        StockCard(stock)
                    }
                }
            }
        }
    }
}

@Composable
fun StockCard(stock: StockItem) {
    val isPositive = stock.changePercent >= 0
    val changeColor = if (isPositive) Color(0xFF22C55E) else Color(0xFFEF4444)
    val changeStr = "%+.2f%%".format(stock.changePercent)

    Card(
        onClick = {},
        modifier = Modifier.fillMaxWidth().height(52.dp),
        backgroundPainter = CardDefaults.cardBackgroundPainter(
            startBackgroundColor = Color(0xFF1E293B),
            endBackgroundColor = Color(0xFF1E293B),
        ),
    ) {
        Row(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column {
                Text(
                    text = stock.symbol,
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                )
                Text(
                    text = "$%.2f".format(stock.price),
                    color = Color(0xFF94A3B8),
                    fontSize = 11.sp,
                )
            }
            Text(
                text = changeStr,
                color = changeColor,
                fontWeight = FontWeight.Bold,
                fontSize = 13.sp,
            )
        }
    }
}
