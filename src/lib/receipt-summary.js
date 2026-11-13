export function buildReceiptSummary(receipts = [], language = "pt-PT", now = new Date()) {
  const source = Array.isArray(receipts) ? receipts : [];
  const months = Array.from({ length: 6 }, (_, index) => new Date(now.getFullYear(), now.getMonth() - 5 + index, 1));
  const monthly = months.map(month => {
    const key = month.getFullYear() + "-" + String(month.getMonth() + 1).padStart(2, "0");
    const total = source.reduce((sum, receipt) => {
      const date = new Date(String(receipt.purchasedAt || "") + "T12:00:00");
      const receiptKey = Number.isNaN(date.getTime()) ? "" : date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
      return sum + (receiptKey === key ? Number(receipt.total) || 0 : 0);
    }, 0);
    return { key, label: month.toLocaleDateString(language, { month: "short" }), total };
  });
  const total = source.reduce((sum, receipt) => sum + (Number(receipt.total) || 0), 0);
  const byStore = new Map();
  for (const receipt of source) {
    const store = String(receipt.storeName || "Outros").trim() || "Outros";
    byStore.set(store, (byStore.get(store) || 0) + (Number(receipt.total) || 0));
  }
  const topStore = [...byStore.entries()].sort((a, b) => b[1] - a[1])[0] || null;
  return {
    total,
    currentMonth: monthly[monthly.length - 1]?.total || 0,
    average: source.length ? total / source.length : 0,
    count: source.length,
    monthly,
    topStore
  };
}
