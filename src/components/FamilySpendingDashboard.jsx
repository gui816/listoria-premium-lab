import { useMemo } from "react";
import { buildReceiptSummary } from "../lib/receipt-summary.js";
import { ArrowRight, Receipt, ShoppingBasket, Sparkles, Wallet } from "lucide-react";

export default function FamilySpendingDashboard({ receipts = [], language = "pt-PT", t, onOpenReceipts, onAddExpense }) {
  const summary = useMemo(() => buildReceiptSummary(receipts, language), [receipts, language]);

  const maxMonthly = Math.max(1, ...summary.monthly.map(entry => entry.total));
  const formatMoney = value => Number(value || 0).toLocaleString(language, { style: "currency", currency: "EUR" });

  return <section className="finance-hub">
    <header className="finance-hub-heading area-page-heading"><div className="area-page-heading-copy"><span className="eyebrow">{t("VISÃO DA FAMÍLIA")}</span><h1>{t("Gastos da família")}</h1><p>{t("Acompanha as despesas registadas nas compras da família.")}</p></div><span className="area-page-heading-icon"><Wallet size={25}/></span></header>
    <div className="finance-metric-grid">
      <article className="finance-overview-card"><span>{t("Total registado")}</span><strong>{formatMoney(summary.total)}</strong><small>{summary.count} {summary.count === 1 ? t("fatura") : t("faturas")}</small></article>
      <article className="finance-overview-card"><span>{t("Este mês")}</span><strong>{formatMoney(summary.currentMonth)}</strong><small>{t("Com base nas faturas registadas")}</small></article>
      <article className="finance-overview-card"><span>{t("Média por compra")}</span><strong>{formatMoney(summary.average)}</strong><small>{t("Valor médio das faturas")}</small></article>
    </div>
    <section className="finance-monthly-card">
      <div className="finance-section-heading"><div><h2>{t("Evolução dos gastos")}</h2><p>{t("Últimos seis meses, com base nas faturas guardadas.")}</p></div></div>
      {summary.count === 0 ? <div className="finance-empty"><Receipt size={22}/><strong>{t("Ainda não existem despesas registadas")}</strong><span>{t("Adiciona uma fatura para começares a acompanhar os gastos da família.")}</span></div> : <div className="finance-monthly-chart" role="img" aria-label={t("Gastos mensais nos últimos seis meses")}>
        {summary.monthly.map(month => <div className="finance-month-column" key={month.key}><strong>{month.total.toLocaleString(language, { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}</strong><div className="finance-month-bar-track"><span style={{ height: Math.max(4, month.total / maxMonthly * 100) + "%" }}/></div><small>{month.label}</small></div>)}
      </div>}
    </section>
    {summary.topStore && <div className="finance-action-card"><div className="finance-action-icon"><ShoppingBasket size={21}/></div><div><strong>{t("Maior volume registado")}</strong><p>{summary.topStore[0]} · {formatMoney(summary.topStore[1])}</p></div></div>}
    <div className="finance-action-card"><div className="finance-action-icon"><Wallet size={21}/></div><div><strong>{t("Registar despesa")}</strong><p>{t("Adiciona um gasto manualmente, mesmo sem comprovativo.")}</p></div><button type="button" className="secondary-button" onClick={onAddExpense}>{t("Registar gasto")} <ArrowRight size={16}/></button></div>
    <div className="finance-action-card"><div className="finance-action-icon"><Receipt size={21}/></div><div><strong>{t("Registos e comprovativos")}</strong><p>{t("Consulta despesas manuais e faturas guardadas pela família.")}</p></div><button type="button" className="secondary-button" onClick={onOpenReceipts}>{t("Ver faturas")} <ArrowRight size={16}/></button></div>
    <div className="finance-note"><Sparkles size={17}/><p>{t("Os valores apresentados correspondem às faturas e despesas registadas. As estimativas de cabaz não são contabilizadas como despesas reais.")}</p></div>
  </section>;
}
