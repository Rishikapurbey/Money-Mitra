import { Prisma } from "@prisma/client";
import prisma from "../../db/prisma";
import { sendEmail } from "../../lib/email";
import { escapeHtml } from "../../lib/html";
import { DELETED_USERNAME } from "../../lib/validation";

export interface BudgetAlertResult {
  level: 80 | 100;
  message: string;
}

const MINUTE = 60_000;

const formatINR = (amount: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);

// The user's current calendar month. tzOffset is the client's Date.getTimezoneOffset() (-330 for IST).
export function localMonth(now: Date, tzOffset: number) {
  const local = new Date(now.getTime() - tzOffset * MINUTE);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth();
  return {
    key: `${year}-${String(month + 1).padStart(2, "0")}`,
    name: local.toLocaleString("en-IN", { month: "long", timeZone: "UTC" }),
    from: new Date(Date.UTC(year, month, 1) + tzOffset * MINUTE),
    to: new Date(Date.UTC(year, month + 1, 1) + tzOffset * MINUTE),
  };
}

function alertEmail(message: string, spent: number, limit: number) {
  const appUrl = (process.env.APP_URL ?? "http://127.0.0.1:5173").replace(/\/$/, "");
  const link = `${appUrl}/tracker`;
  const detail = `So far this month you've spent ${formatINR(spent)} of ${formatINR(limit)}.`;
  const footer = "You can turn these emails off in Settings, under Notifications.";
  const text = [message + ".", detail, "", `See your budgets: ${link}`, "", footer].join("\n");
  const html = `
  <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #0f1b2d;">
    <h2 style="margin-bottom: 8px;">${escapeHtml(message)}</h2>
    <p>${escapeHtml(detail)}</p>
    <p style="margin: 24px 0;">
      <a href="${link}" style="background: #0f6f67; color: #ffffff; padding: 12px 20px; border-radius: 10px; text-decoration: none; font-weight: bold;">
        See your budgets
      </a>
    </p>
    <p style="color: #64748b; font-size: 14px;">${footer}</p>
  </div>`;
  return { text, html };
}

// Records an alert level as given; false if it was already given this month
async function claim(userId: string, category: string, month: string, level: number) {
  try {
    await prisma.budgetAlert.create({ data: { userId, category, month, level } });
    return true;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return false;
    throw err;
  }
}

// After spending in a category changes, alerts the user the first time this month it reaches
// 80% or 100% of its budget. Only the current month counts, so editing old entries never alerts.
export async function checkBudget(
  userId: string,
  category: string,
  tzOffset: number,
  date: Date,
  now = new Date()
): Promise<BudgetAlertResult | null> {
  const month = localMonth(now, tzOffset);
  if (date < month.from || date >= month.to) return null;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.budgetAlerts) return null;
  const budget = await prisma.budget.findFirst({ where: { userId, category: { equals: category, mode: "insensitive" } } });
  if (!budget || budget.amount <= 0) return null;

  const total = await prisma.transaction.aggregate({
    where: {
      userId,
      type: "expense",
      category: { equals: budget.category, mode: "insensitive" },
      date: { gte: month.from, lt: month.to },
    },
    _sum: { amount: true },
  });
  const spent = total._sum.amount ?? 0;
  const share = spent / budget.amount;
  const level = share >= 1 ? 100 : share >= 0.8 ? 80 : null;
  if (!level) return null;

  if (!(await claim(userId, budget.category, month.key, level))) return null;
  // Going straight past the limit skips the "getting close" alert for the rest of the month
  if (level === 100) await claim(userId, budget.category, month.key, 80);

  const message =
    level === 100
      ? `You're over your ${budget.category} budget for ${month.name}`
      : `You've used ${Math.floor(share * 100)}% of your ${budget.category} budget for ${month.name}`;
  await prisma.notification.create({
    data: { userId, kind: level === 100 ? "budget_over" : "budget_near", title: message },
  });

  if (user.emailBudgetAlerts && user.emailVerifiedAt && user.username !== DELETED_USERNAME) {
    const { text, html } = alertEmail(message, spent, budget.amount);
    sendEmail({ to: user.email, subject: message, text, html }).catch((err) => console.error("Budget alert email failed:", err));
  }
  return { level, message };
}
