import prisma from "../../db/prisma";
import { HttpError } from "../../lib/httpError";
import { accountAlert, checkAccount } from "../networth/networth.service";
import type { DateRange } from "../transactions/transaction.service";

export interface TransferInput {
  fromId: string;
  toId: string;
  amount: number;
  date?: Date | undefined;
  note: string | null;
}

const select = { id: true, amount: true, date: true, note: true, fromId: true, toId: true } as const;

async function checkAccounts(userId: string, input: TransferInput) {
  if (input.fromId === input.toId) throw new HttpError(400, "Choose two different accounts");
  await Promise.all([checkAccount(userId, input.fromId), checkAccount(userId, input.toId)]);
}

async function findOwned(userId: string, id: string) {
  const transfer = await prisma.transfer.findUnique({ where: { id } });
  if (!transfer || transfer.userId !== userId) throw new HttpError(404, "Transfer not found");
  return transfer;
}

// Moving money out can leave the account it came from below zero, which is worth saying
export async function createTransfer(userId: string, input: TransferInput) {
  await checkAccounts(userId, input);
  const { date, ...fields } = input;
  const transfer = await prisma.transfer.create({ data: { userId, ...fields, ...(date && { date }) }, select });
  return { transfer, accountAlert: await accountAlert(userId, transfer.fromId) };
}

export async function updateTransfer(userId: string, id: string, input: TransferInput) {
  await findOwned(userId, id);
  await checkAccounts(userId, input);
  const { date, ...fields } = input;
  const transfer = await prisma.transfer.update({ where: { id }, data: { ...fields, ...(date && { date }) }, select });
  return { transfer, accountAlert: await accountAlert(userId, transfer.fromId) };
}

export async function deleteTransfer(userId: string, id: string) {
  await findOwned(userId, id);
  await prisma.transfer.delete({ where: { id } });
}

// Transfers in a date range, newest first, optionally only those touching one account
export function listTransfers(userId: string, range: DateRange, account?: string) {
  return prisma.transfer.findMany({
    where: {
      userId,
      ...((range.from || range.to) && { date: { ...(range.from && { gte: range.from }), ...(range.to && { lt: range.to }) } }),
      ...(account && { OR: [{ fromId: account }, { toId: account }] }),
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 500,
    select,
  });
}
