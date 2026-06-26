package com.stonker.app.auto;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import android.text.SpannableString;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.car.app.CarContext;
import androidx.car.app.Screen;
import androidx.car.app.model.Action;
import androidx.car.app.model.ActionStrip;
import androidx.car.app.model.CarColor;
import androidx.car.app.model.CarText;
import androidx.car.app.model.ForegroundCarColorSpan;
import androidx.car.app.model.ItemList;
import androidx.car.app.model.ListTemplate;
import androidx.car.app.model.MessageTemplate;
import androidx.car.app.model.Row;
import androidx.car.app.model.Template;
import androidx.lifecycle.DefaultLifecycleObserver;
import androidx.lifecycle.LifecycleOwner;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class MainScreen extends Screen {

    private static final String TAG = "StonkerAuto";
    private static final String API_BASE = "https://stonker-production.up.railway.app/api";
    private static final String[] DEFAULT_SYMBOLS = {"AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "NVDA", "META"};
    private static final long REFRESH_INTERVAL_MS = 30_000L;

    private static final class StockItem {
        final String symbol;
        final double price;
        final double changePercent;

        StockItem(String symbol, double price, double changePercent) {
            this.symbol = symbol;
            this.price = price;
            this.changePercent = changePercent;
        }
    }

    private List<StockItem> stocks = new ArrayList<>();
    private boolean loading = true;
    private String error = null;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable periodicRefresh = new Runnable() {
        @Override
        public void run() {
            fetchStocks();
            handler.postDelayed(this, REFRESH_INTERVAL_MS);
        }
    };

    public MainScreen(@NonNull CarContext carContext) {
        super(carContext);

        getLifecycle().addObserver(new DefaultLifecycleObserver() {
            @Override
            public void onStart(@NonNull LifecycleOwner owner) {
                fetchStocks();
                handler.postDelayed(periodicRefresh, REFRESH_INTERVAL_MS);
            }

            @Override
            public void onStop(@NonNull LifecycleOwner owner) {
                handler.removeCallbacks(periodicRefresh);
            }
        });
    }

    @NonNull
    @Override
    public Template onGetTemplate() {
        ActionStrip actionStrip = new ActionStrip.Builder()
            .addAction(new Action.Builder()
                .setTitle("Refresh")
                .setOnClickListener(this::onRefreshClicked)
                .build())
            .build();

        if (loading && stocks.isEmpty()) {
            return new ListTemplate.Builder()
                .setTitle("Stonker")
                .setLoading(true)
                .setActionStrip(actionStrip)
                .build();
        }

        if (error != null && stocks.isEmpty()) {
            return new MessageTemplate.Builder("Unable to load stock data.\nCheck your connection.")
                .setTitle("Stonker")
                .addAction(new Action.Builder()
                    .setTitle("Retry")
                    .setOnClickListener(this::onRefreshClicked)
                    .build())
                .build();
        }

        ItemList.Builder listBuilder = new ItemList.Builder();
        for (StockItem stock : stocks) {
            String priceStr = String.format(Locale.US, "$%.2f", stock.price);
            String changeStr = String.format(Locale.US, "%+.2f%%", stock.changePercent);
            CarColor changeColor = stock.changePercent >= 0 ? CarColor.GREEN : CarColor.RED;

            SpannableString changeSpan = new SpannableString(changeStr);
            changeSpan.setSpan(ForegroundCarColorSpan.create(changeColor), 0, changeStr.length(), 0);

            listBuilder.addItem(new Row.Builder()
                .setTitle(stock.symbol + "   " + priceStr)
                .addText(CarText.create(changeSpan))
                .build());
        }

        return new ListTemplate.Builder()
            .setTitle("Stonker")
            .setSingleList(listBuilder.build())
            .setActionStrip(actionStrip)
            .build();
    }

    private void onRefreshClicked() {
        handler.removeCallbacks(periodicRefresh);
        fetchStocks();
        handler.postDelayed(periodicRefresh, REFRESH_INTERVAL_MS);
    }

    private void fetchStocks() {
        loading = true;
        if (stocks.isEmpty()) invalidate();

        String[] symbols = getWatchlistSymbols();
        String symbolsParam = String.join(",", symbols);

        new Thread(() -> {
            List<StockItem> result = null;
            String fetchError = null;
            try {
                URL url = new URL(API_BASE + "/quotes?symbols=" + symbolsParam + "&timeScale=1D");
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setConnectTimeout(10_000);
                conn.setReadTimeout(10_000);
                conn.setRequestProperty("Accept", "application/json");
                conn.connect();

                int code = conn.getResponseCode();
                if (code != HttpURLConnection.HTTP_OK) {
                    throw new Exception("HTTP " + code);
                }

                StringBuilder sb = new StringBuilder();
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()))) {
                    String line;
                    while ((line = reader.readLine()) != null) sb.append(line);
                }
                conn.disconnect();

                JSONArray quotes = new JSONObject(sb.toString()).getJSONArray("quotes");
                result = new ArrayList<>();
                for (int i = 0; i < quotes.length(); i++) {
                    JSONObject q = quotes.getJSONObject(i);
                    result.add(new StockItem(
                        q.getString("symbol"),
                        q.getDouble("price"),
                        q.getDouble("changePercent")
                    ));
                }
            } catch (Exception e) {
                Log.e(TAG, "Fetch failed", e);
                fetchError = e.getMessage();
            }

            final List<StockItem> finalResult = result;
            final String finalError = fetchError;
            getCarContext().getMainExecutor().execute(() -> {
                if (finalResult != null) {
                    stocks = finalResult;
                    error = null;
                } else {
                    error = finalError;
                }
                loading = false;
                invalidate();
            });
        }).start();
    }

    private String[] getWatchlistSymbols() {
        try {
            SharedPreferences prefs = getCarContext()
                .getSharedPreferences("stonker_prefs", Context.MODE_PRIVATE);
            String json = prefs.getString("watchlist", null);
            if (json != null) {
                JSONArray arr = new JSONArray(json);
                if (arr.length() > 0) {
                    String[] symbols = new String[arr.length()];
                    for (int i = 0; i < arr.length(); i++) {
                        symbols[i] = arr.getString(i);
                    }
                    return symbols;
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed to read watchlist from prefs, using defaults", e);
        }
        return DEFAULT_SYMBOLS;
    }
}
