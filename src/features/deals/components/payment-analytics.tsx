"use client";

import { useState, useMemo } from "react";
import type { 
  SerializedDeal, 
  AnalyticsTimeFilter, 
  TrendInterval,
  PaymentMethod 
} from "../types";
import { 
  calculateDealsAnalytics, 
  formatCurrency, 
  formatShortDate 
} from "../calculations";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from "recharts";
import {
  TrendingUp,
  AlertCircle,
  Clock,
  Calendar,
  CreditCard,
  Building2,
  Users,
  CheckCircle2,
  ArrowUpRight,
  HelpCircle,
  Filter,
  DollarSign
} from "lucide-react";

interface PaymentAnalyticsProps {
  deals: SerializedDeal[];
  activeTab: "all" | "crm" | "other";
}

const TIME_FILTERS: Array<{ id: AnalyticsTimeFilter; label: string }> = [
  { id: "all_time", label: "All Time" },
  { id: "this_month", label: "This Month" },
  { id: "last_month", label: "Last Month" },
  { id: "last_30_days", label: "Last 30 Days" },
  { id: "this_year", label: "This Year" },
];

const METHOD_CONFIG: Record<
  PaymentMethod,
  { label: string; color: string; bg: string; barColor: string }
> = {
  UPI: { label: "UPI", color: "text-blue-700", bg: "bg-blue-50 border-blue-200", barColor: "bg-blue-600" },
  BANK_TRANSFER: { label: "Bank Transfer", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", barColor: "bg-emerald-600" },
  CASH: { label: "Cash", color: "text-amber-700", bg: "bg-amber-50 border-amber-200", barColor: "bg-amber-600" },
  CARD: { label: "Card", color: "text-purple-700", bg: "bg-purple-50 border-purple-200", barColor: "bg-purple-600" },
  PAYPAL: { label: "PayPal", color: "text-cyan-700", bg: "bg-cyan-50 border-cyan-200", barColor: "bg-cyan-600" },
  OTHER: { label: "Other", color: "text-slate-700", bg: "bg-slate-50 border-slate-200", barColor: "bg-slate-500" },
};

export function PaymentAnalytics({ deals, activeTab }: PaymentAnalyticsProps) {
  const [timeFilter, setTimeFilter] = useState<AnalyticsTimeFilter>("all_time");
  const [trendInterval, setTrendInterval] = useState<TrendInterval>("monthly");
  const [clientRankingMetric, setClientRankingMetric] = useState<"dealValue" | "received" | "outstanding">("dealValue");

  // Compute analytics dynamically based on scoped deals and selected time filter
  const analytics = useMemo(() => {
    return calculateDealsAnalytics(deals, timeFilter);
  }, [deals, timeFilter]);

  // Select trend dataset based on toggle
  const trendData = useMemo(() => {
    if (trendInterval === "daily") return analytics.dailyTrend;
    if (trendInterval === "weekly") return analytics.weeklyTrend;
    return analytics.monthlyTrend;
  }, [trendInterval, analytics]);

  // Top clients list based on selected ranking metric
  const rankedClients = useMemo(() => {
    if (clientRankingMetric === "received") return analytics.topByReceived.slice(0, 5);
    if (clientRankingMetric === "outstanding") return analytics.topByOutstanding.slice(0, 5);
    return analytics.topByDealValue.slice(0, 5);
  }, [clientRankingMetric, analytics]);

  // Outstanding proportions
  const overduePercent = analytics.totalOutstanding > 0
    ? Math.round((analytics.overdueAmount / analytics.totalOutstanding) * 100)
    : 0;
  const upcomingPercent = Math.max(0, 100 - overduePercent);

  return (
    <div className="space-y-4">
      {/* SECTION HEADER WITH TIME FILTERS */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
            <TrendingUp size={20} />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              Payment &amp; Cash Flow Analytics
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600">
                {activeTab === "all" ? "All Deals" : activeTab === "crm" ? "CRM Clients" : "Other Clients"}
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              Cash collections, upcoming receivables, and client financial distribution.
            </p>
          </div>
        </div>

        {/* TIME FILTER PILLS */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <Filter size={13} className="text-slate-400 shrink-0 mr-1 hidden sm:block" />
          {TIME_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setTimeFilter(f.id)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                timeFilter === f.id
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/60"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ROW 1: MONEY RECEIVED OVER TIME & OUTSTANDING MONEY BREAKDOWN */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* CHART: MONEY RECEIVED OVER TIME (2 cols on lg) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm flex flex-col justify-between">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Money Received Over Time
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {formatCurrency(analytics.totalReceived)}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Real payment records received ({analytics.totalPaymentsCount} transactions)
              </p>
            </div>

            {/* Daily / Weekly / Monthly Toggle */}
            <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200 text-xs font-semibold">
              {(["daily", "weekly", "monthly"] as const).map((interval) => (
                <button
                  key={interval}
                  type="button"
                  onClick={() => setTrendInterval(interval)}
                  className={`px-2.5 py-1 rounded-lg capitalize transition-all cursor-pointer ${
                    trendInterval === interval
                      ? "bg-white text-slate-900 shadow-sm font-bold"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  {interval}
                </button>
              ))}
            </div>
          </div>

          {/* Chart Display */}
          <div className="mt-4 h-56 sm:h-64 w-full">
            {trendData.length === 0 ? (
              <div className="h-full w-full flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-200 rounded-xl">
                <DollarSign className="h-8 w-8 text-slate-300 mb-1.5" />
                <p className="text-xs font-semibold text-slate-600">No payments recorded in this period</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Payments logged for deals in this tab will automatically plot here.
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="paymentTrendFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#f1f5f9" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={{ stroke: "#e2e8f0" }}
                    tick={{ fill: "#64748b", fontSize: 11 }}
                    minTickGap={16}
                  />
                  <YAxis
                    tickFormatter={(val) => `₹${val >= 1000 ? `${Math.round(val / 1000)}k` : val}`}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#64748b", fontSize: 11 }}
                    width={46}
                  />
                  <Tooltip
                    formatter={(val) => [formatCurrency(Number(val)), "Amount Received"]}
                    labelFormatter={(label) => `Date: ${label}`}
                    contentStyle={{
                      borderRadius: "12px",
                      borderColor: "#e2e8f0",
                      boxShadow: "0 10px 25px -5px rgba(0,0,0,0.08)",
                      fontSize: "12px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    stroke="#059669"
                    strokeWidth={2.5}
                    fill="url(#paymentTrendFill)"
                    activeDot={{ r: 5, fill: "#059669", stroke: "#ffffff", strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* OUTSTANDING MONEY & PENDING BREAKDOWN (1 col on lg) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  Outstanding Money
                </span>
                <span className="text-xs text-slate-400 mt-0.5 block">
                  Pending client balances
                </span>
              </div>
              <span className="text-lg sm:text-xl font-bold text-slate-900">
                {formatCurrency(analytics.totalOutstanding)}
              </span>
            </div>

            {/* Proportion Bar */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs font-medium text-slate-600 mb-1.5">
                <span>Distribution</span>
                <span>{analytics.totalOutstanding > 0 ? "100% Pending" : "0 Pending"}</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden flex">
                <div
                  className="h-full bg-rose-500 transition-all"
                  style={{ width: `${overduePercent}%` }}
                  title={`Overdue: ${overduePercent}%`}
                />
                <div
                  className="h-full bg-amber-400 transition-all"
                  style={{ width: `${upcomingPercent}%` }}
                  title={`Upcoming / On Track: ${upcomingPercent}%`}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-rose-500 inline-block" />
                  Overdue ({overduePercent}%)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-400 inline-block" />
                  Upcoming ({upcomingPercent}%)
                </span>
              </div>
            </div>

            {/* Breakdown Cards */}
            <div className="mt-4 space-y-2.5">
              <div className="p-3 rounded-xl border border-rose-200/80 bg-rose-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle size={16} className="text-rose-600 shrink-0" />
                  <div>
                    <span className="text-xs font-semibold text-rose-900 block">Overdue Outstanding</span>
                    <span className="text-[11px] text-rose-600 block">
                      {analytics.overdueDealsCount} {analytics.overdueDealsCount === 1 ? "deal" : "deals"} past due date
                    </span>
                  </div>
                </div>
                <span className="text-sm font-bold text-rose-700">
                  {formatCurrency(analytics.overdueAmount)}
                </span>
              </div>

              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-amber-600 shrink-0" />
                  <div>
                    <span className="text-xs font-semibold text-slate-800 block">Upcoming Outstanding</span>
                    <span className="text-[11px] text-slate-500 block">Future or on-schedule balances</span>
                  </div>
                </div>
                <span className="text-sm font-bold text-slate-900">
                  {formatCurrency(analytics.upcomingOutstanding)}
                </span>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 mt-3 pt-3 border-t border-slate-100 flex items-center gap-1">
            <HelpCircle size={12} className="shrink-0 text-slate-400" />
            <span>Overdue triggers when remaining balance &gt; 0 and due date is past today in IST.</span>
          </p>
        </div>
      </div>

      {/* ROW 2: UPCOMING PAYMENTS & OVERDUE PAYMENTS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* UPCOMING PAYMENTS */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Clock size={18} className="text-blue-600" />
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Upcoming Payments
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                {analytics.upcomingPayments.length} upcoming
              </span>
            </div>

            <div className="mt-3 divide-y divide-slate-100">
              {analytics.upcomingPayments.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  <CheckCircle2 size={24} className="mx-auto mb-1.5 text-slate-300" />
                  No upcoming due dates scheduled
                </div>
              ) : (
                analytics.upcomingPayments.slice(0, 5).map((item) => (
                  <div key={item.dealId} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                        {item.clientName}
                      </p>
                      {item.companyOrProject ? (
                        <p className="text-[11px] text-slate-500 truncate">{item.companyOrProject}</p>
                      ) : null}
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs sm:text-sm font-bold text-slate-900 block">
                        {formatCurrency(item.amountDue, item.currency)}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] text-blue-600 font-medium">
                        <Calendar size={10} />
                        {formatShortDate(item.dueDate)} ({item.daysRemaining === 0 ? "Today" : `in ${item.daysRemaining}d`})
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* OVERDUE PAYMENTS */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <AlertCircle size={18} className="text-rose-600" />
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Overdue Payments
                </h3>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                analytics.overduePayments.length > 0
                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                  : "bg-emerald-50 text-emerald-700 border border-emerald-200"
              }`}>
                {analytics.overduePayments.length} overdue
              </span>
            </div>

            <div className="mt-3 divide-y divide-slate-100">
              {analytics.overduePayments.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  <CheckCircle2 size={24} className="mx-auto mb-1.5 text-emerald-400" />
                  Zero overdue payments! All client collections on schedule.
                </div>
              ) : (
                analytics.overduePayments.slice(0, 5).map((item) => (
                  <div key={item.dealId} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                        {item.clientName}
                      </p>
                      {item.companyOrProject ? (
                        <p className="text-[11px] text-slate-500 truncate">{item.companyOrProject}</p>
                      ) : null}
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs sm:text-sm font-bold text-rose-700 block">
                        {formatCurrency(item.outstandingAmount, item.currency)}
                      </span>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                        {item.daysOverdue} {item.daysOverdue === 1 ? "day" : "days"} overdue
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ROW 3: TOP CLIENTS & PAYMENT METHOD BREAKDOWN */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* TOP CLIENTS (2 cols on lg) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Building2 size={18} className="text-slate-700" />
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Top Clients
                </h3>
                <p className="text-[11px] text-slate-400">Financial rankings based on verified business totals</p>
              </div>
            </div>

            {/* Metric Toggle: Highest Deal Value | Highest Received | Highest Outstanding */}
            <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200 text-xs font-semibold overflow-x-auto">
              <button
                type="button"
                onClick={() => setClientRankingMetric("dealValue")}
                className={`px-2.5 py-1 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                  clientRankingMetric === "dealValue"
                    ? "bg-white text-slate-900 shadow-sm font-bold"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Highest Deal Value
              </button>
              <button
                type="button"
                onClick={() => setClientRankingMetric("received")}
                className={`px-2.5 py-1 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                  clientRankingMetric === "received"
                    ? "bg-white text-slate-900 shadow-sm font-bold"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Highest Received
              </button>
              <button
                type="button"
                onClick={() => setClientRankingMetric("outstanding")}
                className={`px-2.5 py-1 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                  clientRankingMetric === "outstanding"
                    ? "bg-white text-slate-900 shadow-sm font-bold"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Highest Outstanding
              </button>
            </div>
          </div>

          <div className="mt-3 divide-y divide-slate-100">
            {rankedClients.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No clients found in current scope
              </div>
            ) : (
              rankedClients.map((client, idx) => {
                const displayAmount =
                  clientRankingMetric === "received"
                    ? client.totalReceived
                    : clientRankingMetric === "outstanding"
                    ? client.totalOutstanding
                    : client.totalDealValue;

                return (
                  <div key={client.clientName} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">
                        #{idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                          {client.clientName}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {client.companyOrProject || `${client.dealCount} deal(s)`}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs sm:text-sm font-bold text-slate-900 block">
                        {formatCurrency(displayAmount)}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {clientRankingMetric === "received"
                          ? `of ${formatCurrency(client.totalDealValue)} deal`
                          : clientRankingMetric === "outstanding"
                          ? `pending of ${formatCurrency(client.totalDealValue)}`
                          : `${formatCurrency(client.totalReceived)} received`}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* PAYMENT METHOD BREAKDOWN (1 col on lg) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <CreditCard size={18} className="text-slate-700" />
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Payment Methods
                </h3>
              </div>
              <span className="text-xs font-semibold text-slate-500">
                {analytics.totalPaymentsCount} payments
              </span>
            </div>

            <div className="mt-3 space-y-3">
              {(Object.keys(METHOD_CONFIG) as PaymentMethod[]).map((methodKey) => {
                const config = METHOD_CONFIG[methodKey];
                const data = analytics.paymentMethodsBreakdown[methodKey];
                if (!data || (data.amount === 0 && analytics.totalReceived > 0)) {
                  // Show only methods with payments or non-zero total
                  return null;
                }

                return (
                  <div key={methodKey} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                        <span className={`inline-block h-2 w-2 rounded-full ${config.barColor}`} />
                        {config.label}
                      </span>
                      <span className="font-bold text-slate-900">
                        {formatCurrency(data.amount)}
                        <span className="text-[11px] font-normal text-slate-400 ml-1">
                          ({data.percentage}%)
                        </span>
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${config.barColor} transition-all`}
                        style={{ width: `${data.percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}

              {analytics.totalReceived === 0 && (
                <div className="py-6 text-center text-xs text-slate-400">
                  No payment methods logged yet
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ROW 4: CRM VS OTHER CLIENTS (ONLY SHOWN IN ALL DEALS TAB) */}
      {activeTab === "all" ? (
        <div className="bg-gradient-to-r from-blue-50/60 via-indigo-50/40 to-purple-50/60 rounded-2xl border border-blue-200/80 p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-blue-200/60">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-blue-600" />
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider">
                  CRM vs Other Clients Breakdown
                </h3>
                <p className="text-[11px] text-slate-500">
                  Performance comparison between CRM lead deals and standalone client deals
                </p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white text-blue-700 border border-blue-200 shadow-2xs">
              All Deals Overview
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* CRM Clients Card */}
            <div className="bg-white rounded-xl border border-blue-200 p-4 shadow-2xs">
              <div className="flex items-center justify-between mb-3">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  CRM Clients
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  {analytics.crmClients.dealsCount} deals
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase block">Deal Value</span>
                  <span className="text-xs sm:text-sm font-bold text-slate-900 block mt-0.5">
                    {formatCurrency(analytics.crmClients.dealValue)}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-emerald-50/60 border border-emerald-100">
                  <span className="text-[10px] font-semibold text-emerald-600 uppercase block">Received</span>
                  <span className="text-xs sm:text-sm font-bold text-emerald-700 block mt-0.5">
                    {formatCurrency(analytics.crmClients.received)}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase block">Outstanding</span>
                  <span className="text-xs sm:text-sm font-bold text-slate-900 block mt-0.5">
                    {formatCurrency(analytics.crmClients.outstanding)}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-slate-500 font-medium pt-2 border-t border-slate-100">
                <span>Collection Rate</span>
                <span className="font-bold text-blue-700">{analytics.crmClients.collectionRate}%</span>
              </div>
            </div>

            {/* Other Clients Card */}
            <div className="bg-white rounded-xl border border-purple-200 p-4 shadow-2xs">
              <div className="flex items-center justify-between mb-3">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
                  Other Clients
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  {analytics.otherClients.dealsCount} deals
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase block">Deal Value</span>
                  <span className="text-xs sm:text-sm font-bold text-slate-900 block mt-0.5">
                    {formatCurrency(analytics.otherClients.dealValue)}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-emerald-50/60 border border-emerald-100">
                  <span className="text-[10px] font-semibold text-emerald-600 uppercase block">Received</span>
                  <span className="text-xs sm:text-sm font-bold text-emerald-700 block mt-0.5">
                    {formatCurrency(analytics.otherClients.received)}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase block">Outstanding</span>
                  <span className="text-xs sm:text-sm font-bold text-slate-900 block mt-0.5">
                    {formatCurrency(analytics.otherClients.outstanding)}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-slate-500 font-medium pt-2 border-t border-slate-100">
                <span>Collection Rate</span>
                <span className="font-bold text-purple-700">{analytics.otherClients.collectionRate}%</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
